// LAN sync (0.2.0-dev.19, protocol v3) — encrypted local-network incident
// exchange. dev.15–dev.18 trusted a plaintext device-id header, which anyone
// on the LAN could spoof. v3 replaces it:
//
//   identity   persistent P-256 keypair per installation, generated and kept
//              by the Rust side (app data dir), fingerprint = SHA-256(pubkey)
//   pairing    code-gated request + explicit user approval; BOTH sides then
//              show the peer's fingerprint for out-of-band comparison
//   transport  every /wih/sync request is a sealed AES-256-GCM envelope
//              (ECDH + HKDF channel key, see lan_crypto.rs)
//   replay     per-peer monotonic counters bound into the AEAD AAD
//   scope      unpaired/untrusted peers get 403 and never see incident data;
//              /wih/ping reveals only an app tag
//
// Trust state and counters are persisted to the app data dir so they survive
// restarts. Merge policy stays in the frontend (plaintext locally).
use crate::lan_crypto as crypto;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::Read;
use std::net::UdpSocket;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Manager, State};
use tiny_http::{Header, Method, Response, Server};

const APP_TAG: &str = "wildlife-incident-handoff/1";
const MAX_BODY: usize = 8 * 1024 * 1024;
const RATE_LIMIT: usize = 60;

#[derive(Serialize, Deserialize, Clone)]
pub struct TrustedPeer {
    pub fingerprint: String,
    pub public_key: String,
    pub name: String,
    pub added_at: String,
    /// Monotonic counter we send TO this peer (persisted so restarts can't
    /// rewind it).
    #[serde(default)]
    pub tx_counter: u64,
}

#[derive(Serialize, Deserialize, Default, Clone)]
struct TrustStore {
    peers: Vec<TrustedPeer>,
    /// Highest counter accepted FROM each peer fingerprint.
    #[serde(default)]
    last_rx: HashMap<String, u64>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct PairRequest {
    pub fingerprint: String,
    pub public_key: String,
    pub name: String,
    pub address: String,
    #[serde(default)]
    pub code: String,
}

#[derive(Default)]
pub struct LanSyncInner {
    /// Per-peer reply bodies (dev.19): fingerprint -> sealed-body plaintext.
    /// Each entry carries our snapshot PLUS our ack map for that peer, so the
    /// peer's three-way merge has a common ancestor in BOTH directions.
    pub snapshot: Arc<Mutex<HashMap<String, String>>>,
    /// Decrypted snapshots pushed by peers, waiting for the frontend to drain.
    pub inbox: Arc<Mutex<Vec<String>>>,
    /// Incoming pairing requests awaiting USER approval.
    pub pair_requests: Arc<Mutex<Vec<PairRequest>>>,
    /// Current pairing code shown on this device (empty = pairing closed).
    pub pairing_code: Arc<Mutex<String>>,
    /// Persistent identity (secret_key_hex, public_key_hex).
    pub identity: Arc<Mutex<Option<(String, String)>>>,
    /// Trusted peers + rx counters (persisted).
    pub trust: Arc<Mutex<TrustStore>>,
    /// Directory for identity/trust files.
    pub data_dir: Arc<Mutex<PathBuf>>,
    /// Port the current listener is bound to (None = not running).
    pub active_port: Arc<Mutex<Option<u16>>>,
    /// dev.19: when false, every sync/pair endpoint rejects immediately and
    /// ping reports unavailable — disabling sync exposes NO sync endpoints
    /// without the fragile accept-loop shutdown/rebind cycle.
    pub enabled: Arc<Mutex<bool>>,
    /// Sender used to stop the listener thread.
    pub shutdown: Arc<Mutex<Option<std::sync::mpsc::Sender<()>>>>,
}

pub type LanSyncManaged = Arc<LanSyncInner>;

fn json_header() -> Header {
    Header::from_bytes(&b"Content-Type"[..], &b"application/json"[..]).unwrap()
}

fn err_json(msg: &str) -> String {
    serde_json::json!({ "ok": false, "error": msg }).to_string()
}

fn identity_file(dir: &std::path::Path) -> PathBuf {
    dir.join("lan-identity.json")
}
fn trust_file(dir: &std::path::Path) -> PathBuf {
    dir.join("lan-trusted.json")
}

fn load_or_create_identity(dir: &std::path::Path) -> Result<(String, String), String> {
    std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    let path = identity_file(dir);
    if let Ok(raw) = std::fs::read_to_string(&path) {
        if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&raw) {
            if let (Some(sk), Some(pk)) = (parsed["secretKey"].as_str(), parsed["publicKey"].as_str()) {
                return Ok((sk.to_string(), pk.to_string()));
            }
        }
    }
    let (sk, pk) = crypto::generate_identity();
    let payload = serde_json::json!({
        "secretKey": sk,
        "publicKey": pk,
        "createdAt": chrono_now(),
        "note": "LAN sync device identity — keep private"
    });
    std::fs::write(&path, serde_json::to_string_pretty(&payload).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
    Ok((sk, pk))
}

fn load_trust(dir: &std::path::Path) -> TrustStore {
    std::fs::read_to_string(trust_file(dir))
        .ok()
        .and_then(|raw| serde_json::from_str(&raw).ok())
        .unwrap_or_default()
}

fn persist_trust(dir: &std::path::Path, trust: &TrustStore) {
    if let Ok(json) = serde_json::to_string_pretty(trust) {
        let _ = std::fs::write(trust_file(dir), json);
    }
}

fn chrono_now() -> String {
    // No chrono dependency; unix millis is enough for addedAt metadata.
    format!("{}ms", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis()).unwrap_or(0))
}

