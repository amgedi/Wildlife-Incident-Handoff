# dev.18 Baseline Audit (fresh, 2026-10-03)

Source of truth: repository at commit `829fb57`, launched EXE `src-tauri/target/release/wildlife-incident-handoff.exe` (0.2.0-dev.17), and the current test suite. No old completion reports were trusted.

## Verified baseline

| Item | Result |
|---|---|
| Version (package.json / tauri.conf.json / Cargo.toml) | 0.2.0-dev.17 (all three agree) |
| Git status | clean at `829fb57` |
| Unit/integration tests | 297/297 passing (25 files, 3.9 s) |
| Real EXE launch | OK — onboarding → Home renders, CDP reachable, screenshots captured (`qa/shots-dev17/`) |
| Onboarding | language picker → Skip setup → Home works live |

## 1. Tutorial system — audited

Files: `src/features/tutorial/` (`SpotlightTour.tsx`, `guidance.ts`, `tourSteps.ts`, `tourStepsTypes.ts`, `TutorialPage.tsx`).

- Step shape (`tourStepsTypes.ts`) already supports declarative `route`, `tourId`, `selectorFallback`, `waitMs`, optional `action`. `SpotlightTour.runStep` navigates via `nav(route)` before measuring — steps do NOT rely on clicking previous-step buttons.
- **Auto-skip confirmed as a silent success path**: `SpotlightTour.tsx:87–113` — missing target or zero-size rect → silently advance (last step → `onFinish()`). The `failed` phase with Retry/Skip exists in render code but is unreachable.
- **Completion recording is dishonest**: `App.tsx:283–288` passes `onFinish={() => endGuidance(true)}` — even Escape/exit marks the tour complete (`markGuidanceComplete`, `guidance.ts:16–45`). No distinction between COMPLETED / user skip / auto-skip / failure exists.
- Built-in tours: interface tour (`buildInterfaceTourSteps`, reporter+professional variants, 9–10 steps incl. a fictional `ensureTourIncident()` demo), guided-first-incident checklist page, 3-step demo-incident tour. Legacy `buildMainTourSteps()` (with old search/filters steps) is dead code still referencing removed targets.
- Search/Filters have no tour coverage anywhere (removed in dev.16/17).

## 2. Professional role verification — audited

Files: `src/features/network/authorization.ts`, `src/features/settings/RoleCard.tsx`.

- `RoleState = "preview" | "verification_pending" | "verified"`; submitting sets `verification_pending` with `{ submittedAt, note, proofName }` in `settings.professionalRoles`.
- **Misleading wording confirmed**: "Submit verification" (`RoleCard.tsx:52`), "Submit for review" (:99), badge "Verification submitted — pending review" (:38), toast "pending organization review" (:29). No reviewer/backend exists anywhere.
- **No evidence file is stored**: `RoleCard.tsx:88–97` uses a file input only to capture `files[0].name` into `proofName`; the file object is discarded. (So evidence privacy risk is currently low — but the wording implies documents were submitted.)
- Not included in backups (backups carry incidents+attachments only), LAN sync (incidents only), or diagnostics. Good.

## 3. Reverse geocoding — audited

Files: `src/features/network/locationIntel.ts`, `NetworkMap.tsx`.

- Provider: Nominatim `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=…&lon=…&zoom=18&addressdetails=1`. Fires **only on explicit button click** in the map inspector (`NetworkMap.tsx:318–350`). In-memory cache keyed to 4-decimal coords, reset per incident — no persistent cache, no rate-limit handling, no offline/failure-specific UX beyond generic error.
- **No sensitivity handling**: `LocationIntel` reads raw `incident.location.latitude/longitude` (`NetworkMap.tsx:301,345`) and geocodes raw coords regardless of `location.precision` ("exact"/"approximate"/"sensitive"). No consent dialog. Attribution "© OpenStreetMap contributors" shown on success.

## 4. Location privacy modes — audited (LEAKS FOUND)

- `location.precision` stored per incident; `fuzzCoordinates`/`markerPositionFor` in `mapProvider.ts:33–53` do deterministic 1 km / ~10 km fuzzing.
- **Leak 1 — map inspector**: raw stored lat/lon printed at 5 decimals for approximate/sensitive incidents (`NetworkMap.tsx:345`), and geocode button uses raw coords.
- **Leak 2 — exports**: `exportService.ts:103–107` gates coordinates only on `options.includeCoordinates` (INTERNAL preset = true), never on `location.precision`; HelpPage claims sensitive locations are fuzzed in exports — code does not do this.
- **Leak 3 — LAN sync**: `snapshotFrom` (`lanSync.ts:288–294`) serializes full raw coordinates for all incidents; no precision-based redaction.
- **Leak 4 — map rendering**: `NetworkPage.tsx:307,319,739` hard-code view-level `privacy="approximate"` instead of each incident's own precision, so a *sensitive* incident renders with ~1 km fuzz instead of ~10 km.
- Backups include exact coords (arguably correct for full backup; must be documented).

