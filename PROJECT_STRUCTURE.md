# PROJECT STRUCTURE — Wildlife Incident Handoff

A short map of this folder, so it makes sense months from now.

## What to click

- **`Launch Wildlife Incident Handoff.exe`** (root) — the development/workspace
  launcher (native Tauri app). It shows build identity, can launch the current
  packaged build, run a build, check updates, and switch themes. This is the
  ONLY executable in the root.

## Where things live

| Path | What it is |
|---|---|
| `release/current/` | **Current external tester release** (0.3.0-rc.1: installer, portable, web.zip, manifest, checksums, tester docs). This is what you give to testers. |
| `release/archive/` | Historical releases, one folder per version (0.1.0 → 0.3.0-dev.7). |
| `src/` | Frontend source (React + TypeScript). |
| `src-tauri/` | Native desktop shell (Tauri 2 / Rust). |
| `launcher/` | The root launcher's own Tauri project (`launcher/src-tauri`). |
| `public/` | Static assets and icons served with the frontend. |
| `branding/` | Canonical brand artwork (paw emblem/logo). |
| `qa/` | Interactive QA drivers (CDP utilities, LAN probes, tour/onboarding drivers). |
| `scripts/` | Build/release automation (`release-all.mjs`, `set-version.mjs`, smoke tests…). Old one-off helpers are in `scripts/archive/`. |
| `docs/` | Active documentation. Historical milestone reports: `docs/archive/0.3/`. |
| `screenshots/current/` | Current acceptance evidence. Older milestone screenshots: `screenshots/archive/`. |
| `dist/`, `node_modules/`, `src-tauri/target/` | Generated build output — safe to regenerate, never edit. |
| `tests/` | (Tests live inside `src/**/*.test.tsx` — there is no separate root tests folder in this architecture.) |

## Testers vs. owner

- **External testers** only ever receive `release/current/` — never this whole
  folder, never the launcher, never source code.
- **The root launcher** is the project owner's development convenience; the
  installed Workbench app remains an independent product.

See `README.md` for development instructions and `docs/` for details.
