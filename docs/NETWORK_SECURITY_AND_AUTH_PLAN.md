# Network Security and Authentication Plan

Status: planning document (0.2.0-dev.7). **There is no backend today.** The
professional experience is explicitly a "Local Professional Preview": the
organization registry is fictional, nothing is transmitted, and no
authentication exists — fake authentication will not be implemented.

## Goal

Enable genuine multi-party wildlife response coordination (public reporters,
verified responders, dispatchers, rehabilitators, veterinarians,
organizations) without violating the project's privacy-first values.

## Non-negotiables

1. **Public reporting stays accountless.** Anyone can document injured
   wildlife locally without credentials. Submission to the network, when it
   exists, must always be an explicit user action.
2. **Authorization is server-side.** Roles and permissions are enforced by
   the backend on every request. Client-side workspace, localStorage, URL
   parameters or hidden UI state are never trusted as authorization.
3. **A work email alone never verifies anyone.** Verification requires a
   human or organizational step.
4. **No fake states.** The UI must never suggest a report was received by a
   real agency, or that a user is verified, unless the server says so.

## Verification model

- Reporter: anonymous by default; optional profile.
- Verified responder / dispatcher / rehabilitator / veterinary professional:
  claimed via **organization invitation** → **organization-admin approval**
  (or manual approval by the platform for independent professionals, with
  evidence review). Membership is revocable; roles are scoped per
  organization.
- Organization administrator: provisioned manually at onboarding of the
  organization; can invite members and assign roles within that organization.
- Read-only reviewer: granted view-only scope.

Server issues signed session claims (role, organization, scopes, expiry).
`src/features/network/authorization.ts` is the client seam that will consume
these claims; today it hard-returns "unverified".

## Architecture sketch

- Backend: stateless API with server-enforced RBAC; append-only incident
  timeline events (mirroring the local data model); per-organization service
  areas; notification fan-out.
- Incident sharing model: a local report is **pushed by explicit user
  action** (submit to network / share with organization). The server stores
  only what the user chose to include (the export privacy preview defines
  the payload contract).
- Anti-spam: per-IP and per-account rate limits, payload/attachment limits,
  duplicate and velocity detection, optional risk-triggered CAPTCHA; no
  aggressive fingerprinting.
- Audit: append-only audit log of authorization decisions and network
  handoffs.
- Privacy: coordinates stored server-side only when the reporter opted into
  "responder" or "public" sharing with coordinates; sensitive locations are
  fuzzed before upload by the client.

## Phases

1. **Phase 0 (now):** Local Professional Preview, honest labeling, this plan,
   `docs/SECURITY_ARCHITECTURE.md` threat model.
2. **Phase 1:** Account infrastructure + organization registry + invites.
3. **Phase 2:** Verified responder roles; server-enforced assignment and
   handoff flows.
4. **Phase 3:** Live network dashboard federation (dashboard reads server
   data for the user's authorized organizations only).
