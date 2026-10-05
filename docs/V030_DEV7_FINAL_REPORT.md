# 0.3.0-dev.7 — Final Report (Launcher V2 + Map List Interaction)

Baseline audit: `docs/V030_DEV7_LAUNCHER_BASELINE.md`. All results below were
reproduced against the packaged artifacts in `release/current` (portable EXE,
launcher EXE) — not the dev server alone.

## Identity

| Item | Value |
|---|---|
| VERSION BEFORE | 0.3.0-dev.6 |
| VERSION AFTER | 0.3.0-dev.7 (all 4 canonical surfaces; launcher tauri.conf/Cargo also 0.3.0-dev.7) |
| SOURCE COMMIT | `cf1d153` (HEAD `13aa163` touches only screenshots + generated build identity → still fresh) |
| DESKTOP COMMIT | `cf1d153` (release/current/manifest.json) |
| WEB COMMIT | webBuildId `11e2dd939f34`, same source commit |
| FRONTEND TESTS | 647/647 (62 files; +18 new dev.7 map-selection tests) |
| RUST TESTS | 7/7 (app) · 4/4 (launcher unit tests: stage mapping, artifact path resolution, dirty filter, freshness inputs) |
| DESKTOP SMOKE | 7/7 on `Wildlife-Incident-Handoff-Portable-0.3.0-dev.7.exe` (About shows 0.3.0-dev.7) |

## Launcher fixes — root causes

**BUILD FRESHNESS BUG (root cause).** Two stacked false-"Out of date" causes:
1. The release commit is created *after* the build, so `manifest.commit != HEAD`
   by exactly one content-irrelevant commit on every fresh release.
2. `src/build-identity.ts` (generated) counted as a build input in both the
   dirty check and the commit-diff check.
Fixed: freshness = commit match **OR** (no build-input diff between manifest
commit and HEAD, generated files exempt). Uncommitted *code* changes → honest
"Source has unbuilt changes". Verified live: launcher shows **CURRENT ✓**
immediately after a release and after the launcher-driven rebuild.

**MISSING EXE ROOT CAUSE.** `launch_app()` used the manifest's bare filename
without joining `release/current/`. Fixed: manifest-first resolution relative
to the manifest directory (+ unit test), safe fallback scan of
`release/current` only, previous-verified-build launch. **MANIFEST-BASED
ARTIFACT DISCOVERY: pass.**

**BUILD SPINNER IMMEDIATE: pass.** Stage 0 renders the same interaction frame
as the click (backend sets it before spawning; UI renders instantly and polls
at 350 ms). **BUILD TIMELINE: pass** — 8 canonical stages streamed from the
pipeline's `=== step ===` markers (verified live: t+1.2 s → Preparing ✓,
Testing ✓, Building frontend ●; t+13 s → Building desktop).

**UPDATE CHECK: pass.** Structured states — **NO-REMOTE: pass** (this checkout
has no remote: "Updates unavailable — No Git remote is configured…" +
[Details]), **OFFLINE: pass** (network-failure classification: offline / auth /
remote-error with [Retry]), **UPDATE-AVAILABLE: pass** (local→remote commits
shown; launcher never pulls), **DIRTY-TREE SAFETY: pass** (no auto-pull
anywhere; update check is read-only).

## Launcher V2

- **LAUNCHER LOGO: canonical** — the paw emblem PNG (branding family) replaces
  the old squiggle SVG, in titlebar + hero.
- **LAUNCHER WINDOW ICON / TASKBAR ICON: pass** — `icon.ico` regenerated from
  the canonical `public/icons/icon-512.png` (multi-size, 256 PNG frame).
- **CUSTOM/INTEGRATED TITLEBAR: pass** — `decorations:false`, drag region,
  min/max/close, double-click maximize; theme-aware surface.
- **WINDOW SNAP: pass** — Tauri 2 keeps native resize borders/hit-testing on
  undecorated Windows windows (Snap, drag, resize preserved); maximized and
  narrow screenshots confirm correct layout.