/// Load (or create) the persistent device identity WITHOUT starting the LAN
/// server. Used by the Device Center so the public fingerprint is visible
/// even when sync is disabled. Private keys stay on disk; only the public
/// fingerprint/public key are returned to the frontend.
#[tauri::command]
pub fn lan_sync_ensure_identity(state: State<LanSyncManaged>, app: AppHandle) -> Result<serde_json::Value, String> {
    if state.identity.lock().map_err(|_| "lock")?.is_some() {
        return lan_sync_identity(state);
    }
    let mut dir: PathBuf = app.path().app_data_dir().map_err(|e| e.to_string())?;
    if let Ok(profile) = std::env::var("WIH_PROFILE") {
        let profile = profile.trim();
        if !profile.is_empty() && profile.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_') {
            dir = dir.join(profile);
        }
    }
    *state.data_dir.lock().map_err(|_| "lock")? = dir.clone();
    let identity = load_or_create_identity(&dir)?;
    *state.identity.lock().map_err(|_| "lock")? = Some(identity.clone());
    if state.trust.lock().map_err(|_| "lock")?.peers.is_empty() {
        *state.trust.lock().map_err(|_| "lock")? = load_trust(&dir);
    }
    let (_sk, public_key) = identity;
    let fp = crypto::fingerprint(&public_key)?;
    Ok(serde_json::json!({
        "fingerprint": fp,
        "fingerprintFormatted": crypto::format_fingerprint(&fp),
        "publicKey": public_key,
    }))
}