## 5. LAN sync — audited

Files: `src-tauri/src/lan_sync.rs`, `src/features/sync/lanSync.ts`, `docs/LAN_SYNC_SECURITY.md`.

- Transport: plain HTTP (tiny_http, `0.0.0.0:47618`), no TLS. Endpoints `/wih/ping`, `/wih/pair`, `/wih/sync`.
- Trust gate real: `/wih/sync` GET/POST return 403 `untrusted-device` for peers not in trusted list; pairing requires code match + explicit user approval ("never auto-trusted"). BUT identity is a spoofable `X-WIH-Device` UUID header — no cryptographic credential.
- Merge: v2 ack-based three-way (`mergeIncidentsV2`) with timeline union by eventId; both-changed → conflict queue + UI (mine/theirs/keep-both), never silent overwrite. v1 LWW still present.
- Tombstones: `deletedAt` propagates; merge counts/accepts tombstoned records.
- Clock skew: no explicit handling; safety rests on refusing to overwrite locally-changed records. `createdAt`/`receivedAt`/deviceId preserved in records.
- Media: NOT synced (metadata only) — documented honestly. Rate limit 60 req/min, 8 MiB body cap.
- docs/LAN_SYNC_SECURITY.md already honestly documents plaintext HTTP.

## 6. Backup / export — audited

- Backup: single JSON `wildlife-incident-handoff-backup-YYYYMMDD.json` with `schemaVersion`, incidents (incl. trash/archive) + attachments base64-embedded. No `.wihbackup`, no checksums, no manifest.
- Import: `validateBackup`/`validateIncidentRecord` shape checks only; **no hashes, no corruption detection, not transactional** (skips existing IDs, then bulkPut — crash mid-restore can leave partial import).
- Handoff export: per-incident text/HTML with INTERNAL/SHAREABLE presets; attachments listed as filenames only, never embedded.

## 7. Notifications — audited

- In-app only (`src/storage/notificationService.ts`, cap 200, quiet hours). **No Tauri notification plugin, no Web Notifications API, no permission flow.** Settings has in-app toggle with honest hint + a "Preview notification" toast (not a real system notification).

## 8. Diagnostics — audited (clean)

- ErrorBoundary copies error + component stack only. Help "support bundle" = version, schema, platform, workspace, language, theme, counts, storage usage, online status; explicitly excludes incident details/contacts/coordinates/media. No violations found.

## 9. Docs inventory (present / missing)

Present: SECURITY_ARCHITECTURE (dev.8-era), LAN_SYNC_SECURITY, NETWORK_SECURITY_AND_AUTH_PLAN, NETWORK_ARCHITECTURE, ROLE_CAPABILITY_MATRIX, WINDOWS_CODE_SIGNING (unsigned), CI_RELEASE_GATES, TESTING_GUIDE_REPORTER / _PROFESSIONAL, LOCALIZATION_COVERAGE, THIRD_PARTY_LICENSES / NOTICES, FEATURE docs, HOW_THIS_APP_WORKS.
**Missing: PROFESSIONAL_VERIFICATION_ARCHITECTURE.md; SBOM file not found in repo** (commit message claims one — needs verification/creation); security docs stale.

## 10. CI

`.github/workflows/ci.yml` exists (npm test on ubuntu + windows job).

## Baseline screenshots

`qa/shots-dev17/00-onboarding.png`, `01-home.png`, `02-myreports.png`, `03-network-map.png`.

## dev.18 gap list (drives implementation order)

1. Tour: expose tour result states (completed/user-skip/auto-skip/fail), stop marking exits as complete, standalone "Finding reports" tour, dead-code legacy steps, QA contract test that every official tour target exists (zero auto-skip).
2. Verification wording: replace submit/pending-review language with local-preparation language; remove "verified"/"pending" states from UI (keep local-only preview); document storage honestly; architecture doc.
3. Geocoding: GeocodingProvider abstraction; block sensitive, generalize approximate, consent for exact; persistent cache; rate-limit + failure UX.
4. Privacy leaks: inspector shows generalized coords for approximate/sensitive; exports fuzz by precision; sync snapshot respects precision (or documents exact-by-design with consent); map uses per-incident precision.
5. LAN sync: keep trust gate, label EXPERIMENTAL, verify default OFF, clock-skew + tombstone tests, two-instance QA.
6. Backup: checksums + manifest, corruption detection on import, staged restore, round-trip + corruption tests.
7. Notifications: real Tauri desktop notifications + test button; PWA notifications behind explicit user action; honest per-channel availability.
8. Performance verification at 10k (dashboard already optimized in dev.15 — measure again), map clustering check.
9. Docs: SBOM, security/threat-model update, verification architecture, tester guides.
10. Release: 0.2.0-dev.18, builds, checksums, completion report.
