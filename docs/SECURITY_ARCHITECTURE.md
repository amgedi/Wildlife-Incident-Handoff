# Security Architecture

Status: current for 0.2.0-dev.8. This document describes the security and
privacy posture of Wildlife Incident Handoff today (local-first, no backend)
and the threat model that the future network layer must satisfy.

## Current posture (local-first, no server)

- **No account, no server.** Incident records, media, drafts and settings
  live only in the browser's IndexedDB on the user's device (or the Tauri
  WebView2 profile directory on desktop).
- **Network requests the app can make:**
  - Map raster tiles from `https://tile.openstreetmap.org` (only when online
    maps are enabled in Settings → Map; viewport/zoom context is exposed to
    the tile provider, never incident coordinates).
  - GitHub Releases API update check (Settings → About; no user data sent).
  - Local development servers during development.
- **No telemetry.** There is no analytics, no logging endpoint, no crash
  reporter. Diagnostics bundles are built client-side and only leave the
  device when the user pastes them somewhere.

## Threat model (today)

| Threat | Mitigation |
| --- | --- |
| XSS through user content | React escapes all rendered strings by default; no `dangerouslySetInnerHTML` on user data in the codebase. |
| Malicious attachments | Media is stored as opaque blobs and rendered via `<img>`/`<video>` with object URLs; never executed, never inlined into HTML. |
| Precise location privacy | Per-report precision (exact/approximate/sensitive) enforced in exports and map markers via deterministic fuzzing (`mapProvider.fuzzCoordinates`). |
| Contact privacy | Contacts are `markedPrivate` by default; shareable exports redact them unless explicitly included. |
| Logs leaking private data | Console output is limited to section-error messages (no user content). Diagnostics bundles contain versions/counts only. |
| Local device compromise | Out of scope for a local-first app; documented honestly (no encryption at rest beyond OS-level protections). |

Desktop shell (Tauri 2):

- CSP: `default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'`.
- Capabilities are limited to core, dialog, scoped fs access and window
  controls (minimize/maximize/close/drag). No shell/open, no broad fs.
- Custom titlebar uses window API only; no remote content is loaded.

## Threat model (future network layer)

The response-network backend described in `NETWORK_SECURITY_AND_AUTH_PLAN.md`
must additionally address:

- **Spam and bots**: server-side rate limits per IP and per account, payload
  and attachment limits, duplicate/velocity detection, abuse monitoring, and
  optional risk-triggered CAPTCHA (Turnstile/hCaptcha). CAPTCHA must never be
  the only control; aggressive fingerprinting is out of policy.
- **Fake responder accounts / unauthorized professional access**: server-side
  authorization only (see below). No client state is ever trusted.
- **Attachment abuse**: server-side type validation, size caps, virus
  scanning where available, and per-account quotas.
- **Session theft**: short-lived tokens, secure httpOnly cookies, rotation on
  privilege changes.
- **Organization permissions**: roles (reporter, verified responder,
  dispatcher, rehabilitator, veterinary professional, organization member,
  organization administrator, read-only reviewer) enforced server-side on
  every request; organization-admin approval flows for membership.
- **Audit logs**: append-only server-side audit trail for authorization
  decisions, handoffs and exports on the network.

## Authorization separation (implemented locally)

`src/features/network/authorization.ts` is the single seam between UI
workspace and security authorization:

- Switching workspace in Settings or onboarding only changes the interface.
- `getAuthorizationState()` always returns "unverified" until a real server
  issues claims; the UI labels professional mode "Professional Preview".
- A work email alone never verifies anyone.

## dev.8 additions

- **Professional roles are presentation-only.** `professionalRoles` in local
  settings are always labeled Professional Preview; `capabilitiesForRoles()`
  returns capabilities only for state "verified", which cannot occur locally.
  Role verification requirements are displayed only for the role being added
  (data minimization, P11).
- **Support composer is honest:** nothing is ever transmitted; it prepares a
  copy/download bundle. Diagnostics exclude name/email/phone/coordinates/
  incident content unless the user explicitly includes them.
- **Map diagnostics** (`getMapDiagnostics`) record HTTP status / error class
  only — never coordinates, URLs with query data, or incident content
  (asserted by tests).
- **Mobile shell:** the drawer keeps one bounded scroll owner
  (`.main-area`), so overlays cannot trap the page scroll.

## Hardening checklist (current code)

- [x] No `dangerouslySetInnerHTML` on user content.
- [x] Exports are user-triggered only; privacy preview before every export.
- [x] Deep links limited to internal routes; unknown routes fall back to Home.
- [x] No secrets or API keys embedded in the client.
- [x] Error boundaries catch render failures without exposing user data.
- [x] Factory reset requires warn + deliberate confirmation.


## dev.18 threat-model update (2026-10-03)

New/changed surfaces since this document was last current, and their
posture:

- **Reverse geocoding** (`src/features/network/geocoding.ts`): the only
  outbound coordinate traffic besides tiles. Sensitive incidents are blocked
  outright; approximate incidents send only the ~1 km generalized
  coordinate; exact incidents require explicit consent (rememberable).
  Provider (Nominatim) sees a single coordinate per approved lookup, never
  incident descriptions, references or identity. Results cached locally.
- **Verification/role evidence**: only free-text notes + a document NAME are
  stored (local settings). The document itself is never stored, exported,
  synced or backed up. See
  `docs/PROFESSIONAL_VERIFICATION_ARCHITECTURE.md` for the connected-design
  constraints (OS-protected storage, opaque ids, explicit backup opt-in).
- **LAN sync**: EXPERIMENTAL, off by default; trust gate rejects untrusted
  device ids before serving data; transport still plaintext (documented in
  `docs/LAN_SYNC_SECURITY.md`). Sync payloads include exact coordinates of
  trusted-shared incidents by design.
- **Photos/videos**: IndexedDB blob store, leave the device only via
  explicit backups (hash-verified) or user-chosen exports (attachments
  exported as an index, never embedded).
- **Backup packages**: single JSON with manifest + per-record SHA-256;
  import validates structure AND integrity before writing anything
  (staged restore; records missing from the manifest are rejected, not
  trusted). Legacy manifest-less backups import structurally.
- **Offline map packs**: not implemented; when they are, packs must be
  hash-verified before activation (see `docs/OFFLINE_MAPS_EVALUATION.md`).
- **Desktop notifications**: OS-delivered toasts carry title/body of locally
  generated notifications only; no remote content path exists.
- **Support diagnostics**: unchanged — counts and environment only; verified
  in dev.15 and re-audited in dev.18 (no coordinates, contacts, evidence,
  media or descriptions).
