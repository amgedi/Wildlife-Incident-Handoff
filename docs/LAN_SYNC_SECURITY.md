# LAN Sync Security & Threat Model (0.2.0-dev.19, protocol v3)

## What LAN sync is

Optional, desktop-only, device-to-device exchange of incident records over the
local network. No internet, no cloud, no relay. Each device runs a small HTTP
server (`tiny_http`) on `0.0.0.0:<port>` (default 47618) while LAN sync is
enabled in Settings.

## Why v3 exists

dev.15–dev.18 authenticated peers with a plaintext `X-WIH-Device` UUID header
on plain HTTP. Anyone on the LAN could read another device's header (or just
try UUIDs) and gain full read/write of incident records, including private
notes. That was disclosed honestly as an EXPERIMENTAL gap; v3 replaces it.

## Identity

- Every installation generates a persistent **P-256 keypair** the first time
  LAN sync starts. The private key never leaves the device (stored in the app
  data directory, `lan-identity.json`); it is generated and used only by the
  Rust process — the webview cannot export it.
- The **fingerprint** (SHA-256 of the public key, hex) is what users see and
  compare out-of-band during pairing. The friendly name ("Field Laptop") is
  decorative only and proves nothing.

## Pairing

1. Device A enables LAN sync; it shows a **6-digit pairing code** (OS CSPRNG)
   and its fingerprint. Pairing is open only while that session code exists;
   turning sync off closes it.
2. Device B enters A's address + code. B's real public key travels in the
   pair request. A validates the code and **queues the request for explicit
   user approval** — a correct code never grants trust by itself.
3. A's user sees B's name + fingerprint + address and chooses
   **Trust device / Deny**. Approving stores B's public key.
4. Both sides now display the peer's fingerprint so users can compare
   out-of-band (defeats MITM at pairing time).

Discovery never implies trust. Unpaired devices get `403` and **no data** —
not even incident metadata.

## Transport & request authorization

- Every `/wih/sync` request is an **AES-256-GCM sealed envelope**. The channel
  key is **static-static ECDH (P-256) → HKDF-SHA256**, with the HKDF salt/info
  binding both fingerprints, so a key derived against the wrong peer identity
  cannot decrypt anything.
- The AEAD **additional authenticated data** binds sender fingerprint,
  recipient fingerprint and a monotonic counter; the server rejects counters
  it has already seen (**replay protection**). Counters are persisted, so a
  restart cannot rewind them.
- Plaintext exists only inside each device; the LAN never sees incident data.
- Each sealed payload carries our snapshot **plus our ack map** (what we last
  saw of the peer's records), and the reply carries ours — the three-way merge
  on both sides gets a common ancestor in both directions.
- **Acks compare content versions, not timestamps** (dev.19): a record's
  version is a deterministic hash of its content (per-device sync stamps
  excluded). Two different edits can share a timestamp (Windows clock
  granularity is ~15 ms); timestamp-only acks would mistake "peer has my
  version" for "peer made a different edit". The common ancestor is never
  rewritten on skip, so a real conflict can not be defused by a stale
  snapshot.
- `GET /wih/sync` and the old plaintext header protocol were **removed**.
- `/wih/ping` remains intentionally open: it returns a static app tag and no
  data (discovery ≠ authorization). While sync is DISABLED it reports the
  device unavailable, and every sync/pair endpoint rejects with 403.

## Trust store & revocation

- Trusted peers (fingerprint, public key, name, tx/rx counters) persist in the
  app data directory (`lan-trusted.json`), surviving restarts.
- **Remove trust** deletes the peer locally; that device can no longer read or
  write until it is re-paired with a fresh code. Revocation is immediate —
  every request must authenticate under the channel key, which is destroyed
  with the stored peer key.

## Server scope & request safety

- Binds `0.0.0.0:<port>` while the app runs with sync configured; disabling
  sync gates every endpoint server-side (403 + closed pairing) — no sync
  endpoints are exposed while off. The listener socket itself stays bound
  while the app runs (tiny_http accept loops cannot be shut down reliably);
  this is disclosed here rather than overstated.
- Windows Firewall: the first start triggers the standard firewall prompt;
  allow it only on Private networks.
- Body cap 8 MiB (413 beyond), 60 requests/60 s rate limit (429), malformed
  input handled as 4xx, request timeouts 4–12 s. A hostile peer cannot crash
  or freeze the app; decryption failures are rejected, never unwrapped.
- Rate limiting is global (not per-IP) — a known limitation on busy networks.

## Known remaining limits (honest)

- Static-static ECDH gives forward secrecy only when peers re-pair (re-pairing
  rotates the channel key). Recorded traffic could in principle be decrypted
  if a private key is stolen AND the traffic was captured AND the peer key is
  unchanged.
- The pairing code gates the request queue, but the trust decision ultimately
  relies on the user comparing fingerprints; skipping that comparison on a
  hostile network leaves MITM-during-pairing possible.
- Media (photos/videos) is not synced — see the Settings → Sync notes.
- The feature remains labeled EXPERIMENTAL pending field QA on real networks.
