# Network Architecture — Local Mode and the Optional Incident Network

Status: **design document + local preview implementation** (v0.2.0-dev). Nothing in this document claims live network capability: today, everything in the app runs locally. The professional dashboard at `/network` runs against **local incidents only** with a clearly labeled "LOCAL PREVIEW" banner.

---

## 1. Two modes

| | LOCAL MODE (default, always available) | NETWORK MODE (opt-in) |
| --- | --- | --- |
| Accounts | None | Required, organization-scoped |
| Storage | Browser IndexedDB on the user's device | Local IndexedDB **plus** server replication of what the user explicitly submitted |
| Incident visibility | Only the user | Field-level visibility rules (below) |
| Location data | Stays on device unless exported | Only what the consent screen lists |
| Offline | Fully functional | Local mode fully functional; network sync queues only with a safe, explicit offline-queue architecture — the UI must never claim "submitted" while offline |

**Non-negotiable:** local mode remains complete on its own. Network mode is an *additional layer*, never a requirement. There is no silent reporting to organizations or authorities — ever.

## 2. What exists today (v0.2 preview)

- `src/features/network/networkService.ts` — the data model and local logic:
  - `Organization` (mock local registry, clearly unverified examples)
  - `NetworkRole` (reporter, dispatcher, responder, rehabilitator, veterinary, ranger, org_admin, reviewer) — *permission concepts*, kept strictly separate from the local UI "experience presets"
  - `ServiceArea` (center + radius; polygon/administrative regions are backend work)
  - `feedGroupFor()` — feed stages (new / active / transfer / closed)
  - `findDuplicateCandidates()` — proximity + time + type + description overlap; **detection only, never auto-merge**
  - `MapProvider` abstraction — no map vendor is hard-wired; `noneMapProvider` ships while map view remains a documented placeholder
- `src/features/network/NetworkPage.tsx` — the professional feed UI: service area, grouped feed, "Accept" (writes a real local status change + timeline event), review links, possible-duplicate warnings, distance in metric/imperial per region settings.

## 3. Future backend requirements

- **Stack-agnostic** services behind the same seams the UI already uses (repositories → services → UI). Recommended shape:
  - `auth` — org-scoped accounts, MFA for admin roles
  - `incidents` — append-only event store (same event model as local), with server-side field visibility filtering
  - `orgs` — organizations, membership, service areas (point/radius → polygon/geofence)
  - `assignments` — accept/assign/reassign with timeline events
  - `attachments` — content-addressed storage, virus scanning, retention rules
  - `notifications` — targeted, user-controlled: new incident in service area, assigned to you, reporter update, transfer ready, handoff accepted. No spam channels.
  - `audit` — incident submitted/viewed/assignment changed/custody changed/handoff completed/sensitive field changed/closed; minimal personal data in logs
- **Data compatibility:** a network submission starts from the same versioned incident format (`schemaVersion`) the local app already stores, so import/export/backups remain the compatibility contract.

## 4. Privacy model (network mode)

Field-level visibility — never "logged in ⇒ sees everything":

| Level | Sees |
| --- | --- |
| PUBLIC | General incident area, animal type, status |
| RESPONDER | Precise location, reporter communication channel, full observations |
| RECEIVING FACILITY | Handoff information, custody history, attachments |
| ADMIN | Operational/audit information |

Additional commitments:

- **Submission consent screen** (mandatory): names the receiving organization, lists exactly what will be sent (✓ observations ✓ animal details ✓ photos ✓ exact incident location) with optional toggles for name/phone/email, and states plainly: "This information will leave your device." Deliberate confirmation required.
- **Sensitive locations**: redacted for lower visibility levels; sensitive-species protection hooks already exist in the local data model (`precision: "sensitive"`).
- **Retention & deletion**: documented per organization; reporter can request deletion; already-recorded network history is never silently erased (updates/withdrawals are new events).
- **Withdraw / update**: reporters can update, report "animal no longer present", correct location, or withdraw a request — as new timeline events, never as rewrites.
- **Communication**: incident-scoped message threads / relay (future) so responders can ask "is the animal still there?" without exposing personal phone/email.
- **No emergency dispatch**: if there is immediate danger to people, the UI says to contact local emergency services. This product is wildlife-response coordination, not emergency services or enforcement tooling — no surveillance, tracking, or profiling features.

## 5. Jurisdiction awareness

Organizations belong to a country, region, and service area, with flexible organization types (wildlife rehabilitation, animal welfare, veterinary, conservation, protected-area management, municipal, wildlife authority, emergency/public safety, research, other). Role titles and legal authority differ by country — the data model never assumes one country's structure. Service-area lookup ("this incident can be sent to Example Wildlife Rescue — confirm?") is the long-term routing goal; until a real verified directory exists, nothing in the UI presents any registry as authoritative.

## 6. What would make the preview real

1. Implement the backend services above with authentication and the audit log.
2. Add the submission consent screen and the offline-queue design (with honest "queued, not submitted" states).
3. Ship a verified organization directory process — verification is an operational commitment, not a checkbox.
4. Choose a map provider that satisfies the privacy model; implement `MapProvider` against it.
5. Add integration tests for field-visibility filtering and consent flow before any real submission path is enabled.
