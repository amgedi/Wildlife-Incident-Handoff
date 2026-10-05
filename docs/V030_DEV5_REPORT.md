# 0.3.0-dev.5 Final Report (2026-10-05)

## Versions

- **VERSION BEFORE**: 0.3.0-dev.4 @ `da3a0a3` (frontend build `befa38842948`) — confirmed from repo, tag, and packaged EXE About.
- **VERSION AFTER**: **0.3.0-dev.5** (no RC created).
- **Packaged release identity**: commit `8fe8ae4`, frontend build `0b9a95609a28`, packaged 2026-10-05 00:58 (see `release/current/manifest.json`).
- HEAD at report time `cedc0a3` contains only QA drivers + screenshots after the packaged commit.

## Verification summary

| Check | Result |
| --- | --- |
| FRONTEND TESTS | **629/629 passed** (64 files; was 585 at baseline) |
| RUST TESTS | **7/7 passed** |
| TYPECHECK | clean |
| WEB BUILD | OK (dist + worker fix; web.zip 2.7 MB) |
| DESKTOP BUILD | OK (portable 16.5 MB + installer 5.7 MB) |
| DESKTOP SMOKE | **7/7 PASS** against `release/current` portable EXE |
| release:all | **PASS** (tests → web + desktop from one commit → manifest → checksums → `release/current/`) |
| Runtime QA driver (`qa/dev5-qa.mjs`) | **10/10 PASS** on the final EXE |

## Spec-part results

