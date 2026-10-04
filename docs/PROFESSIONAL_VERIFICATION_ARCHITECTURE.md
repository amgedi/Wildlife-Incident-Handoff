# Professional Verification Architecture

Status: **design document** — no connected verification exists in the product
today (current version: 0.2.0-dev.18). Nothing in this document is implemented
as a live network flow. The application must never imply otherwise in its UI.

## Current state (honest)

- Professional roles run in **Professional Preview**: full UI access to the
  local workspace, zero elevated trust, no claims issued by anyone.
- The only authorization source is `getAuthorizationState()`
  (`src/features/network/authorization.ts`), which is **hard-unverified**:
  `claimsSource: "none"`, and the client has no code path that can elevate it.
- Role cards (`src/features/settings/RoleCard.tsx`) let a user **prepare
  verification evidence notes locally**. Wording says exactly that:
  "Evidence prepared locally — not submitted", "Connected verification is not
  available yet". The word *submitted* / *pending review* / *verified* is
  forbidden in this flow until a real reviewer receives the request.
- Only the free-text note and (optionally) the **file name** of a picked
  document are remembered, inside `settings.professionalRoles[].verificationRequest`.
  The document itself is never copied, uploaded, exported, synced, or included
  in backups. There is deliberately **no homemade encryption** and no document
  blob storage yet.

## Why evidence documents are not stored yet

ID cards, badges and certificates are among the most sensitive data the app
could hold. Storing them before a real verification flow exists would create
risk with no benefit. When connected verification lands, evidence storage must:

1. Store files in OS-protected per-user application data (e.g.
   `%APPDATA%/<app>/verification/` on Windows), never in the web/IndexedDB
   workspace used for incident media.
2. Never appear in incident exports, support diagnostics, LAN incident sync,
   or shareable reports; be excluded from ordinary backups unless the user
   explicitly opts in at backup time.
3. Reference stored files by opaque IDs, not raw filenames/paths, in any UI
   that lists them.
4. Delete on revoke (role removal) and offer explicit local deletion.
5. Use no homemade cryptography — rely on OS user separation; document what
   is and is not protected.

## Future connected verification (design)

### Actors

- **Professional** — the person seeking a role (e.g. field_responder).
- **Organization administrator** — approves/rejects/revokes role claims for
  their organization.
- **Verification service (server)** — holds organization membership, issues
  signed role claims, maintains the audit trail. The client can never mint
  claims; `claimsSource: "server"` only.

### Flow

1. **Organization invitation** — an administrator invites a person (email or
   one-time pairing code, reusing the LAN-pairing UX pattern where useful).
2. **Evidence** — the invitee uploads role-specific evidence
   (`ROLE_VERIFICATION_REQUIREMENTS` in `authorization.ts` already enumerates
   these per role). Evidence goes to the server over TLS, not peer-to-peer.
3. **Administrator approval** — the organization administrator reviews and
   approves/rejects. Only then does the server issue a signed role claim.
4. **Claim verification** — the client verifies the signature and sets
   `state: "verified"` for that role; capabilities then come from
   `ROLE_CAPABILITIES` server-side-enforced as well.
5. **Multi-role** — a user may hold several verified roles; each is verified
   independently and revocable independently.
6. **Revocation** — administrators revoke; the server shortens claim
   validity; clients honor revocation on next check. Local UI must drop the
   "verified" badge immediately upon revocation notice.
7. **Audit trail** — every invite, approval, rejection and revocation is
   recorded (who, when, role, evidence reference IDs — never evidence
   contents) and visible to the affected professional.

### Honest-state machine

| Local state | Allowed label | Requires |
|---|---|---|
| preview | "Professional Preview" | default |
| prepared (local notes only) | "Evidence prepared locally — not submitted" | user action, local only |
| verification_pending | "Submitted — awaiting organization review" | **server receipt** of the request |
| verified | "Verified by <organization>" | **signed server claim** |
| revoked | "Verification revoked by <organization>" | server revocation notice |

The UI must never display "Submitted", "Pending review" or "Verified" unless
the corresponding server event actually happened.

### Related documents

- `docs/SECURITY_ARCHITECTURE.md` — overall trust model.
- `docs/LAN_SYNC_SECURITY.md` — why verification never rides the LAN sync path.
- `docs/NETWORK_SECURITY_AND_AUTH_PLAN.md` — the future server/auth stack.
