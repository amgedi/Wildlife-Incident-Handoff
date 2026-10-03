# LAN Sync Security & Threat Model (0.2.0-dev.15)

## What LAN sync is

Optional, desktop-only, device-to-device exchange of incident records over the
local network. No internet, no cloud, no relay. Each device runs a small HTTP
server (`tiny_http`) on `0.0.0.0:<port>` (default 47618) while LAN sync is
enabled in Settings.

## Trust model

- **Device identity**: every installation generates a persistent UUID
  (`deviceId`, stored in app settings). All sync requests carry it in the
  `X-WIH-Device` header. Identity is NOT derived from hostname.
- **Trust is explicit**: the server answers `/wih/sync` (read AND write) only
  for device IDs the user approved through the pairing flow. `/wih/ping` is
  intentionally open — it returns a static acknowledgement and no data
  (discovery ≠ authorization).
- **Pairing**: the receiving device shows a per-session pairing code; the
  requesting device must send `POST /wih/pair {deviceId, name, code, address}`.
  Correct code → the request is queued for **manual user approval**
  ("Trust device" / "Deny"). Approved devices are remembered; a revoked device
  can no longer read or write until re-paired.
- **Conflict safety**: both-sides-changed records become visible SYNC
  CONFLICTS; the local record is kept untouched until a human chooses
  (use mine / use the peer's / keep both). Resolutions are recorded as
  timeline events. Deleted/archived records propagate as tombstones and are
  never resurrected by a stale peer copy.

## Limits & hardening (implemented)

- 8 MB request body cap (text snapshots only; media not transferred).
- 60 requests/minute rate limit per server.
- Malformed bodies are rejected; they cannot crash the listener.
- Demo (fictional) records never sync.

## Known gaps (honest)

1. **Plaintext HTTP inside the LAN.** Sensitive content (contacts, exact
   locations, private notes) is NOT encrypted in transit yet. Risk: another
   device on the same network can passively observe traffic. Planned fix:
   TLS with device certificates issued at pairing (real crypto via an
   established TLS stack — no custom cryptography). Until then, treat LAN
   sync as appropriate for trusted office/home networks only.
2. **No media transfer yet** (photos/videos stay device-local; use backups).
3. **Discovery**: manual address + code pairing; mDNS/UDP discovery planned
   and will remain prompt-gated (never auto-trusted).
4. **Firewall exposure**: enabling LAN sync opens a listener port on the LAN.
   Windows may prompt for firewall permission. Disable LAN sync when not in
   use; the server only runs while the toggle is on.

## Data location

- Records, settings, notifications: IndexedDB inside the WebView2 user-data
  folder (`%LOCALAPPDATA%\org.wildlifeincidenthandoff.app` on desktop).
- Media: IndexedDB blob store on the same profile.
- No data is written outside the app profile; no telemetry exists.
