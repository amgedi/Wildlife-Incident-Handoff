# 0.3.0-dev.7 — Launcher Baseline Audit (Part I)

Audited 2026-10-04 against the real repository, `release/current`, the packaged
launcher, and packaged desktop artifacts. No previous conversation claims were
trusted.

## Confirmed state

| Item | Value |
|---|---|
| Version (package.json / src/version.ts) | 0.3.0-dev.6 |
| Launcher version (tauri.conf.json + Cargo.toml) | **0.3.0-dev.5 (stale)** |
| Source HEAD | `ed0f3ff` ("chore: 0.3.0-dev.6 release …") |
| Working tree | dirty: `src/build-identity.ts` (generated file, regenerated at build time) |
| Git remote | **none configured** (`git remote -v` is empty) |
| release/current/manifest.json | version 0.3.0-dev.6, commit `f91f856`, frontendBuildId `8fc64712225a`, portable + installer + web.zip + checksums present |
| Manifest artifact naming | stores bare filenames (`portable`, `installer`, `web`) — no directory, no absolute path |
| release/current contents | Portable dev.5 + dev.6 EXEs, Setup dev.5 + dev.6 EXEs, manifest.json, web.zip, checksums.sha256 |
| Launcher technology | Tauri 2 (Rust, `launcher/src-tauri`), single-binary, embedded static UI at `launcher/src-tauri/ui/index.html` (plain HTML/CSS/JS, `withGlobalTauri`) |
| Launcher window | native decorations (no custom titlebar), 480×700, icon `icons/icon.ico` (generated from `public/icons/icon-512.png` via `scripts/make-ico.py`) |
| Theme sync | main app writes `launcher-theme.json` into `%APPDATA%\org.wildlifeincidenthandoff.app` via `write_launcher_theme` (src-tauri main.rs); launcher reads same file. Launcher select offers only 5 themes vs 16 in the app catalog (`src/features/settings/themeCatalog.ts`) |
| Branding | canonical assets: `branding/wildlife-incident-handoff-{emblem,logo}.png`, app icon source `public/icons/icon-512.png`. The launcher header logo is a hand-drawn SVG squiggle — NOT the canonical mark |
| Tests at baseline | 629/629 frontend (reported; re-verify in this pass), 7/7 Rust, smoke 7/7 |

## Root causes for the reported launcher bugs

1. **"Desktop executable not found: Wildlife-Incident-Handoff-Portable-0.3.0-dev.6.exe"**
   `launcher/src-tauri/src/main.rs` `launch_app()` resolves `desktop.exe`
   (a bare filename from the manifest) via `PathBuf::from(exe)` without joining
   `release/current/`, so the launcher looks for the EXE relative to its own
   working directory. Also the launcher does not run `find_root`-relative here.
   → **Hard-coded-filename symptom; path-join bug is the trigger.**

2. **False "Out of date"**
   Freshness check is `manifest.commit != HEAD`. But the release pipeline builds
   at commit `f91f856`, then the artifacts are committed as `ed0f3ff`
   ("chore: 0.3.0-dev.6 release …"). So immediately after every release the
   manifest commit is exactly one (content-irrelevant) commit behind HEAD and
   the launcher reports Out of date even though the build matches the source.
   Fix: freshness = commit match **OR** (clean tree AND `git diff
   <manifest-commit>..HEAD -- <build inputs>` empty), i.e. only code inputs
   (src/, src-tauri/, public/, index.html, vite.config.ts, package.json,
   package-lock.json, scripts) make the desktop stale; docs/chore commits don't.

3. **Build/loading indicator starts late**
   UI enables state only after `invoke("build_app")` returns and polls every
   700 ms; worse, the Rust side uses `Command::output()` which buffers ALL
   stdout until the process exits — `=== stage ===` markers parsed from it only
   appear at the end, so "Building desktop / Packaging / Verifying" never show
   live. Fix: `Command::spawn()` + line-streaming reader thread, plus instant
   UI feedback on click (same-frame).

4. **Multiple confusing identities**
   UI shows source version + frontend build id + commit + desktop commit +
   "Web build: From same source ✓" (unverifiable claim). Replaced with the
   grouped model from the spec: CURRENT SOURCE / DESKTOP / WEB.

5. **"Could not reach the git remote"**
   No remote is configured in this checkout; `check_updates` lumps
   no-remote / offline / remote-error into one string. Fix: distinguish
   `no-remote`, `offline`, `remote-error`, `auth`, `up-to-date`, `available`,
   `dirty-tree` as structured states.

6. **Launcher icon vs in-window logo**
   Window/taskbar icon comes from `icons/icon.ico` generated from the canonical
   `public/icons/icon-512.png` (correct family); the in-window logo is a
   non-canonical SVG. Fix: use the canonical emblem artwork in the launcher UI.

## Map side (Parts XII–XVI)

Map implementation lives in `src/features/network/NetworkMap.tsx` (924 lines),
`src/features/network/map/v4Map.ts`, `mapProvider.ts` (maplibre-gl v6).
Incident side-list interaction to be reworked to: single click = select +
privacy-safe flyTo + inspector (stay on Map); double click / explicit Open =
full incident page; keyboard + two-way list↔marker sync; filter-aware
selection; camera memory.

## Launcher plan (Parts II–XI)

- One identity model (SOURCE / DESKTOP / WEB) with states: CURRENT,
  SOURCE CHANGED, SOURCE DIRTY, DESKTOP MISSING, BUILD FAILED, VERSION MISMATCH.
- Manifest-first artifact discovery + safe fallback scan of `release/current`
  only; previous-verified-build launch.
- Streaming build with stage timeline (Preparing → Tests → Frontend → Desktop →
  Packaging → Verifying → release/current → Ready) from `desktop-release.mjs`
  `=== step ===` markers.
- Update states incl. NO REMOTE / OFFLINE / ERROR / AUTH / UP TO DATE /
  AVAILABLE; never auto-pull; dirty-tree safety.
- Visual rebuild: custom titlebar (decorations:false + drag region + Snap via
  native resize borders retained), canonical emblem logo, hero, current-build
  card, primary launch, compact secondary actions, custom theme combobox
  (all 16 themes, swatches, keyboard), footer status, microinteractions.
- Launcher version bumped to 0.3.0-dev.7 (tauri.conf.json + Cargo.toml).