#[tauri::command]
pub fn lan_sync_start(state: State<LanSyncManaged>, app: AppHandle, port: u16) -> Result<String, String> {
    let mut dir: PathBuf = app.path().app_data_dir().map_err(|e| e.to_string())?;
    // Multi-profile instances (WIH_PROFILE) keep identity + trust separate.
    if let Ok(profile) = std::env::var("WIH_PROFILE") {
        let profile = profile.trim();
        if !profile.is_empty() && profile.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_') {
            dir = dir.join(profile);
        }
    }
    *state.data_dir.lock().map_err(|_| "lock")? = dir.clone();
    let identity = load_or_create_identity(&dir)?;
    *state.identity.lock().map_err(|_| "lock")? = Some(identity);
    let trust = load_trust(&dir);
    *state.trust.lock().map_err(|_| "lock")? = trust;

    // Already running on this port? Keep the existing listener (the frontend
    // restarts its LOOP on config changes; the server must survive that).
    if state.active_port.lock().map(|p| *p == Some(port)).unwrap_or(false) {
        if let Ok(mut e) = state.enabled.lock() {
            *e = true;
        }
        return Ok("already-running".into());
    }
    // Stop any running listener first. The listener blocks on accept, so a
    // self-connect is needed to unblock it and release the old port.
    if let Ok(mut guard) = state.shutdown.lock() {
        if let Some(tx) = guard.take() {
            let _ = tx.send(());
            let _ = ureq::get(&format!("http://127.0.0.1:{}/wih/ping", state.active_port.lock().ok().and_then(|p| *p).unwrap_or(port)))
                .timeout(std::time::Duration::from_secs(2))
                .call();
            std::thread::sleep(std::time::Duration::from_millis(300));
        }
    }
    let (tx, rx) = std::sync::mpsc::channel::<()>();
    let snapshot = state.snapshot.clone();
    let inbox = state.inbox.clone();
    let pair_requests = state.pair_requests.clone();
    let trusted = state.trust.clone();
    let pairing_code = state.pairing_code.clone();
    let identity = state.identity.clone();
    let data_dir = state.data_dir.clone();
    let enabled_flag = state.enabled.clone();
    let mut request_log: Vec<std::time::Instant> = Vec::new();
    // Bind synchronously WITH retries: the previous listener may still be
    // releasing the port when the frontend restarts the loop (config change,
    // page reload). A silent bind failure left the device with no server.
    let server = {
        let mut attempt = None;
        for _ in 0..40 {
            match Server::http(("0.0.0.0", port)) {
                Ok(s) => {
                    attempt = Some(s);
                    break;
                }
                Err(_) => std::thread::sleep(std::time::Duration::from_millis(250)),
            }
        }
        attempt.ok_or_else(|| format!("could not bind port {} — another process may be using it", port))?
    };
    std::thread::spawn(move || {
        for mut request in server.incoming_requests() {
            if rx.try_recv().is_ok() {
                break;
            }
            // Rate limit: reject bursts instead of saturating the device.
            let now = std::time::Instant::now();
            request_log.retain(|t| now.duration_since(*t).as_secs() < 60);
            if request_log.len() >= RATE_LIMIT {
                let _ = request.respond(
                    Response::from_string(err_json("rate-limited")).with_status_code(429).with_header(json_header()),
                );
                continue;
            }
            request_log.push(now);
            let method = request.method().clone();
            let url = request.url().to_string();
            let remote = request.remote_addr().map(|a| a.to_string()).unwrap_or_default();
            let mut body = String::new();
            if method == Method::Post {
                let mut limited = request.as_reader().take((MAX_BODY + 1) as u64);
                if limited.read_to_string(&mut body).is_err() || body.len() > MAX_BODY {
                    let _ = request
                        .respond(Response::from_string(err_json("body-too-large")).with_status_code(413).with_header(json_header()));
                    continue;
                }
            }
            let path = url.split('?').next().unwrap_or("").to_string();
            let reply = |request: tiny_http::Request, status: u16, payload: String| {
                let _ = request.respond(Response::from_string(payload).with_status_code(status).with_header(json_header()));
            };
            let sync_enabled = enabled_flag.lock().map(|e| *e).unwrap_or(false);
            match (method, path.as_str()) {
                (Method::Get, "/wih/ping") => {
                    // Deliberately minimal: app discovery only, no data, no identity.
                    // Reports unavailable while sync is disabled so peers stop early.
                    let payload = if sync_enabled {
                        serde_json::json!({ "ok": true, "app": APP_TAG })
                    } else {
                        serde_json::json!({ "ok": false, "error": "sync-disabled" })
                    };
                    reply(request, 200, payload.to_string());
                }
                (Method::Post, "/wih/pair") if !sync_enabled => {
                    reply(request, 403, err_json("sync-disabled"));
                }
                (Method::Post, "/wih/pair") => {
                    // Code-gated; queued for USER approval — never auto-trusted.
                    let expected = pairing_code.lock().map(|g| g.clone()).unwrap_or_default();
                    let parsed = serde_json::from_str::<PairRequestBody>(&body).ok();
                    let code_ok = !expected.is_empty() && parsed.as_ref().map(|p| p.code == expected).unwrap_or(false);
                    let pk = parsed.filter(|p| crypto::fingerprint(&p.publicKey).is_ok());
                    if code_ok {
                        if let Some(pk) = pk {
                            let fp = crypto::fingerprint(&pk.publicKey).unwrap_or_default();
                            let mut q = pair_requests.lock().unwrap_or_else(|e| e.into_inner());
                            // One pending request per fingerprint: rebroadcasts replace.
                            q.retain(|r| r.fingerprint != fp);
                            let advertised = sanitize_origin(&pk.listenAddress);
                            q.push(PairRequest {
                                fingerprint: fp,
                                public_key: pk.publicKey,
                                name: sanitize_name(&pk.name),
                                address: if advertised.is_empty() { strip_port(&remote) } else { advertised },
                                code: String::new(),
                            });
                            // Reply carries OUR public key + name so the requester can derive the
                            // channel key and display our fingerprint for verification.
                            let (own_sk, own_pk) = identity.lock().map(|g| g.clone()).unwrap_or(None).unwrap_or((String::new(), String::new()));
                            // Peer display name arrives later via snapshots; pairing reply keeps it optional.
                            let own_name: Option<String> = None;
                            reply(request, 200, serde_json::json!({ "ok": true, "publicKey": own_pk, "name": own_name }).to_string());
                        } else {
                            reply(request, 400, err_json("bad-request"));
                        }
                    } else {
                        reply(request, 403, err_json("bad-code"));
                    }
                }
                (Method::Post, "/wih/sync") if !sync_enabled => {
                    reply(request, 403, err_json("sync-disabled"));
                }
                (Method::Post, "/wih/sync") => {
                    let ok = (|| -> Result<String, String> {
                        let ident = identity.lock().map_err(|_| "lock")?.clone().ok_or("no identity")?;
                        let own_fp = crypto::fingerprint(&ident.1)?;
                        let env: crypto::Envelope = serde_json::from_str(&body).map_err(|_| "malformed envelope")?;
                        let mut trust = trusted.lock().map_err(|_| "lock")?;
                        let peer = trust
                            .peers
                            .iter()
                            .find(|p| p.fingerprint == env.from)
                            .cloned()
                            .ok_or("untrusted-device")?;
                        let last = trust.last_rx.get(&env.from).copied().unwrap_or(0);
                        let key = crypto::channel_key(&ident.0, &peer.public_key, &own_fp, &peer.fingerprint)?;
                        let (plaintext, counter) = crypto::open(&key, &body, &peer.fingerprint, &own_fp)?;
                        if counter <= last {
                            return Err("replay-detected".to_string());
                        }
                        trust.last_rx.insert(env.from.clone(), counter);
                        // Reply with our own snapshot, sealed to the same peer
                        // under our next tx counter (single round-trip exchange).
                        let mut peer_mut = trust.peers.iter_mut().find(|p| p.fingerprint == env.from).ok_or("untrusted-device")?;
                        peer_mut.tx_counter += 1;
                        let tx_counter = peer_mut.tx_counter;
                        persist_trust(data_dir.lock().map_err(|_| "lock")?.as_path(), &trust);
                        drop(trust);
                        let snap = snapshot
                            .lock()
                            .ok()
                            .and_then(|g| g.get(&env.from).cloned())
                            .unwrap_or_else(|| "{}".into());
                        // Inbox entries keep the sender fingerprint so the
                        // frontend can merge with the right peer state.
                        let entry = serde_json::json!({ "from": env.from, "payload": plaintext }).to_string();
                        if let Ok(mut q) = inbox.lock() {
                            q.push(entry);
                            if q.len() > 20 {
                                let excess = q.len() - 20;
                                q.drain(0..excess);
                            }
                        }
                        let reply_env = crypto::seal(&key, &snap, &own_fp, &peer.fingerprint, tx_counter)?;
                        Ok(reply_env)
                    })();
                    match ok {
                        Ok(reply_env) => reply(request, 200, reply_env),
                        Err(e) => reply(request, 403, err_json(&e)),
                    }
                }
                _ => reply(request, 404, "{}".into()),
            }
        }
    });
    if let Ok(mut guard) = state.shutdown.lock() {
        *guard = Some(tx);
    }
    if let Ok(mut p) = state.active_port.lock() {
        *p = Some(port);
    }
    if let Ok(mut e) = state.enabled.lock() {
        *e = true;
    }
    Ok("started".into())
}