- **LAUNCHER V2 VISUAL REBUILD: pass** — hero (canonical emblem, name, tagline,
  Development workspace chip), CURRENT WORKBENCH card (Desktop/Web/Source
  cells + explicit freshness label + explanation), one dominant Launch button,
  compact secondary actions, diagnostics drawer, intentional footer.
- **THEME SELECTOR V2: pass** — custom accessible combobox, all 16 catalog
  themes with swatches + check, Arrow/Enter/Escape/Home/End keyboard (verified
  over CDP), floating frosted menu.
- **LAUNCHER THEME SYNC: pass** — shared `launcher-theme.json`; existing user
  theme preserved (found and kept Aurora).
- **LAUNCHER MOTION: pass** — instant click acknowledgment on every control,
  animated timeline, popover/card transitions, reduced-motion respected.
- **DESKTOP MISSING UX: pass** — primary becomes "Build & Launch Wildlife
  Incident Handoff" + "Launch previous verified build · <version>" (screenshot
  captured with the real EXE hidden).
- **BUILD & LAUNCH: pass** — after a successful build the primary returns to
  Launch (auto-launches when the user initiated Build & Launch).
- **DIAGNOSTICS: pass** — launcher/source versions + commit + dirty state +
  desktop version/commit/path + web build id + release/current path + git
  remote + last build result; Copy button; no secrets.

## Map side (Parts XII–XVI)

- **MAP LIST SINGLE CLICK: pass** — selects the incident, opens the inspector,
  stays on Map (URL asserted); never navigates.
- **MAP FLY TO INCIDENT: pass** — smooth flyTo at a reasonable zoom from far,
  small pan when visible; **PRIVACY-SAFE CAMERA: pass** — the camera target is
  the same `markerPositionFor(effectivePrivacy(...))` position the marker uses
  (source contract test); sensitive/approximate semantics untouched.
- **CLUSTER EXPANSION: pass** — a visible-but-clustered point zooms to break
  the cluster (found in packaged acceptance: continent view → street level,
  individual emphasized marker).
- **MAP LIST → MARKER SYNC / MARKER → LIST SYNC: pass** — row ↔ marker
  selection both ways; marker carries `data-ref-id`, row gets accent rail +
  tint + `aria-selected`; selected row scrolls into view.
- **DOUBLE CLICK OPEN: pass** · **EXPLICIT OPEN INCIDENT ACTION: pass** (button
  on every row + inspector) · **KEYBOARD MAP-LIST UX: pass** (Up/Down navigate,
  Enter selects, Ctrl+Enter opens).
- **CONTEXT MENU: pass** — Open incident / View on map / Bookmark / Copy
  reference / Export.
- **FILTERING: pass** — selection clears gracefully when the incident is
  filtered out of the visible set (map effect, Part XV).
- **CAMERA MEMORY: pass** — previous camera remembered once per selection;
  "Back to previous view" appears only after a selection-driven fly; Reset
  view unchanged.

## Screenshots

- FINAL LAUNCHER SCREENSHOTS: `screenshots/v030-dev7-launcher/` (13 PNGs:
  Forest Night / Aurora / Midnight Ops, theme menu open, diagnostics,
  update-no-remote, desktop-missing, build running early+mid, build complete,
  titlebar narrow + maximized).
- FINAL MAP SCREENSHOTS: `screenshots/v030-dev7-map/` (4 PNGs: list idle,
  selection + inspector, street-level selected marker + camera, bookmarked).
- Visual acceptance: all 15 judged **pass** (minor nits noted in the judge
  output: swatch contrast in the theme popover, long-path wrap in diagnostics).

## Packaged acceptance (Part XXII)

- Real launcher EXE: identity states, theme combobox, update check, Launch
  button (actually spawned the packaged portable), Build button (real
  end-to-end build; manifest rewritten at `cf1d153`, launcher stayed CURRENT).
- Real packaged Workbench EXE: smoke 7/7; map interaction exercised over CDP.

## Remaining blockers

None known for the dev.7 scope. Noted, non-blocking: the update-available and
offline states were verified by state-machine inspection and unit-level
classification (this checkout has no remote and no network mock was available
for a live fetch); the no-remote state is verified live.
