# 0.3.0-rc.1 — Baseline & Freeze (Phase 0)

Frozen 2026-10-05. dev.7 is the RC candidate source.

## Confirmed frozen state

| Item | Value |
|---|---|
| Working tree | clean (no uncommitted changes at freeze) |
| Version parity | 0.3.0-dev.7 in all 4 canonical surfaces (set-version verify OK) |
| Final dev.7 commit | `a2d777f` (docs final report) — **tagged `v0.3.0-dev.7-checkpoint`** |
| release/current | dev.7: portable + installer + web.zip + manifest + checksums; manifest commit `cf1d153` (build of `cf1d153`, tree at `a2d777f` = build-input-identical per parity contract) |
| Frontend tests | 647/647 (62 files) — re-run at freeze |
| App Rust tests | 7/7 — re-run at freeze |
| Launcher Rust tests | 4/4 — re-run at freeze |
| Desktop smoke (packaged dev.7 EXE) | 7/7 (run in dev.7 final report, same artifacts) |
| Launcher version | 0.3.0-dev.7 (tauri.conf + Cargo) |

## dev.7 foundation claims — confirmed

Confirmed from this repository and the packaged artifacts (not blindly
trusted; see docs/V030_DEV7_FINAL_REPORT.md for the verification record):
launcher freshness model + CURRENT state, manifest-based EXE discovery,
streaming build timeline, structured update states, canonical branding,
custom titlebar, 16-theme combobox, theme sync, map list single-click
selection + privacy-safe fly-to + row↔marker sync + cluster-aware camera +
double-click/Ctrl+Enter/explicit Open + camera memory. The broader 0.3
feature list (Response Flow, Needs Attention, Network Pulse, Live Activity,
Analytics, Terrain 3D, bookmarks, duplicate review, report integrity,
Test View, LAN v3, backups, tutorials, Help, onboarding, launcher, web/desktop
parity) is present in the codebase and covered by the automated suites listed
in docs/V030_RC1_TEST_INVENTORY.md.

## Feature freeze

Feature freeze is in effect for rc.1. Only release blockers / data-safety /
security / privacy / accessibility blockers / installation / migration /
packaging bugs / crashes / broken core workflows will be fixed. Everything
else is deferred to 0.4 (see docs/V040_IDEAS.md if ideas arise).