/// dev.19: disabling sync must stop exposing sync endpoints. The listener
/// itself stays bound (shutting down tiny_http's accept loop reliably is not
/// possible), but with this flag off, /wih/pair and /wih/sync reject every
/// request and /wih/ping reports the device as unavailable.
#[tauri::command]
pub fn lan_sync_set_enabled(state: State<LanSyncManaged>, enabled: bool) -> String {
    if let Ok(mut e) = state.enabled.lock() {
        *e = enabled;
    }
    if !enabled {
        if let Ok(mut c) = state.pairing_code.lock() {
            c.clear();
        }
        if let Ok(mut q) = state.pair_requests.lock() {
            q.clear();
        }
    }
    "ok".into()
}

#[derive(Deserialize)]
#[allow(non_snake_case)]
struct PairRequestBody {
    #[serde(default)]
    name: String,
    #[serde(default)]
    code: String,
    #[serde(default)]
    publicKey: String,
    /// The requester's own listen address (they know their port; we only see
    /// an ephemeral source port). Shape-validated before use.
    #[serde(default)]
    listenAddress: String,
}

fn strip_port(addr: &str) -> String {
    addr.rsplit_once(':').map(|(ip, _)| ip.to_string()).unwrap_or_else(|| addr.to_string())
}

/// Accept only http://host[:port] shapes for an advertised address.
fn sanitize_origin(raw: &str) -> String {
    let t = raw.trim().trim_end_matches('/');
    if t.starts_with("http://") && !t.contains(' ') && t.len() < 100 {
        t.to_string()
    } else {
        String::new()
    }
}

