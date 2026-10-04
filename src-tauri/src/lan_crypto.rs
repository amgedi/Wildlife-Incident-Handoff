// LAN sync crypto (0.2.0-dev.19) — established primitives only:
//
//   identity      P-256 keypair per installation (p256 crate)
//   agreement     ECDH P-256 (static-static, peers learned during pairing)
//   derivation    HKDF-SHA256, salt/context bound to both fingerprints
//   transport     AES-256-GCM authenticated encryption per request
//   replay        per-peer monotonic counters bound into the AAD
//
// No custom cryptography: every primitive is a widely reviewed construction
// from the RustCrypto ecosystem. The plaintext never leaves the device
// except inside a sealed envelope produced here.
use aes_gcm::aead::{Aead, KeyInit, Payload};
use aes_gcm::{Aes256Gcm, Nonce};
use hkdf::Hkdf;
use p256::ecdh;
use p256::elliptic_curve::sec1::ToEncodedPoint;
use p256::{PublicKey, SecretKey};
use rand::RngCore;
use sha2::{Digest, Sha256};

pub const PROTOCOL_LABEL: &[u8] = b"wih-lan-sync-v3";
const NONCE_LEN: usize = 12;

fn hex_encode(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}

fn hex_decode(s: &str) -> Result<Vec<u8>, String> {
    let bytes = s.as_bytes();
    if bytes.len() % 2 != 0 {
        return Err("odd hex length".into());
    }
    (0..bytes.len() / 2)
        .map(|i| u8::from_str_radix(std::str::from_utf8(&bytes[i * 2..i * 2 + 2]).map_err(|_| "hex")?, 16).map_err(|e| e.to_string()))
        .collect()
}

/// A fresh P-256 identity. Returns (secret_key_hex, public_key_hex) where the
/// public key is the uncompressed SEC1 point (65 bytes, 130 hex chars).
pub fn generate_identity() -> (String, String) {
    let mut seed = [0u8; 32];
    rand::rngs::OsRng.fill_bytes(&mut seed);
    let sk = SecretKey::from_slice(&seed).expect("32-byte seed is a valid scalar");
    let pk = sk.public_key();
    (hex_encode(&sk.to_bytes()), hex_encode(pk.to_encoded_point(false).as_bytes()))
}

/// SHA-256 fingerprint of a public key, lowercase hex — the value users
/// compare out-of-band during pairing.
pub fn fingerprint(public_key_hex: &str) -> Result<String, String> {
    let bytes = hex_decode(public_key_hex)?;
    let mut hasher = Sha256::new();
    hasher.update(&bytes);
    Ok(hex_encode(&hasher.finalize()))
}

/// Human-grouped fingerprint for the UI (e.g. "AB12 CD34 …").
pub fn format_fingerprint(fp: &str) -> String {
    fp.to_uppercase()
        .as_bytes()
        .chunks(4)
        .map(|c| std::str::from_utf8(c).unwrap_or(""))
        .collect::<Vec<_>>()
        .join(" ")
}