- **FEATURE REGRESSION AUDIT**: `docs/V030_FEATURE_REGRESSION_AUDIT.md` (28 areas classified; 3 BROKEN, 12 DEGRADED at baseline).
- **WINDOW RESIZING**: PASS. Min size raised 420×560 → 1024×700; responsive grid collapses at 1100px/760px breakpoints; 30-burst scroll test settles clean.
- **WINDOW GEOMETRY MEMORY**: PASS (new `window_geometry.rs` — size/pos/maximized persisted, monitor-visibility validated, debounced writes).
- **FAST SCROLL BLANKING**: root cause identified — two full-viewport animated ambient layers at `z-index:-1` were recomposited against every scroll frame (and re-blurred by frosted panels). Fix: each layer promoted to its own compositor plane (`translateZ(0)`/`will-change`) + `overscroll-behavior:none`. Long-frame count during 30 rapid bursts: **0**.
- **SIDEBAR V5**: PASS. `nav-work` no longer flex-grows; **Pinned gap = 12 px** below New intake (spec ≤ 64 px); RECENT visible at y=471; the old `max-height:760px` media rule that hid RECENT at the DEFAULT window height lowered to 699px.
- **LIVE ACTIVITY V5**: PASS. Rich rows (time · category chip with icon+label · actor/org · ref · concern · status transition · generalized location, suppressed for sensitive records), 6 category filters, Today/Yesterday/Earlier grouping, scroll-safe "New activity" badge. Event types: created, assignment/en-route/pickup/care/closed via status transitions, handoffs/custody, observations/photos, corrections/notes, system.
- **RESPONSE NETWORK V5**: PASS. Content-aware card heights (`align-items:start`), Network Pulse enriched (sending orgs, recent network event) + compact honest empty state, giant fixed heights removed.
- **LOCAL-STORE WORKSPACE TEXT**: removed from the workspace; source state lives in the sidebar `● Local` status row / About.
- **TERRAIN 3D**: **PASS — genuinely online**. ROOT CAUSE (present since the map shipped): MapLibre v6 resolves its module worker at runtime (`dist/assets/maplibre-gl-worker.mjs`), which Vite never emitted — vite dev resolved it from node_modules, the packaged EXE got "Worker failed to load". Fixed with a postbuild copy (`scripts/fix-maplibre-worker.mjs`). Verified in the EXE: canvas mounts cold, DEM active (AWS Terrarium, `HTTP 200` verified), **visible 3D relief + hillshade at pitch 60/bearing 25** (`screenshots/v030-dev5-after/qa-terrain-relief.png`), terrain stays selected on failure with [Retry]/[Use 2D map] (kick-out removed).
- **MAP CAMERA STATE / BASEMAP PERSISTENCE**: PASS — center/zoom/bearing survive Streets→Satellite→Terrain→2D (was reset on every switch; `fitMode="service-area"` forced `initialCamera` null). Terrain pitch memory preserves the previous 2D pitch.
- **COMPASS V5**: PASS — real rotating SVG compass; old `↑ N` text control removed; real-input click returns bearing 40°→0°.
- **MEASURE V5**: PASS — designed A/B amber pins, distance + compass-bearing readout, Clear/Esc, panel confirmed in EXE.
- **MAP V5**: concern-type filter, cluster inspector, camera memory, reset — PASS.
- **ANALYTICS V5**: PASS (rewrite). Canonical metric registry with definitions/includes/excludes; bucketing 24h hourly / 7d·30d daily / 90d weekly; **bar chart replaces the Catmull-Rom spline** (sub-zero visual fabrication eliminated by construction); click/keyboard opens the time-window detail drawer (window, metrics, median assignment, incident refs, "Open filtered incidents" drilldown via new `?from=&to=` deep links); "What does this mean?" per metric; 13 exact-count fixture tests.
- **CONCERN MODEL**: wildlife animal / habitat-site / environmental hazard / infrastructure hazard / human-wildlife conflict / other. Legacy incidents migrate to "wildlife animal" (write-back at repository level; no record loss — tested). Dynamic intake (concern picker on step 1, focused non-animal steps, optional animal details). Incidents filter + "Concern mix" analytics card + map filter + simulated scenarios mix concerns. No legal-conclusion vocabulary (tested).
- **ONBOARDING NEXT / BACK / COMPLETE**: PASS — release-blocking bug reproduced in the dev.4 EXE (20 dead clicks; stage 4 Next called `setStage(4)`) and fixed; full Next chain, Back, completion verified in the **packaged dev.5 EXE** on a fresh profile.
- **ONBOARDING THEME LOGO**: brand mark is theme-token driven across all 16 themes; theme picker now renders the shared 16-theme catalog (was a stale 10); progress rail ("1 of 6" + dots).
- **IN-APP THEME MARK / DEFAULT THEME / MATERIAL**: Forest Night default for new profiles (existing users untouched), Frosted material, ambient on, motion full.
- **NATIVE LAUNCHER**: PASS — `Wildlife Incident Handoff Launcher.exe` (root; Tauri, Forest Night frosted UI + ambient + reduced-motion support). Shows source vs packaged-desktop identity/staleness, Launch / Web preview / one-click Build (canonical `desktop:release`, captured logs, staged progress, failure-safe), read-only update check (fetch + behind count; **never** pulls over a dirty tree; no unsigned remote binaries — honest blocker, no auto-updater installed).
- **LAUNCHER THEME SYNC**: shared `launcher-theme.json` (%APPDATA%\org.wildlifeincidenthandoff.app); app writes on theme change (`write_launcher_theme`), launcher reads with Forest Night fallback; launcher theme picker writes back.
- **OLD CMD**: root `.cmd` is now a shim that opens the launcher; legacy menu moved to `scripts/legacy/launch-wih-legacy.cmd`.
- **WEB/DESKTOP PARITY**: PASS — `release:all` derives both from one commit; manifest carries version/commit/frontend+desktop+web build ids; identity drift across the pipeline FAILS the release (spec 106 gate implemented and exercised).
- **FOLDER CLEANUP**: old dev.19/dev.2/dev.3 EXEs → `release/archive/`; canonical current build → `release/current/` (portable, installer, web.zip, manifest, checksums); `_themes_tmp.css` + empty `locales/es`,`fr` removed; README "HOW TO LAUNCH" rewritten.
- **10K PERFORMANCE**: existing suites still pass; analytics bucketing is the same precomputed-O(n) approach; scroll bursts produced 0 long tasks.
- **SECURITY/PRIVACY REGRESSION**: all pre-existing suites pass (LAN crypto 7/7, backup SHA-256, privacy map rules untouched; new code adds no telemetry — launcher reads local identity only).

## Final screenshots

`screenshots/v030-dev5-after/` — terrain relief, measure A/B, map V5 controls, dashboard post-scroll, plus route captures.

## Remaining blockers / honest notes

1. **Signed auto-update: blocked** — no signing infrastructure exists; per spec 98 nothing remote is installed silently. The launcher reports updates read-only.
2. **Terrain "visible terrain" was verified on THIS online machine** (DEM host reachable, HTTP 200, relief visible in EXE screenshots). The owner should confirm on their machine; if it still fails there, the terrain debug panel (Settings → Map diagnostics) now shows the error class.
3. Launcher "Launch" starts the newest packaged desktop build; it does not yet detect an installed (Start Menu) copy when no packaged artifact exists.
4. The old TrendChart component remains in the tree (still covered by its accessibility tests) but is no longer used by the dashboard.
