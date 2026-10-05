# Project Folder Cleanup — Final Report

Root: `C:\Users\jiggy\Desktop\Wildlife Incident Handoff`

| Item | Value |
|---|---|
| ROOT EXE COUNT BEFORE | 1 (`Wildlife Incident Handoff Launcher.exe` — dev.7 launcher under its old name; SHA-256 verified == freshly built launcher binary) |
| ROOT EXE COUNT AFTER | **1** |
| ROOT EXE | `Launch Wildlife Incident Handoff.exe` (same verified dev.7 binary, canonical name; no version/suffixes) |
| ROOT LAUNCHER TECHNOLOGY | Native Tauri 2 (Rust, `launcher/src-tauri`), Launcher V2: custom titlebar, canonical paw branding, 16-theme selector, manifest-based EXE discovery, freshness model, structured update states, streaming build timeline |
| ROOT LAUNCHER VERIFIED | **yes** — launched the exact root executable over CDP: read `release/current/manifest.json` (0.3.0-rc.1), showed correct identity, and its Launch button actually spawned `release\current\Wildlife-Incident-Handoff-Portable-0.3.0-rc.1.exe` |
| OLD LAUNCHERS | `Launch Wildlife Incident Handoff.cmd` (legacy CMD shim) |
| OLD LAUNCHERS DESTINATION | `scripts/archive/launchers/` (+ pre-existing `scripts/archive/legacy/launch-wih-legacy.cmd` merged there) |
| ROOT CMD BEFORE/AFTER | 1 / 0 |
| ROOT BAT BEFORE/AFTER | 0 / 0 |
| ROOT PS1 BEFORE/AFTER | 0 / 0 |
| CURRENT RELEASE | `release/current/` |
| CURRENT INSTALLER | `release/current/Wildlife-Incident-Handoff-Setup-0.3.0-rc.1.exe` |
| CURRENT PORTABLE | `release/current/Wildlife-Incident-Handoff-Portable-0.3.0-rc.1.exe` |
| CURRENT RC MANIFEST | `release/current/manifest.json` (also `release-manifest.json` naming equivalent in tester docs) |
| CHECKSUMS VERIFIED | **yes** — `sha256sum -c release/current/checksums.sha256`: manifest/portable/installer/web.zip all OK |
| RELEASE/CURRENT CONTENTS | installer, portable, web.zip, checksums.sha256, manifest.json, TESTER_README.md, KNOWN_LIMITATIONS.md, PRIVACY_TESTING_GUIDE.md, FEEDBACK_GUIDE.md — RC only |
| RELEASE/ARCHIVE SUMMARY | Per-version folders: `0.1.0/` (source+web zips), `0.2.0-dev.19/`, `0.3.0-dev.2/…0.3.0-dev.7/` (portable+setup each), `INSTALL.txt`, superseded rc.1 staging copies + their manifest; `release/desktop/` staging dir removed; `release/*.png` moved to screenshots/archive |
| SOURCE ORGANIZATION | unchanged (`src/`, `src-tauri/`, `public/`, `launcher/`, `branding/`) — real architecture respected |
| DOCS ORGANIZATION | 20 active docs stay in `docs/`; 16 historical milestone/audit reports moved to `docs/archive/0.3/` (audit evidence preserved, no deletions) |
| SCRIPTS ORGANIZATION | active automation in `scripts/`; legacy helpers + old qa drivers in `scripts/archive/` and `archive/legacy-qa/` |
| SCREENSHOTS ORGANIZATION | `screenshots/current/` (dev.7 launcher + map acceptance evidence) and `screenshots/archive/` (58 historical entries); screenshots root now contains only `current/` + `archive/` |
| ARCHIVED CHECKPOINTS | qa `shots-dev17/18`, `qa-dev7/8`, v030 before/after sets, d2–d6 shots, tour shots, v0.1.0 zips, superseded rc.1 staging copies |
| DELETED GENERATED JUNK | 4 root pipeline logs (`release-dev7*.log`, `release-rc1.log`) |
| PATH REFERENCES UPDATED | 31 screenshot references in docs + 1 test fixture path (`migration.test.ts` → `docs/archive/0.3/V030_DEV2_BASELINE.md`) + 2 live doc cross-references; README launch/installed-app sections rewritten |
| BROKEN REFERENCES REMAINING | 0 (grep sweep clean; full test suite 647/647 after moves) |
| LAUNCHER DOUBLE CLICK | pass |
| LAUNCHER → WORKBENCH | pass (spawned RC portable from `release/current`) |
| PACKAGED WORKBENCH | pass (RC portable launched; About = 0.3.0-rc.1 verified in rc.1 pass, artifacts unchanged) |
| SCIENTIFIC ENGINE / PYTHON SIDECAR | n/a — this project has no Python sidecar (spec boilerplate); desktop app + frontend unaffected |
| TEST SMOKE | pass — full frontend suite 647/647 + typecheck after all moves |
| PROJECT_STRUCTURE.md | created (root) |
| GIT STATUS | clean (all moves committed: `1115755`) |
| REMAINING ORGANIZATION ISSUES | none blocking. Notes: `resources/` and `tools/` folders from the generic template do not exist — `branding/` and `qa/` serve those roles and were kept (real architecture wins over template); `tests/` folder not forced (tests live in `src/`); installed-app data under `%APPDATA%` untouched per safety rule |
