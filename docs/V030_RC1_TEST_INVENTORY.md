# 0.3.0-rc.1 — Test Inventory (Phase 2)

All commands run from the repository root. Results from the rc.1 acceptance
run on the frozen dev.7 checkpoint (`v0.3.0-dev.7-checkpoint` = `a2d777f`).

## Automated suites

| Suite | Command | Count | Result |
|---|---|---|---|
| Frontend (all) | `npx vitest run` | 647 tests / 62 files | PASS |
| — migration | `src/features/migration.test.ts` | incl. above | PASS |
| — LAN sync (frontend contract) | `src/features/sync/lanSyncDev19.test.ts` | incl. above | PASS |
| — backup/restore | `src/storage/backupService.test.ts` (incl. SHA-256 manifest + staged restore) | incl. above | PASS |
| — location privacy / geocoding | `src/features/network/geocoding.test.ts` (19: sensitive block, consent, cache, generalized targets) | incl. above | PASS |
| — map privacy + camera | `src/features/dev17.test.tsx` (18: privacy-safe camera contract, cluster, selection) | incl. above | PASS |
| — analytics accuracy V3/V5 | `analyticsV3.test.tsx`, `analyticsV5.test.tsx`, `incidentAnalytics.test.ts` (deterministic buckets, no negative counts/splines) | incl. above | PASS |
| — report integrity | `src/features/integrity/integrityService.test.ts` ("possible/review/candidate" wording, no auto-reject) | incl. above | PASS |
| — verification honesty | `verificationHonesty.test.ts` (never claims external verification) | incl. above | PASS |
| — stewardship | `src/features/recognition/stewardship.test.tsx` | incl. above | PASS |
| — Test View scenarios | `src/features/simulation/scenario.test.ts` (role × intensity × seed determinism) | incl. above | PASS |
| — a11y structural | `a11yStructural.test.tsx` (landmarks/headings/labels) | incl. above | PASS |
| — tutorials zero-skip | `src/features/tutorial/tourTarget.test.ts` (+ `qa/tour-qa.mjs` driver) | incl. above | PASS |
| — i18n completeness/parity | `i18n/completeness.test.ts`, `localesParity.test.ts` | incl. above | PASS |
| — performance budgets | `perf10k.test.ts` (10k incidents) | incl. above | PASS |
| — themes/materials/icons | `v030themes.test.ts`, `materialV4.test.ts`, `themeIcon.test.ts`, `iconContract.test.ts` | incl. above | PASS |
| — export privacy | `exportService.test.ts` | incl. above | PASS |
| — notifications | `notifications/delivery.test.ts` | incl. above | PASS |
| Typecheck | `npx tsc --noEmit` | — | PASS |
| App Rust (incl. LAN crypto/sync: 7 tests — encrypt/decrypt, HMAC, replay, clock skew) | `cargo test` (src-tauri) | 7 | PASS |
| Launcher Rust (freshness inputs, artifact resolution, dirty filter, stage mapping) | `cargo test` (launcher/src-tauri) | 4 | PASS |
| Desktop smoke (packaged EXE via CDP) | `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS="--remote-debugging-port=9222" node scripts/desktop-smoke.mjs` | 7 | PASS (dev.7 artifacts) |
| Release pipeline gates | `npm run release:all` (tests → typecheck → build → identity parity → package → verify packaged identity vs source commit → manifest → checksums) | — | PASS |
| Build identity parity | version surfaces + manifest commit vs source commit | — | PASS |
| Checksums | `release/current/checksums.sha256` (SHA-256 over portable/installer/web.zip) | — | PASS |

## QA drivers (not CI-automated, run on demand)

- `qa/lan-two-instance.mjs` — two-profile LAN pairing/sync driver.
- `qa/tour-qa.mjs` — tutorial matrix driver (0 missing targets / 0 auto-skips on clean runs; markup unchanged in rc.1 → dev.7 result stands).
- `qa/onboard-drive.mjs` — onboarding walkthrough driver.
- `qa/cdp.mjs` — desktop CDP utilities.

## Not automatable in this environment (documented, not fabricated)

- Real NVDA screen-reader pass — NOT AVAILABLE.
- Real Windows 125%/150% DPI — NOT TESTED (dev machine fixed scale; structural DPI prep covered by `dpiPrep.test.ts`).
- 200% app zoom — manual browser/WebView zoom check.
- Two-real-machines LAN acceptance — single-machine profiles + automated crypto/replay tests.
