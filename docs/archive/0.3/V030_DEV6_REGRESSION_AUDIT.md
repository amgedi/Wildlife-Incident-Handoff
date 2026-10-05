# 0.3.0-dev.6 Baseline + Regression Audit + Final Report (2026-10-05)

## Part 0 — baseline (confirmed from repo + packaged EXE)

- Version before: **0.3.0-dev.5** @ `8fe8ae4` / frontend `0b9a95609a28` — confirmed in git, `release/current/manifest.json`, and the running EXE's About.
- All older Wildlife processes killed; only the current packaged EXE launched for QA.
- Before-screenshots: `screenshots/archive/v030-dev6-before/`.
- Baseline tests: 629/629 frontend, 7/7 Rust, typecheck clean, smoke 7/7.

## Part I — regression audit (packaged EXE + source)

| Area | Baseline class | dev.6 action |
| --- | --- | --- |
| Location Intel / nearest place | **BROKEN** — literal `\ud83d\udccd` etc. rendered | Fixed (see below) |
| Live Activity | **BROKEN** layout — one-word-per-line column | Fixed (see below) |
| Titlebar search center | DEGRADED (perceived) | Verified geometrically centered (offset 0px @1680w); narrow-mode icon collapse added |
| In-app titlebar mark | WORKING (theme tokens; all 16 themes define them) | Verified; native icons unchanged by design (see report note) |
| Response Flow | DEGRADED (monochrome) | V6 stage accent colors |
| Export filenames | DEGRADED (no dates) | Date-aware sanitized names |
| Analytics Time-Window drawer | DEGRADED (unfinished) | V6 rebuild |
| Duplicate review | DEGRADED (debug-panel look) | V6 rebuild |
| Map popup | DEGRADED (close placement, duplication) | V6 rebuild |
| Sidebar bottom | DEGRADED ("Local only" + divider) | Removed (LAN state only when action needed) |
| Right-click | MISSING | Shared context menu |
| Wildlife Stewardship | DEGRADED (off state = bare checkbox) | V6 preview + on-state verified intact |
| Professional verification | DEGRADED (textarea-as-verification) | V6 structured evidence packets |
| Bookmarks | MISSING | New system |
| Dashboard / Needs Attention / Network Pulse / Incidents / Profile / Test View / Onboarding / Help / Settings / Themes / Launcher / Command Palette / Devices / LAN / Backup / Terrain | WORKING | No changes; smoke + suites pass |

## Root causes found

1. **Escaped Unicode (Part II)**: `NetworkMap.tsx` Location Intel embedded literal
   `\ud83d\udccd`-style sequences in **JSX text children** — JSX does not process
   JavaScript string escapes, so they render raw. Fix: rebuilt as structured
   semantic rows with real SVG icons (pin/compass/home/map/crosshair); emoji are
   no longer used as structural UI anywhere. Scan across
   network/incidents/profile/help in the packaged EXE: **0 escaped sequences**;
   sensitive locations still block remote nearest-place lookup with a clear
   explanation.
2. **Live Activity narrow-column collapse (Part IV)**: `.ops-feed-item` declared a
   2-column grid (time | body) but the V5 row has 3 children (time, accent rail,
   body) — the body landed in a 52px implicit column. Fix: canonical
   `48px 3px minmax(260px,1fr)` grid for V5 rows; verified in-EXE event content
   width 454px, single-line height 21px.
3. **Stewardship "degraded" (Part XIII)**: the OFF state was only a checkbox +
   privacy note; the ON state (level/progress/badges/showcase) was intact. Fix:
   rich OFF preview (what milestones mean, preview badges, enable CTA), contract
   checkbox retained.
4. **Verification "textarea" (Part XIV)**: replaced with a structured,
   role-specific evidence checklist (VerificationProvider seam,
   `LocalPreparationOnly`), readiness = "N of M sections prepared", honest states
   ("Not verified" / "Evidence prepared (local) · Not externally verified").
   Nothing is submitted; no external verification is claimed.

## dev.6 verification in the packaged EXE (`qa/dev6-qa.mjs` + interactive CDP)

- Escaped unicode scan: **0** across network/incidents/profile/help.
- Live Activity: content column 454px wide, no collapse.
- Sidebar: "Local only" + orphan divider gone.
- Titlebar search: **offset 0px** from window center at 1680w (grid 1fr/auto/1fr).
- Bookmarks: star toggles on a report card, persists, `?bookmark=1` filters
  (1 card shown); Bookmarked pin in sidebar; detail + inspector + analytics
  drawer share the same control.
- Context menu: right-click on a report card opens 5 actions (Open / Bookmark /
  Copy reference / View on map / Export); text inputs keep native edit menus.
- Map inspector V6: close top-right ✓, structured intel rows ✓, bookmark ✓,
  Measure from here ✓, no escaped unicode ✓ (screenshot
  `screenshots/archive/v030-dev6-after/map-inspector-v6.png`).
- Desktop smoke: **7/7** on the final dev.6 EXE.
- Frontend tests after changes: **629/629**; Rust 7/7; typecheck clean.

## Version

- **0.3.0-dev.6** (no RC). Final packaged identity: commit `52c48c9`, frontend
  `a53e9c109046`, artifacts in `release/desktop/` (+ checksums/manifest);
  promoted to `release/current/` via `release:all` conventions.

## Honest icon distinction (spec 55)

- In-app titlebar mark + onboarding/About logos: theme-token driven (SVG).
- Native window / taskbar / Start Menu / installer icon: static canonical paw —
  intentionally NOT theme-switched (native runtime icon swapping is unreliable).

## Remaining blockers

1. Signed auto-update still blocked (no signing infrastructure).
2. Context menus cover incident cards and activity rows; the map-marker
   right-click menu and blank-area menu were deferred (actions exist elsewhere).
3. Analytics drawer bookmark updates require the dashboard data refresh — wired
   via `refresh()`; deep-linking from drawer rows navigates via react-router.
