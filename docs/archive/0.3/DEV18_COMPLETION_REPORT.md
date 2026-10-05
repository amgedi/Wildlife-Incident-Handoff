# 0.2.0-dev.18 — Completion Report (2026-10-03)

Focus: trust hardening. "Would I trust this application with real wildlife incident data?"

| Item | Result |
|---|---|
| VERSION | 0.2.0-dev.18 (package.json, tauri.conf.json, Cargo.toml, src/version.ts agree) |
| TESTS | 351/351 passing (up from 297) |
| WEB BUILD | OK (vite + PWA service worker, dist/) |
| DESKTOP BUILD | OK (Rust release 2m13s; NSIS bundle built) |
| DESKTOP SMOKE | 7/7 PASS on the real dev.18 EXE (fresh profile; one earlier "About: version" failure was a hardcoded APP_VERSION string, fixed + re-verified) |
| OFFICIAL TOUR RUNS — Reporter | Interface 10/10 completed; Finding-reports 10/10 completed (real EXE via CDP, results read from the app's own tour-result log) |
| OFFICIAL TOUR RUNS — Professional | Interface 10/10 completed; Finding-reports 10/10 completed |
| AUTO-SKIPPED OFFICIAL STEPS | 0 (across 40+ driven runs; plus a static zero-auto-skip contract test that fails the build if any official target is missing) |
| PROFESSIONAL VERIFICATION WORDING | PASS — live EXE: "Prepare verification evidence", no "Submit verification"/"pending review" anywhere; asserted by test |
| VERIFICATION EVIDENCE PRIVACY | PASS — only note text + document NAME stored (local settings); never in exports/sync/backups/diagnostics; architecture doc written |
| GEOCODING PROVIDER | OpenStreetMap Nominatim (behind new GeocodingProvider abstraction: id, endpoint, attribution, disclosure, rate limit) |
| EXACT GEOCODING CONSENT | PASS — consent dialog (Continue/Cancel + remember), unit + provider-boundary tests |
| APPROXIMATE GEOCODING | PASS — only the ~1 km fuzzed coordinate is ever sent (URL asserted in tests) |
| SENSITIVE LOCATION GEOCODING | BLOCKED — no fetch possible; inspector shows "lookup disabled" |
| GEOCODE CACHE | PASS — persistent, per provider+coordinate; second click = no refetch (test) |
| MAP SERVICE AREA | PASS — camera fits configured service area (existing behavior verified) |
| LAN SYNC CURRENT SECURITY | Trust gate (403 untrusted) verified in dev.15; transport still plaintext + spoofable device-id header → now labeled EXPERIMENTAL in UI with explicit warning; off by default (verified) |
| PEER AUTHENTICATION | PASS (pairing approval + trust gate; spoofability documented honestly) |
| ENCRYPTED LAN | DEFERRED — documented as future work, feature labeled accordingly |
| SYNC CONFLICTS | PASS — competing edits always raise explicit conflict (never silent LWW) |
| CLOCK SKEW SAFETY | PASS (new) — peers with 2027 / 1999 clocks cannot overwrite local edits; provenance metadata preserved |
| TOMBSTONES | PASS — deletion propagates; no resurrection (dev.15 tests + docs) |
| TWO INSTANCE SYNC | Not re-run live this pass (dev.15 verified the trust gate in real EXEs); merge/tombstone/skew behavior covered by 26 unit tests |
| BACKUP FORMAT | JSON + new manifest (counts + per-record SHA-256); legacy backups still import |
| BACKUP ROUND TRIP | PASS — 100-incident export/import zero corruption (export 6 ms / import 8 ms) |
| BACKUP CORRUPTION DETECTION | PASS — tampered record fails hash, NOT imported, reported; manifest-missing record rejected; count mismatch flagged |
| DESKTOP NOTIFICATIONS | PASS — Tauri notification plugin wired; opt-in toggle; "Send test notification" verified live in EXE (toast path executed, success toast) |
| PWA NOTIFICATIONS | PASS (code) — Web Notifications API behind explicit user action only; not verifiable in this environment |
| OFFLINE MAP | DEFERRED — PMTiles evaluation + implementation contract in docs/OFFLINE_MAPS_EVALUATION.md; existing honest offline fallback verified |
| NVDA | Not tested (no screen reader in this environment) — honest gap |
| 125% DPI | Not systematically tested this pass |
| 150% DPI | Not systematically tested this pass |
| 10K INCIDENT TEST | KPIs 2.4 ms; attention 7.2 ms; distributions ~1 ms; search 6 ms; duplicates 9 ms; marker fuzz 1.9 ms (all with CI budgets) |
| LIST PERFORMANCE | filter+sort at 10k: 0.5 ms |
| MAP 10K | marker geometry 10k = 1.9 ms; clustering verified in dev.14-15 (grid clusters, no DOM-per-point) |
| MIGRATION FIXTURES | Maintained (dev.15 suite: pre-structured-events, missing optional fields, malformed payloads, IndexedDB round-trip) |
| DUPLICATE REVIEW | Detection sub-second at 10k; review UX unchanged (never auto-merges) |
| WINDOWS SIGNING | Documented (docs/WINDOWS_CODE_SIGNING.md — still unsigned, stated honestly) |
| CI | .github/workflows/ci.yml (tests + windows job); new perf budgets run in test suite |
| SBOM | Created — docs/SBOM.md (regenerated inventory incl. new notification plugin) |
| SECURITY DOCS | Updated — SECURITY_ARCHITECTURE.md (dev.18 threat model), LAN_SYNC_SECURITY.md |
| TESTER GUIDES | Updated with the 5-question feedback form (reporter + professional) |
| PORTABLE EXE | release/desktop/Wildlife-Incident-Handoff-Portable-0.2.0-dev.18.exe |
| INSTALLER | release/desktop/Wildlife-Incident-Handoff-Setup-0.2.0-dev.18.exe |
| SHA-256 | release/desktop/checksums.sha256 |

## Main code changes

- Tutorials: honest result states (`TourResult`), completion only for clean runs, failure card reachable, `openTarget` engine support, standalone "Finding reports" tour, legacy dead steps deleted, contract tests.
- RoleCard: honest local-only wording; authorization docs clarify "verified" is server-only.
- `src/features/network/geocoding.ts` (new): provider abstraction, sensitive block, approximate generalization, exact consent (rememberable), persistent cache, rate limiter, typed failures. LocationIntel rewritten (consent dialog, precision-honoring "Technical details", failure UX).
- `mapProvider.effectivePrivacy`: per-incident precision overrides view defaults (fixes sensitive-at-1km bug). Exports honor precision (approximate generalized, sensitive withheld).
- Backups: manifest + SHA-256 per record, staged validation-before-write, corruption reported not imported, legacy compat.
- Notifications: `src/notifications/delivery.ts`, Tauri plugin (Rust + capability + npm), honest channel settings, test button, opt-in system delivery hooked into `notify()`.
- Analytics: `getTimeSeries` precompute (610 ms → 16 ms at 10k × 90 days) with perf-budget tests (`src/features/perf10k.test.ts`).
- i18n: all new strings translated in the 5 production locales (en, fr, es, de, pt-BR).
