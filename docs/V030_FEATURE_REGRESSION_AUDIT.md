# 0.3.0-dev.5 Feature Regression Audit (Part I)

Audited from source at `da3a0a3` (dev.4) plus runtime checks against the packaged
dev.4 portable EXE (CDP :9222, profile `qa-dev5-base`). Classification:
PRESENT + WORKING / PRESENT + DEGRADED / BROKEN / MISSING / DEFERRED.

| Area | Class | Evidence / notes |
| --- | --- | --- |
| Dashboard | PRESENT + DEGRADED | 12-col ops grid, saved layout with dev.4 repair migration, clickable counters work. Professional hero uses reporter `firstName` while `firstNamePro` is computed but unused (HomePage.tsx ~L225). |
| Needs Attention | PRESENT + WORKING | 5 tile kinds, severity classes, confirm-guarded hide, navigates to filtered incidents. |
| Response Flow | PRESENT + WORKING | Stage rail v3, counts/drawer scope invariant tested; keyboard nav; nothing auto-selected. |
| Response Network | PRESENT + DEGRADED | Owner-reported: excessive empty space, awkward fixed dimensions on cards (Open by status / Animal groups / Incident types sized as giant equal-height containers). Accept action stamps `Accepted by Riverside Wildlife Rescue (example)` from the single-entry `LOCAL_ORG_REGISTRY` (placeholder data). `noneMapProvider` is a declared placeholder. |
| Network Pulse | PRESENT + DEGRADED | Content present (active handoffs, oldest pending, orgs, transfers today…) but empty state reserves large height; label mismatch (widget `networkOrgs` labeled "Response network" in customize, "Network pulse" on card). |
| Live Activity | **BROKEN (quality regression)** | Feed collapsed to near-reference rows: time + summary + ref; most metadata (actor detail, status transitions, org beyond handoffs, concern) dropped; no icons/accent differentiation chips; no filters; no grouping; no new-activity badge. Owner report #5 confirmed. |
| Map | PRESENT + DEGRADED | 2D/Satellite/Terrain, layer panel w/ time+status filters, cluster inspector, camera memory `{full,compact}`, measure tool, privacy fuzzing all present in code. BUT: terrain kick-out reported by owner (see Terrain row); "↑ N" text control instead of a real compass (owner #10/#11 — confusing, reported not working); measure points are generic dots, not designed pins (owner #9); no map filter bar for concern-type (pre-expansion). |
| Map privacy | PRESENT + WORKING | Per-incident precision (exact/approximate/sensitive), fuzzed rendering, field lens coarse elevation only. |
| Terrain | **BROKEN (owner machine)** | Code: AWS terrarium DEM + hillshade, error handler, retry UI, CSP allows `s3.amazonaws.com`. Owner reports selecting Terrain 3D kicks back out on an online machine and no visible terrain. NOT accepted (spec Part VII). Needs live repro: DEM fetches, encoding (terrarium vs mapbox), CORS, error-class mapping. |
| Incidents | PRESENT + WORKING | Category filters, saved views, pin/unpin, search, table/cards. |
| New Intake | PRESENT + DEGRADED | 10-step wizard, drafts, guided mode. Animal-only domain: `AnimalInfo` mandatory, no non-animal concern model (owner #16). |
| Profile | PRESENT + WORKING | Name/contact/photo/borders/country/language/stewardship/roles. |
| Devices | PRESENT + WORKING | Crypto identity, trust/pair/revoke, honesty contract. |
| Country | PRESENT + WORKING | Presentation-only defaults; hand-rolled 18-entry country list in onboarding. |
| Report Integrity | PRESENT + DEGRADED | Signals + dismissals work; dashboard panel is a static long list (owner #121: needs compact summary + top candidates). |
| Duplicate Review | PRESENT + WORKING | V4 union-find clusters, chips, compare actions, nothing auto-merged. |
| Wildlife Stewardship | PRESENT + WORKING | Opt-in recognition, quality gates, showcase; honest limits. |
| Test View | PRESENT + WORKING | Roles × intensity × seed, isDemo flags, reset deletes only generated. Analytics population from sim is partial. |
| Themes | PRESENT + DEGRADED | 16 themes incl. forest-night/midnight-ops/storm/aurora; ambient layers valid. **Default theme is `forest-dark`, NOT Forest Night** (owner #24). Onboarding picker lists only the original 10 themes — 6 missing (stale list regression). |
| Materials | PRESENT + WORKING | solid/frosted/glass via `--material-*` tokens; backdrop-filter narrowly applied (3 rules) + reduce-transparency opt-outs. |
| Onboarding | **BROKEN** | Stage 4 (privacy) Next button called `setStage(4)` — dead button; **reproduced in packaged dev.4 EXE** (20 clicks, no advance). Fixed in source this pass; rebuild pending. Theme picker stale (above). Logo/theme-response not yet verified (owner #28). |
| Tutorials | PRESENT + WORKING | 4 tours on shared spotlight engine, honest result logging, versioned keys. |
| Help | PRESENT + WORKING | Categories/articles, role-scoped, search, privacy-safe support bundle. |
| Backup | PRESENT + WORKING | Versioned container, SHA-256 manifest, staged restore, never overwrites. |
| LAN | PRESENT + WORKING | Encrypted pairing, LWW merge, demo records excluded, desktop-only honesty. |
| Notifications | PRESENT + WORKING | Local records, quiet hours, honest channel gating. |
| Command Palette | PRESENT + WORKING | Ctrl+K across nav/incidents/views/settings/help. |
| Analytics | **PRESENT + DEGRADED (accuracy + design)** | Hand-rolled SVG; `TrendChart.tsx` uses **Catmull-Rom spline** on counts — can visually dip below zero / invent values (owner #50 confirmed in code). No central metric registry with definitions; buckets derive local-day but are undocumented per metric; no click-for-details drawer; Case aging is a segmented band ( AgingStrip) not a real distribution with detail; no KPI modules w/ sparkline+definition tooltips. |
| Sidebar | PRESENT + DEGRADED | Pinned/Recent render between nav and footer, but `.sidebar nav.nav-footer { margin-top: auto }` + `.sidebar-status { margin-top: auto }` (base.css) keep pushing them toward the bottom on tall windows (owner #4/#13). Builtin pins "Waiting >2h"/"Handoffs" deep-link to broad category filters, not the described filters. |
| Window sizing | **MISSING (geometry memory)** | `min_inner_size(420, 560)` in main.rs; **no window size/position/maximized persistence anywhere** (owner #1/#4 area). Responsive behavior untested at spec sizes. |
| Launcher | **MISSING** | Root launcher is `Launch Wildlife Incident Handoff.cmd`; no native launcher exists. |
| Update system | **MISSING** | No updater; no signed update infrastructure (honest blocker per spec #98). |
| Web/desktop parity | PRESENT + DEGRADED | `desktop:release` exists with parity gates; no combined `release:all` producing web+desktop+manifest from one commit. |
| Root folder hygiene | DEGRADED | `_themes_tmp.css` scratch file in root; empty `locales/es`, `locales/fr` dirs; multiple dev-versioned EXEs in `release/desktop/` with no `current/` pointer; launcher .cmd in root. |

## Summary of confirmed regressions / product gaps driving dev.5

1. Onboarding privacy-step Next dead (BROKEN, reproduced; fixed in source, needs rebuilt-EXE verification).
2. Live Activity stripped to reference rows (quality regression vs. richer earlier feed).
3. TrendChart spline can fabricate sub-zero visual values (analytics accuracy).
4. Default theme is forest-dark, not Forest Night; onboarding theme list stale (6 themes missing).
5. Sidebar Pinned/Recent drift low via `margin-top: auto` behaviors.
6. No window geometry persistence; min size 420×560 below the 1024×768 usable floor.
7. Terrain not visibly verified on an online machine; kick-out behavior reported.
8. No native launcher; .cmd remains primary entry.
9. Response Network fixed-height cards wasting space; local-store sentence in workspace.
10. Incident domain is animal-only; no habitat/hazard/conflict concerns.

## Minor cleanups found
- `src/_themes_tmp.css` (unreferenced scratch) → remove.
- Empty `src/i18n/locales/es/`, `locales/fr/` dirs → remove.
- HomePage professional hero uses reporter firstName (fix alongside Live Activity V5).
- Widget id `networkOrgs` label mismatch ("Response network" vs "Network pulse") → unify.
- Sidebar builtin pins point at broad categories instead of their described filters.