fn sanitize_name(raw: &str) -> String {
    let cleaned: String = raw.chars().filter(|c| !c.is_control()).take(40).collect();
    let trimmed = cleaned.trim();
    if trimmed.is_empty() {
        "Unnamed device".into()
    } else {
        trimmed.into()
    }
}

#[tauri::command]
pub fn lan_sync_identity(state: State<LanSyncManaged>) -> Result<serde_json::Value, String> {
    let ident = state.identity.lock().map_err(|_| "lock")?.clone().ok_or("identity not loaded (start sync first)")?;
    let fp = crypto::fingerprint(&ident.1)?;
    Ok(serde_json::json!({
        "fingerprint": fp,
        "fingerprintFormatted": crypto::format_fingerprint(&fp),
        "publicKey": ident.1,
    }))
}

/// Generate a fresh pairing code from the OS RNG; the code is valid for one
/// pairing session and pairing is CLOSED when the code is cleared.
#[tauri::command]
pub fn lan_sync_new_pairing_code(state: State<LanSyncManaged>) -> Result<String, String> {
    use rand::Rng;
    let code: String = (0..6).map(|_| rand::thread_rng().gen_range(0..10).to_string()).collect();
    *state.pairing_code.lock().map_err(|_| "lock")? = code.clone();
    Ok(code)
}

#[tauri::command]
pub fn lan_sync_close_pairing(state: State<LanSyncManaged>) -> String {
    if let Ok(mut c) = state.pairing_code.lock() {
        c.clear();
    }
    "ok".into()
}

#[tauri::command]
pub fn lan_sync_take_pair_requests(state: State<LanSyncManaged>) -> Vec<PairRequest> {
    state.pair_requests.lock().map(|mut q| std::mem::take(&mut *q)).unwrap_or_default()
}

/// Approve a pairing request from the UI. The UI passes the request's public
/// key and name (it holds the displayed request); the fingerprint is verified
/// against the key here, so approval cannot be forged for a different key.
/// The queued entry (if still present) is consumed — polling drains the queue
/// concurrently, so approval must NOT depend on the entry still being queued.
#[tauri::command]
pub fn lan_sync_approve_pair(state: State<LanSyncManaged>, fingerprint: String, public_key: String, name: String) -> Result<(), String> {
    let dir = state.data_dir.lock().map_err(|_| "lock")?.clone();
    let derived = crypto::fingerprint(&public_key)?;
    if derived != fingerprint {
        return Err("fingerprint does not match key".into());
    }
    if let Ok(mut reqs) = state.pair_requests.lock() {
        reqs.retain(|r| r.fingerprint != fingerprint);
    }
    let mut trust = state.trust.lock().map_err(|_| "lock")?;
    if !trust.peers.iter().any(|p| p.fingerprint == fingerprint) {
        trust.peers.push(TrustedPeer {
            fingerprint,
            public_key,
            name: sanitize_name(&name),
            added_at: chrono_now(),
            tx_counter: 0,
        });
    }
    persist_trust(&dir, &trust);
    Ok(())
}

