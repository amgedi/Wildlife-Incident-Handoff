# Project Folder Cleanup — Baseline (Phase 0)

Audited before any move. Root: `C:\Users\jiggy\Desktop\Wildlife Incident Handoff`

## Root-level executables / launchers

| Item | What it is | Classification |
|---|---|---|
| `Wildlife Incident Handoff Launcher.exe` (8,661,504 B) | Native Tauri launcher (dev.7 build; SHA-256 `35bc8144…` == `launcher/src-tauri/target/release/wih-launcher.exe`) | **REPLACE** → rename to canonical `Launch Wildlife Incident Handoff.exe` |
| `Launch Wildlife Incident Handoff.cmd` (711 B) | Legacy CMD launcher script (pre-Tauri era) | **ARCHIVE** → `scripts/archive/launchers/` |

ROOT .exe COUNT BEFORE: 1 (the launcher under its old name — no portable/installer/other exes in root).
ROOT .cmd COUNT BEFORE: 1. ROOT .bat: 0. ROOT .ps1: 0.

## Root-level generated junk

| Item | Classification |
|---|---|
| `release-dev7.log`, `release-dev7-2.log`, `release-dev7-3.log`, `release-rc1.log` | DELETE (pipeline stdout logs, reproducible) |

## release/

| Item | Classification |
|---|---|
| `release/current/` | KEEP — already RC-only (0.3.0-rc.1 installer/portable/web.zip/manifest/checksums + 4 tester docs) from the rc.1 pass |
| `release/archive/*` (12 flat dev.19–dev.7 portable+setup EXEs) | REORGANIZE into per-version subfolders `0.2.0-dev.19/` … `0.3.0-dev.7/` |
| `release/desktop/` (old staging: dev.4–rc.1 EXEs + INSTALL.txt) | ARCHIVE contents into release/archive per version; remove dir |
| `release/desktop-shell-*.png`, `release/desktop-regression-repro.png` | MOVE → `screenshots/archive/` |
| `release/wildlife-incident-handoff-v0.1.0-source.zip`, `-web.zip` | MOVE → `release/archive/0.1.0/` |

## screenshots/ (59 entries at top level)

- Current acceptance evidence (dev.7/rc.1): `v030-dev7-launcher/`, `v030-dev7-map/` → `screenshots/current/`
- Everything else (numbered UI shots, d2–d6, v030 before/after sets, tours, qa-dev7/8, before/, after/, before-dev8/) → `screenshots/archive/`
- Doc references updated mechanically (see report).

## qa/

- KEEP (active drivers): `cdp.mjs`, `lan-debug.mjs`, `lan-probe.mjs`, `lan-two-instance.mjs`, `onboard-drive.mjs`, `tour-qa*.mjs` (3), `desktop-smoke` support.
- ARCHIVE (historical/one-off): `dev5-qa*.mjs`, `dev6-qa.mjs`, `dev6-repro.mjs`, `patch_*.py` (4 old heredoc patchers), `shoot-v030*.mjs`, `shots-dev17/`, `shots-dev18/`, `lan-two-instance-results.json` → `archive/legacy-qa/`

## scripts/

- Active build/release/dev automation stays: `desktop-release.mjs`, `desktop-smoke.mjs`, `fix-maplibre-worker.mjs`, `gen-build-identity.mjs`, `license-inventory.mjs`, `make-*.py`, `package-release.py`, `release-all.mjs`, `set-version.mjs`, `shell-verify.mjs`, `verify-release.mjs`, `gen-v030-themes.py`.
- `scripts/legacy/` exists — merge into `scripts/archive/` naming.

## docs/

- KEEP ACTIVE: SECURITY/SBOM/licenses/notices, TESTING_GUIDE_*, LAN_SYNC_SECURITY, NETWORK_*, PROFESSIONAL_VERIFICATION_ARCHITECTURE, ROLE_CAPABILITY_MATRIX, HOW_THIS_APP_WORKS, LOCALIZATION_COVERAGE, FEATURE_LIST_AND_ROADMAP, CI_RELEASE_GATES, MAP_FAILURE_ANALYSIS, tester package docs, V030_RC1_* (baseline/inventory/final report), V030_DEV7_FINAL_REPORT, V030_DEV7_LAUNCHER_BASELINE.
- ARCHIVE → `docs/archive/0.3/` (and `/0.2/`): DEV18_*, DEV19_BASELINE, V020_RELEASE_READINESS, V030_DEV2/3/5/6 reports, GUI_OVERHAUL_*, FEATURE_GAP_AUDIT.

## Safety

No user/app data touched (all under `%APPDATA%`). `release/current` RC artifacts untouched. Git history preserves all tracked moves (`git mv` where tracked).
