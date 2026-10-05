# 0.3.0-rc.1 — Final Report (First External Tester Release)

| Item | Value |
|---|---|
| VERSION BEFORE | 0.3.0-dev.7 (tagged `v0.3.0-dev.7-checkpoint`) |
| VERSION AFTER | 0.3.0-rc.1 (all 4 canonical surfaces) |
| RC CREATED | **yes** |
| RC TAG | `v0.3.0-rc.1` |
| FINAL COMMIT | `de44d92` (+ docs commits after; artifacts built at `de44d92`, manifest commit matches) |
| FRONTEND TESTS | 647/647 (62 files) |
| APP RUST TESTS | 7/7 |
| LAUNCHER RUST TESTS | 4/4 |
| TYPECHECK | pass |
| WEB BUILD | pass (web.zip, webBuildId in manifest) |
| DESKTOP BUILD | pass (portable + NSIS installer, pipeline gates incl. packaged-identity-vs-source-commit) |
| DESKTOP SMOKE | 7/7 — run against the **installed RC EXE** (About reads 0.3.0-rc.1) |
| TEST INVENTORY | docs/V030_RC1_TEST_INVENTORY.md |
| CLEAN INSTALL | pass — silent install of the actual RC installer; version 0.3.0-rc.1, InstallLocation `%LOCALAPPDATA%\Wildlife Incident Handoff`, Start Menu entry created |
| FIRST RUN | pass — onboarding starts (language → theme → workspace), Skip setup works; Test View seeds fictional incidents; dashboards/map/settings reachable |
| UNINSTALL DATA RETENTION | pass — uninstall removes binaries + Start Menu entry; `%APPDATA%\org.wildlifeincidenthandoff.app` byte-identical (records preserved by default) |
| REINSTALL | pass — fictional incident WIH-2026-000001 still present in the app after reinstall |
| MIGRATION DEV19/DEV2/DEV5/DEV7 | pass — migration.test.ts suite green (schema upgrades covered by automated fixtures); dev.5→dev.7 carried real profiles in QA dirs without loss during development |
| BACKUP | pass — backupService.test.ts (record-only + media, SHA-256 manifest) |
| RESTORE | pass — staged restore, verified in suite |
| CORRUPT RESTORE SAFETY | pass — staged restore tests: failure does not damage existing workspace |
| LAN PAIRING / TWO-WAY SYNC / CONFLICT / REVOKE / SECURITY | pass (automated): lan_crypto.rs + lan_sync.rs Rust tests (encrypt/decrypt, HMAC, replay, clock-skew) + lanSyncDev19 frontend contract; two-real-machine field test → manual item |
| LOCATION PRIVACY | pass — geocoding.test.ts (19) + dev17 camera contract + export privacy suite |
| SENSITIVE LOCATION | pass — never reveals exact coordinate via marker/camera/geocoder/inspector/export (suite-covered; map list fly-to uses the marker's privacy-safe position by source contract) |
| MAP | pass — packaged acceptance in dev.7 + route reliability suites |
| TERRAIN ONLINE | not re-verified this pass (dev.7 acceptance covered basemaps; terrain needs stable online tile access — flagged to testers) |
| MAP ROUTE STRESS | covered by automated route-reliability/navigation contract suites (not a literal 50× manual run) |
| MAP LIST INTERACTION | pass — dev17.test.tsx (18) |
| ANALYTICS ACCURACY | pass — deterministic fixtures, no negative counts/splines (analyticsV3/V5 suites) |
| ANALYTICS DRILLDOWN | pass — bucket click → drawer → incident list (suite-covered) |
| RESPONSE FLOW / PICKUP / CARE COUNTS | pass — stage counts derive from one canonical scope (suite-covered; historical pickup/care bugs fixed in earlier 0.3 passes, regression suite green) |
| LIVE ACTIVITY | pass — rich rows + long-text handling suites |
| DUPLICATE REVIEW | pass — grouping/decisions suites, never auto-merge |
| BOOKMARKS | pass — cross-surface bookmark suites + persistence |
| REPORT INTEGRITY | pass — "possible/review/candidate" wording enforced by test |
| PROFESSIONAL VERIFICATION HONESTY | pass — verificationHonesty.test.ts (never claims external verification) |
| WILDLIFE STEWARDSHIP | pass — stewardship suite (no rewards for raw counts/speed) |
| TEST VIEW / SEEDED | pass — scenario determinism suite (role × intensity × seed) |
| LAUNCHER CURRENT STATE | pass — CURRENT/SOURCE CHANGED/SOURCE DIRTY/DESKTOP MISSING/VERSION MISMATCH states verified in dev.7 (unchanged code in rc.1) |
| LAUNCHER LAUNCH | pass (dev.7: actually spawned the packaged desktop) |
| LAUNCHER BUILD | pass (dev.7: real end-to-end build with streaming timeline) |
| LAUNCHER UPDATE STATE | "No Git remote is configured for this source checkout" — correct and cleanly presented for this checkout (not a product failure; external testers never receive the dev launcher) |
| 100% DPI | pass (dev-machine scale; structural DPI prep suite) |
| 125% / 150% DPI | **not tested** — manual item |
| 200% ZOOM | manual item (browser/WebView zoom; no automated run this pass) |
| NVDA | **not available** |
| HIGH CONTRAST | not tested — manual item (high-contrast themes + mono themes exist and are suite-covered for non-color-only distinction) |
| REDUCED MOTION | pass — OS preference honored (suite + dev.7 launcher reduced-motion) |
| REDUCED TRANSPARENCY | pass — solid material fallback honored |
| TOURS / AUTO-SKIPS / MISSING TARGETS | tutorial markup unchanged since dev.7 zero-skip run → 0 missing targets / 0 auto-skips stands |
| SECURITY REGRESSION | pass — suites + Rust crypto tests; no private material in logs/diagnostics (diagnostics = version/build only) |
| PRIVACY REGRESSION | pass |
| SBOM | docs/SBOM.md + THIRD_PARTY_LICENSES.md (existing, current) |
| CODE SIGNING | **UNSIGNED RELEASE CANDIDATE** (no certificate; documented in KNOWN_LIMITATIONS + TESTER_README) |
| AUTO UPDATE SIGNING | disabled/absent by design — no silent unsigned installs |
| CHECKSUMS | pass — `sha256sum -c` OK for manifest.json, portable, installer, web.zip |
| RELEASE MANIFEST | pass — commit `de44d92` == build commit |
| KNOWN LIMITATIONS | docs/KNOWN_LIMITATIONS.md (also in release/current) |
| TESTER README | docs/TESTER_README.md (also in release/current) |
| PRIVACY TESTING GUIDE | docs/PRIVACY_TESTING_GUIDE.md (also in release/current) |
| FEEDBACK GUIDE | docs/FEEDBACK_GUIDE.md (also in release/current) |
| TESTER PACKAGE | release/current/ (installer + portable + web.zip + checksums + manifest + the four tester docs) |
| INSTALLER | release/current/Wildlife-Incident-Handoff-Setup-0.3.0-rc.1.exe |
| STANDALONE | release/current/Wildlife-Incident-Handoff-Portable-0.3.0-rc.1.exe |
| WEB PACKAGE | release/current/web.zip |
| RELEASE CURRENT | RC-only (prior dev builds moved to release/archive/) |
| RC READINESS | **PASS** |

## Remaining release blockers

None known.

## Manual tester items (documented, not fabricated as done)

1. NVDA screen-reader pass against the packaged EXE (not available here).
2. Windows display scaling 125% / 150% on external hardware.
3. 200% app zoom pass.
4. Windows High Contrast / forced colors pass.
5. Two-physical-machine LAN acceptance (pair → sync both ways → conflict →
   revoke → re-pair).
6. Online Terrain 3D confirmation on tester hardware.
7. Clean-machine (VM) first-run beyond the silent-install cycle done here.

All are listed in KNOWN_LIMITATIONS.md and safe to defer per the manual gate
policy: no known blocker, automated a11y checks pass, packaged app usable.

## Feature-freeze compliance

No features were added in this pass. Changes: version bump, tester
documentation, release-directory reorganization. 0.4 ideas go to
docs/V040_IDEAS.md (none recorded).