#[tauri::command]
pub fn lan_sync_deny_pair(state: State<LanSyncManaged>, fingerprint: String) -> String {
    if let Ok(mut q) = state.pair_requests.lock() {
        q.retain(|r| r.fingerprint != fingerprint);
    }
    "ok".into()
}

#[tauri::command]
pub fn lan_sync_trusted(state: State<LanSyncManaged>) -> Vec<serde_json::Value> {
    state
        .trust
        .lock()
        .map(|t| {
            t.peers
                .iter()
                .map(|p| {
                    serde_json::json!({
                        "fingerprint": p.fingerprint,
                        "fingerprintFormatted": crypto::format_fingerprint(&p.fingerprint),
                        "name": p.name,
                        "addedAt": p.added_at,
                    })
                })
                .collect()
        })
        .unwrap_or_default()
}

/// Removing trust must stop all future sync until the device is re-paired.
#[tauri::command]
pub fn lan_sync_revoke(state: State<LanSyncManaged>, fingerprint: String) -> Result<(), String> {
    let dir = state.data_dir.lock().map_err(|_| "lock")?.clone();
    let mut trust = state.trust.lock().map_err(|_| "lock")?;
    trust.peers.retain(|p| p.fingerprint != fingerprint);
    trust.last_rx.remove(&fingerprint);
    persist_trust(&dir, &trust);
    Ok(())
}

/// Outbound pairing: exchange our identity for the peer's under a pairing
/// code. Returns the peer's fingerprint so BOTH UIs can display it for
/// out-of-band comparison.
#[tauri::command]
pub fn lan_sync_pair_peer(state: State<LanSyncManaged>, url: String, code: String, name: String, listen_address: String) -> Result<serde_json::Value, String> {
    let ident = state.identity.lock().map_err(|_| "lock")?.clone().ok_or("identity not loaded (start sync first)")?;
    let base = url.trim_end_matches('/').to_string();
    let own_fp = crypto::fingerprint(&ident.1)?;
    let payload = serde_json::json!({ "name": name, "code": code, "publicKey": ident.1, "listenAddress": listen_address }).to_string();
    let res = ureq::post(&format!("{}/wih/pair", base))
        .timeout(std::time::Duration::from_secs(6))
        .send_string(&payload)
        .map_err(|e| e.to_string())?;
    let mut out = String::new();
    res.into_reader().read_to_string(&mut out).map_err(|e| e.to_string())?;
    let parsed: serde_json::Value = serde_json::from_str(&out).map_err(|_| "malformed pairing response")?;
    if parsed["ok"].as_bool() != Some(true) {
        return Err("pairing rejected".into());
    }
    let peer_pk = parsed["publicKey"].as_str().ok_or("pairing response missing key")?;
    let peer_fp = crypto::fingerprint(peer_pk)?;
    let dir = state.data_dir.lock().map_err(|_| "lock")?.clone();
    let mut trust = state.trust.lock().map_err(|_| "lock")?;
    if !trust.peers.iter().any(|p| p.fingerprint == peer_fp) {
        trust.peers.push(TrustedPeer {
            fingerprint: peer_fp.clone(),
            public_key: peer_pk.to_string(),
            name: sanitize_name(parsed["name"].as_str().unwrap_or("Unnamed device")),
            added_at: chrono_now(),
            tx_counter: 0,
        });
    }
    persist_trust(&dir, &trust);
    Ok(serde_json::json!({
        "fingerprint": peer_fp,
        "fingerprintFormatted": crypto::format_fingerprint(&peer_fp),
        "name": sanitize_name(parsed["name"].as_str().unwrap_or("Unnamed device")),
        "ownFingerprint": own_fp,
    }))
}

