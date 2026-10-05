# 0.3.0-rc.2 — Final Report (New Launcher, Responsive Fixes, Update Infrastructure)

| Item | Value |
|---|---|
| VERSION BEFORE / AFTER | 0.3.0-rc.1 → **0.3.0-rc.2** |
| RC2 CREATED | **yes** — `release/current/` (installer + portable + web.zip + manifest + checksums, all verified `sha256sum -c` OK); rc.1 artifacts preserved in `release/archive/0.3.0-rc.1/` |
| LAUNCHER FRONTEND OLD STACK | single static HTML file with inline CSS/JS (`launcher/src-tauri/ui/index.html`) — no longer active (deleted; frontendDist now `../ui/dist`) |
| LAUNCHER FRONTEND NEW STACK | **React 18 + TypeScript + Vite 6 + Tauri 2** (`launcher/ui/src/`: app/, components/, views/, design-system/, services/) |
| OLD FRONTEND STILL ACTIVE | no |
| RUST BACKEND REUSED | get_identity/launch/launch_previous/launch_web/build_app/get_build_status/check_updates (dev tools)/diagnostics/theme sync — extended with get_prefs/set_prefs, check_release_update, open_release_folder, open_logs_folder; all DTOs camelCase-serialized |
| VISUAL REUSE FROM OLD LAUNCHER | none of the layout/CSS; shared only: canonical emblem PNGs, 16-theme color values, and backend logic |
| LAUNCHER WHITE BUG (root cause) | old architecture had no pre-paint background; new stack: inline `<style>` in index.html paints the theme base before any JS, a designed splash renders inside #root before React mounts, the Tauri window sets `backgroundColor: #0a120d`, and an ErrorBoundary shows a themed "Something went wrong / [Retry] / [Copy diagnostics]" surface — never blank white |
| WHITE SCREEN REPRODUCTIONS AFTER FIX | **0** (all views exercised repeatedly incl. nav cycling ×2, resize 520–680, maximized; body background verified themed) |
| INITIAL PAINT BACKGROUND | inline CSS dark base + splash; theme tokens applied synchronously on boot before first meaningful paint |
| ERROR BOUNDARY | pass (React boundary + themed recovery surface) |
| RESPONSIVE LAUNCHER | pass — nav rail collapses to icon rail ≤660px; verified at 520×640 and 680×720 |
| THEME PICKER | pass — Settings → Appearance gallery with 16 miniature previews + check state; persists via launcher-prefs.json |
| THEME SYNC | pass — set_prefs also rewrites launcher-theme.json so the app and launcher share the theme |
| NORMAL MODE | pass — Home shows release version, Ready state, Launch, quick actions, update status; zero Git/build language |
| DEVELOPER MODE | pass — Developer Tools section: source status, parity, Git-remote check, Build / Build & Launch with live pipeline, Web Preview, release packaging, previous-build launch |
| UPDATES VIEW | pass — version, channel choice, states (checking/up-to-date/available/offline/unavailable/error), What's new, last-checked |
| TAURI UPDATER | pass (wired) — main app embeds tauri-plugin-updater + process; commands check_app_update/install_app_update; endpoints per channel (tester.json / latest.json on GitHub Releases); `createUpdaterArtifacts: true` |
| UPDATE SIGNATURES | **pass — required and active**: NSIS updater artifact produced with `.sig` (`bundle/nsis/*-setup.exe.sig`); build fails without `TAURI_SIGNING_PRIVATE_KEY`; verification is never disabled |
| TESTER CHANNEL / STABLE CHANNEL | pass — stored locally in launcher prefs; RC users default Tester |
| GITHUB REPOSITORY | **not yet created** — `gh` CLI absent on this machine. Exact one-step instruction in docs/GITHUB_PUBLISH_CHECKLIST.md (`gh repo create amgedi/Wildlife-Incident-Handoff --public --source . --remote origin --push`); nothing blocks the RC |
| GITHUB REMOTE | none configured locally (checklist covers creation) |
| SECRET SCAN | **pass** — tracked-tree + history filename scan clean; updater private key lives at `%USERPROFILE%\.tauri\` (outside repo, password file alongside); no .env/credentials/personal records |
| README | pass — hero ("Clear information. Safer handoffs."), core principle, current release status, tester status, limitations pointer, 4-badge tasteful group, support section near bottom |
| FUNDING.YML | pass — `.github/FUNDING.yml` (github: amgedi, ko_fi: openfhs, buy_me_a_coffee: openfhs); support links only in README/About/Help, never in wildlife workflows |
| AGPL-3.0-only | pass — LICENSE present; Cargo `license = "AGPL-3.0-only"`; docs/LICENSING_STRATEGY.md (incl. dual-licensing note, no fabricated CLA) |
| CONTRIBUTING / SECURITY / CITATION.CFF / CODE_OF_CONDUCT | pass — all present; CONTRIBUTING carries the AGPL-3.0-only contribution clause |
| CI | pass (workflow) — .github/workflows/ci.yml: frontend typecheck+tests, app + launcher Rust tests; "green" = pending first run after publish |
| RELEASE WORKFLOW | pass (wired) — tag-triggered, builds with signing secrets, uploads installer/portable/sigs/manifests, RC tags marked pre-release |
| UPDATER KEY LOCATION (public info only) | `%USERPROFILE%\.tauri\wildlife-incident-handoff.key` + `.password` — outside the repository; losing them blocks future signed updates (docs/UPDATER_KEY_SETUP.md) |
| APP SIDEBAR OVERLAP ROOT CAUSE | `.sidebar` was one scrolling flex column with `margin-top:auto` footer — middle content overflowed beneath footer controls in short windows. Rebuilt as grid rows `auto / minmax(0,1fr) / auto` with `.sidebar-scroll` as the middle scroll region + short-height header tightening + ellipsis/tooltips on Recent rows |
| APP SIDEBAR 800×600 / 1024×600 / 1280×720 | **pass, 0 visible overlap** at all 7 tested sizes (+ 900×600, 1024×768, 1366×768, 1600×900, maximized) |
| SETTINGS/PROFILE REACHABLE AT ALL SIZES | pass (footer row always visible; short windows scroll the middle only) |
| NAV SELECTION REFINEMENT | pass — soft material tint + animated accent edge + accented icon; not a flat rectangle; color never the only indicator (accent edge + background + focus ring) |
| FRONTEND TESTS | 647/647 · RUST APP 7/7 · LAUNCHER 4/4 · typecheck clean |
| DESKTOP SMOKE | 7/7 on the packaged rc.2 portable (About: 0.3.0-rc.2) |
| FINAL SCREENSHOTS | `screenshots/current/rc2-*` (launcher home/updates/settings/diagnostics/developer/about/narrow; app sidebar 800×600, 1024×600, maximized) |
| FINAL RC2 INSTALLER | `release/current/Wildlife-Incident-Handoff-Setup-0.3.0-rc.2.exe` |
| FINAL RC2 PORTABLE | `release/current/Wildlife-Incident-Handoff-Portable-0.3.0-rc.2.exe` |
| CHECKSUMS | pass |
| ROOT LAUNCHER | rebuilt V2 (React stack), deployed untracked to root via `npm run launcher:deploy` |
| REMAINING BLOCKERS | 1) GitHub repo creation is a documented one-command manual step (no `gh` CLI here); until published, update checks honestly report "Release service unavailable". 2) Windows Authenticode signing still pending (separate from Tauri update signing). 3) Live end-to-end update download/install needs the public repo + first tagged release to exist. |