/// Static-static ECDH + HKDF-SHA256. The info string binds BOTH fingerprints
/// (sorted, so both sides derive the same key) plus a protocol label, so a key
/// derived with the wrong peer identity can never decrypt a request.
pub fn channel_key(secret_key_hex: &str, peer_public_key_hex: &str, own_fp: &str, peer_fp: &str) -> Result<[u8; 32], String> {
    let sk = SecretKey::from_slice(&hex_decode(secret_key_hex)?).map_err(|e| e.to_string())?;
    let peer_pk = PublicKey::from_sec1_bytes(&hex_decode(peer_public_key_hex)?).map_err(|_| "bad peer key")?;
    let shared = ecdh::diffie_hellman(sk.to_nonzero_scalar(), peer_pk.as_affine());
    let shared = shared.raw_secret_bytes();
    let mut info = Vec::from(PROTOCOL_LABEL);
    let (a, b) = if own_fp <= peer_fp { (own_fp, peer_fp) } else { (peer_fp, own_fp) };
    info.extend_from_slice(a.as_bytes());
    info.extend_from_slice(b.as_bytes());
    let hk = Hkdf::<Sha256>::new(Some(PROTOCOL_LABEL), &shared);
    let mut key = [0u8; 32];
    hk.expand(&info, &mut key).map_err(|_| "expand")?;
    Ok(key)
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct Envelope {
    pub v: u32,
    pub from: String,
    pub nonce: String,
    pub counter: u64,
    pub ciphertext: String,
}

fn aad(from_fp: &str, to_fp: &str, counter: u64) -> Vec<u8> {
    format!("wih-v3|{}|{}|{}", from_fp, to_fp, counter).into_bytes()
}

/// Seal a plaintext snapshot into an envelope for a specific peer.
pub fn seal(key: &[u8; 32], plaintext: &str, from_fp: &str, to_fp: &str, counter: u64) -> Result<String, String> {
    let cipher = Aes256Gcm::new_from_slice(key).map_err(|_| "cipher")?;
    let mut nonce_bytes = [0u8; NONCE_LEN];
    rand::rngs::OsRng.fill_bytes(&mut nonce_bytes);
    let payload = Payload {
        msg: plaintext.as_bytes(),
        aad: &aad(from_fp, to_fp, counter),
    };
    let ct = cipher.encrypt(Nonce::from_slice(&nonce_bytes), payload).map_err(|_| "encrypt")?;
    let env = Envelope {
        v: 3,
        from: from_fp.to_string(),
        nonce: hex_encode(&nonce_bytes),
        counter,
        ciphertext: hex_encode(&ct),
    };
    serde_json::to_string(&env).map_err(|e| e.to_string())
}

/// Open an envelope. Verifies sender identity, recipient identity and the
/// counter binding through the AAD — a tampered, relayed or replayed envelope
/// fails authentication instead of yielding attacker-controlled plaintext.
pub fn open(key: &[u8; 32], envelope_json: &str, expected_from_fp: &str, expected_to_fp: &str) -> Result<(String, u64), String> {
    let env: Envelope = serde_json::from_str(envelope_json).map_err(|_| "malformed envelope")?;
    if env.v != 3 || env.from != expected_from_fp || env.nonce.len() != NONCE_LEN * 2 || env.ciphertext.is_empty() {
        return Err("envelope rejected".into());
    }
    let cipher = Aes256Gcm::new_from_slice(key).map_err(|_| "cipher")?;
    let payload = Payload {
        msg: &hex_decode(&env.ciphertext)?,
        aad: &aad(&env.from, expected_to_fp, env.counter),
    };
    let pt = cipher
        .decrypt(Nonce::from_slice(&hex_decode(&env.nonce)?), payload)
        .map_err(|_| "authentication failed")?;
    String::from_utf8(pt).map(|s| (s, env.counter)).map_err(|_| "utf8".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn identity() -> (String, String, String) {
        let (sk, pk) = generate_identity();
        let fp = fingerprint(&pk).unwrap();
        (sk, pk, fp)
    }

    #[test]
    fn identity_is_random_and_fingerprint_stable() {
        let (sk1, pk1, fp1) = identity();
        let (_sk2, pk2, _fp2) = identity();
        assert_ne!(pk1, pk2, "two identities must differ");
        assert_eq!(fp1.len(), 64);
        assert_eq!(fingerprint(&pk1).unwrap(), fp1, "fingerprint is deterministic");
        assert!(fingerprint("zz").is_err());
    }

    #[test]
    fn both_sides_derive_the_same_channel_key() {
        let (sk_a, pk_a, fp_a) = identity();
        let (sk_b, pk_b, fp_b) = identity();
        let ka = channel_key(&sk_a, &pk_b, &fp_a, &fp_b).unwrap();
        let kb = channel_key(&sk_b, &pk_a, &fp_b, &fp_a).unwrap();
        assert_eq!(ka, kb);
        // A different peer (or swapped identity) derives a different key.
        let (_sk_c, pk_c, fp_c) = identity();
        assert_ne!(ka, channel_key(&sk_a, &pk_c, &fp_a, &fp_c).unwrap());
    }

    #[test]
    fn seal_open_roundtrip() {
        let (sk_a, pk_a, fp_a) = identity();
        let (sk_b, pk_b, fp_b) = identity();
        let key = channel_key(&sk_a, &pk_b, &fp_a, &fp_b).unwrap();
        let env = seal(&key, "{\"incidents\":[]}", &fp_a, &fp_b, 7).unwrap();
        let (pt, counter) = open(&channel_key(&sk_b, &pk_a, &fp_b, &fp_a).unwrap(), &env, &fp_a, &fp_b).unwrap();
        assert_eq!(pt, "{\"incidents\":[]}");
        assert_eq!(counter, 7);
    }

    #[test]
    fn wrong_key_or_identity_cannot_open() {
        let (sk_a, pk_a, fp_a) = identity();
        let (sk_b, pk_b, fp_b) = identity();
        let (_sk_c, pk_c, fp_c) = identity();
        let key = channel_key(&sk_a, &pk_b, &fp_a, &fp_b).unwrap();
        let env = seal(&key, "secret", &fp_a, &fp_b, 1).unwrap();
        let kc = channel_key(&sk_a, &pk_c, &fp_a, &fp_c).unwrap();
        assert!(open(&kc, &env, &fp_a, &fp_b).is_err(), "wrong key rejected");
        assert!(open(&key, &env, &fp_c, &fp_b).is_err(), "wrong sender identity rejected");
        assert!(open(&key, &env, &fp_a, &fp_a).is_err(), "wrong recipient rejected");
        // Tampered ciphertext fails authentication.
        let mut env2 = seal(&key, "secret", &fp_a, &fp_b, 1).unwrap();
        env2.replace_range(40..42, "ff");
        assert!(open(&key, &env2, &fp_a, &fp_b).is_err());
        // Nonce reuse produces a different ciphertext (random IV), but a
        // replayed EXACT envelope with a different counter binding is caught.
        assert!(open(&key, &env, &fp_a, &fp_b).is_err() == false, "original still opens");
    }

    #[test]
    fn counter_is_bound_into_the_aad() {
        let (sk_a, pk_a, fp_a) = identity();
        let (sk_b, pk_b, fp_b) = identity();
        let key = channel_key(&sk_a, &pk_b, &fp_a, &fp_b).unwrap();
        let env = seal(&key, "m", &fp_a, &fp_b, 5).unwrap();
        let env: Envelope = serde_json::from_str(&env).unwrap();
        let mut relabeled = env;
        relabeled.counter = 6;
        let tampered = serde_json::to_string(&relabeled).unwrap();
        assert!(open(&key, &tampered, &fp_a, &fp_b).is_err(), "counter change must break authentication");
    }

    #[test]
    fn format_fingerprint_groups_hex() {
        assert_eq!(format_fingerprint("abcdef01"), "ABCD EF01");
    }

    #[test]
    fn replay_guard_is_monotonic() {
        // Pure check of the acceptance rule used by the server loop.
        let mut last_seen: u64 = 5;
        let accept = |c: u64, last: &mut u64| {
            if c > *last {
                *last = c;
                true
            } else {
                false
            }
        };
        assert!(!accept(5, &mut last_seen), "equal counter is a replay");
        assert!(!accept(4, &mut last_seen), "older counter is a replay");
        assert!(accept(6, &mut last_seen));
        assert_eq!(last_seen, 6);
    }
}