/// One encrypted exchange with a peer: send our snapshot, receive theirs.
/// `fingerprint` selects the trusted peer (frontend owns address pairing);
/// all secrecy/authenticity is enforced by the channel key, not by this hint.
#[tauri::command]
pub fn lan_sync_exchange(state: State<LanSyncManaged>, url: String, fingerprint: String, snapshot: String) -> Result<String, String> {
    let ident = state.identity.lock().map_err(|_| "lock")?.clone().ok_or("identity not loaded")?;
    let base = url.trim_end_matches('/').to_string();
    let own_fp = crypto::fingerprint(&ident.1)?;

    let dir = state.data_dir.lock().map_err(|_| "lock")?.clone();
    let (envelope, peer_fp) = {
        let trust = state.trust.lock().map_err(|_| "lock")?;
        let peer = trust.peers.iter().find(|p| p.fingerprint == fingerprint).ok_or("untrusted-device")?.clone();
        let key = crypto::channel_key(&ident.0, &peer.public_key, &own_fp, &peer.fingerprint)?;
        let env = crypto::seal(&key, &snapshot, &own_fp, &peer.fingerprint, peer.tx_counter + 1)?;
        (env, peer.fingerprint)
    };

    let res = ureq::post(&format!("{}/wih/sync", base))
        .timeout(std::time::Duration::from_secs(12))
        .send_string(&envelope)
        .map_err(|e| match e {
            ureq::Error::Status(403, _) => "peer rejected this exchange (not trusted there / revoked?)".to_string(),
            other => other.to_string(),
        })?;
    let mut out = String::new();
    res.into_reader().read_to_string(&mut out).map_err(|e| e.to_string())?;

    // Decrypt the reply (sealed by the peer to us) and advance counters.
    let mut trust = state.trust.lock().map_err(|_| "lock")?;
    let peer = trust.peers.iter_mut().find(|p| p.fingerprint == peer_fp).ok_or("untrusted-device")?;
    let key = crypto::channel_key(&ident.0, &peer.public_key, &own_fp, &peer.fingerprint)?;
    let (plaintext, counter) = crypto::open(&key, &out, &peer.fingerprint, &own_fp)?;
    let last = trust.last_rx.get(&peer_fp).copied().unwrap_or(0);
    if counter <= last {
        return Err("replay-detected".into());
    }
    trust.last_rx.insert(peer_fp.clone(), counter);
    if let Some(pm) = trust.peers.iter_mut().find(|x| x.fingerprint == peer_fp) {
        pm.tx_counter += 1;
    }
    persist_trust(&dir, &trust);
    Ok(plaintext)
}

#[tauri::command]
pub fn lan_sync_stop(state: State<LanSyncManaged>) -> String {
    let port = state.active_port.lock().ok().and_then(|p| *p);
    if let Ok(mut guard) = state.shutdown.lock() {
        if let Some(tx) = guard.take() {
            let _ = tx.send(());
        }
    }
    if let Some(port) = port {
        let _ = ureq::get(&format!("http://127.0.0.1:{}/wih/ping", port))
            .timeout(std::time::Duration::from_secs(2))
            .call();
    }
    if let Ok(mut p) = state.active_port.lock() {
        *p = None;
    }
    "stopped".into()
}

#[tauri::command]
pub fn lan_sync_set_snapshot(state: State<LanSyncManaged>, snapshots: Vec<(String, String)>) -> String {
    if let Ok(mut g) = state.snapshot.lock() {
        *g = snapshots.into_iter().collect::<HashMap<_, _>>();
    }
    "ok".into()
}

#[tauri::command]
pub fn lan_sync_take_inbox(state: State<LanSyncManaged>) -> Vec<String> {
    state.inbox.lock().map(|mut q| std::mem::take(&mut *q)).unwrap_or_default()
}

#[tauri::command]
pub fn lan_sync_ping_peer(url: String) -> Result<String, String> {
    let base = url.trim_end_matches('/').to_string();
    let res = ureq::get(&format!("{}/wih/ping", base))
        .timeout(std::time::Duration::from_secs(4))
        .call()
        .map_err(|e| e.to_string())?;
    let mut body = String::new();
    res.into_reader().read_to_string(&mut body).map_err(|e| e.to_string())?;
    Ok(body)
}

#[tauri::command]
pub fn lan_sync_local_address(port: u16) -> String {
    // Best-effort primary LAN address: a UDP "connect" picks the outbound
    // interface without sending packets.
    let ip = UdpSocket::bind("0.0.0.0:0")
        .and_then(|s| {
            s.connect("10.254.254.254:1")?;
            s.local_addr()
        })
        .map(|a| a.ip().to_string())
        .unwrap_or_else(|_| "127.0.0.1".into());
    format!("http://{}:{}", ip, port)
}

/// Verify a fingerprint string shape (used by the UI before risky actions).
#[tauri::command]
pub fn lan_sync_fingerprint_valid(fingerprint: String) -> bool {
    fingerprint.len() == 64 && fingerprint.bytes().all(|b| b.is_ascii_hexdigit())
}
