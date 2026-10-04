# 0.3.0 RC Readiness — `0.3.0-dev.2`

Status legend: PASS · MANUAL CHECK (needs a human/external environment) · DEFERRED (deliberate) · BLOCKER.

| Area | Status | Evidence / notes |
| --- | --- | --- |
| Dashboard | PASS | Personalized header, attention band, KPIs; screenshot QA in screenshots/v030-after; contract + greeting-dynamic tests |
| Response Network | PASS | Real-record organizations/transfer partners widget; honesty note; no invented capacity |
| Response Flow | PASS | Canonical scope invariant tests; visual QA (Pickup 3 ↔ drawer 3); default nothing-selected |
| Incidents | PASS | Command center: summary band, table, inspector, density; 17 dedicated tests |
| Map | PASS | Route contract tests (8 origins × 5 destinations); privacy rules unchanged |
| Profile | PASS | Initials/silhouette avatar, recognition opt-in card; migration tests for legacy settings |
| Devices | PASS | Fingerprint visible without starting sync (new Rust command); revoke; honesty notes |
| Integrity | PASS | Deterministic signals, never auto-rejects; dismiss/block audited; fictional demo data |
| Recognition | PASS | Opt-in private quality badges; forbidden-badge contract tests |
| Themes | PASS | 16 themes; new darks with full status palettes; theme tests |
| Monochrome Dark | PASS | Surface separation overrides + shape glyphs; contract tests; screenshots |
| Frosted / Glass | PASS | Material system; dense data stays solid; reduced-transparency fallback; screenshots |
| Tutorials | see tour QA results below | Retargeted this pass; official runs against the compiled EXE |
| Accessibility | PASS (structural) | Response flow aria/keyboard, combobox/listbox, dialog labels, table aria-sort, live regions; NVDA = MANUAL CHECK (not available here) |
| DPI | SIMULATED | Static geometry audit + 200% zoom simulation this pass; REAL 100/125/150% Windows DPI = MANUAL CHECK |
| Localization | PASS | 5 languages complete (completeness + parity gates); new 0.3 strings translated |
| LAN | PASS | 7/7 Rust crypto; protocol untouched in 0.3; identity-load command added (no server start) |
| Backup | PASS | SHA-256 manifest + staged restore tests green (dev.18/19 code untouched) |
| Privacy | PASS | Avatar never in exports/diagnostics; sensitive-location rules unchanged; palette resolves locally |
| Installer | PASS | NSIS 0.3.0-dev.2 built; Start Menu/uninstall per Tauri config (dev.19 behavior) |
| Portable | PASS | Built release exe packaged under the dev.19 convention; same per-user data dir (documented in INSTALL.txt) |
| Performance | PASS | perf10k 9/9; bounded rendering everywhere |
| Security | PASS | No authz changes; integrity/recognition leak nothing; palette local-only; checksums published |

## Remaining MANUAL CHECKs before 0.3.0-rc.1

1. NVDA pass over Dashboard / Incidents / Profile / Devices (structural audit is green).
2. Real Windows DPI at 100 / 125 / 150% (200% zoom simulation is green).
3. Installer smoke on a clean machine (Start Menu entry, uninstall, data dir).

## Recommendation

**0.3.0-rc.1 is reasonable after the three manual checks above.** All
automatable gates pass; the remaining items require a human on real Windows
with a screen reader.
