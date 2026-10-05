# 0.3.0-dev.3 Baseline (focused polish pass)

Date: 2026-10-04 · Branch `0.3.0-overhaul` · dev.2 exit state: commit `c73d80b`, tag `v0.3.0-dev.2`

## Verified at pass start

- Frontend 483/483, Rust 7/7, typecheck clean, web build clean.
- Portable smoke 7/7 on 0.3.0-dev.2; 60/60 official tour runs (0 auto-skips).
- dev.19 checkpoint/tag untouched.

## Owner feedback confirmed in the real EXE (before screenshots in `screenshots/archive/v030-dev3-before/`)

1. Network list view: Live Activity alone at span-6 left the right half empty. → fixed with the Network Pulse module.
2. Incident rows: actions visually disconnected. → rebuilt (priority actions, vertically centered, icon detail quiet).
3. External paw icon: restored already in dev.2 (owner clarification); re-audited this pass.
4–6. Materials felt like plain CSS opacity; several themes had weak ambient. → material V4 recipe (blur+saturate+tint+highlight+grain+edge, 3 depth levels) + ambient coverage audit.
7. **Map load bug**: reproduced the class — root cause found and fixed (see below).
10–13. Test View shallow/no coordinates. → full seeded simulation (Test View V4).
14. "New value" generic correction labels. → field metadata registry.
15. Titlebar Search off-center. → 1fr/auto/1fr grid + measurement test.
16. Sidebar dead space. → contextual sections (pinned/recent/status).
17–18. Recognition bland. → Wildlife Stewardship progression (game-like, safety-bound).

## Map load bug root cause (release blocker, spec 11)

The map controller created `new maplibregl.Map({container})` the moment markers
rendered — which can be while the container is still 0-sized (lazy route
mount, tab switch). Nothing resized the canvas after layout settled, so the
map stayed blank until the basemap toggle recreated the style. Fix: a
ResizeObserver on the container, a resize after style load, and one bounded
automatic style retry when the style fails before ever loading. Contract
tests: `src/features/mapReliability.test.tsx`. Stress QA on the compiled EXE:
see the dev.3 final report.

## Work partitioning

- Main session: map root cause, Network Pulse, Live Activity V4, incident rows,
  titlebar centering, sidebar v4, material V4, theme-aware window icon, wiring.
- Agents (disjoint files): Test View V4 simulation, Map V4 field operations,
  Recognition V4 + field-aware correction dialogs.
