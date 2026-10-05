# GUI Overhaul Audit — 0.2.0-dev.9 (BEFORE)

Judged from the **rendered application** (Vite build served in a real browser), with
realistic seeded data (11 Calgary incidents across all response stages + configured
25 km service area). Screenshots: `screenshots/archive/before/`. Changelogs and tests were
explicitly **not** treated as evidence of quality.

## Professional workspace

| Screen | Verdict | Why |
|---|---|---|
| Operations dashboard (`pro-ops-1920/1600/1366`) | **NEEDS MAJOR REDESIGN** | (1) The 12-column grid has **holes**: Live activity (span 4) sits alone in its row with 8 empty columns beside it; the pipeline lands a row later. (2) The map panel — supposed to be the primary situational anchor — is an **empty white box on desktop**: the compact map renders a 0-height canvas (`height:100%` inside an auto-height flex parent), so nothing paints. On mobile the same map renders markers fine, proving it is a layout bug, not a data/provider bug. (3) Everything is plain white rounded cards on a pale gradient — no operational density, no hierarchy, reads as "generic admin dashboard". (4) Content column is capped too narrow (~1130 px) at 1920, leaving huge dead margins on a "wide" ops page. (5) No service-area context visible on the dashboard beyond a text label. |
| Full map destination (`?view=map`, `pro-map-1920`) | **REPLACE** | "Open full map" shows the same dashboard grid with "Map" segmented active — there is no real full-screen map page. |
| Map system | **NEEDS MAJOR REDESIGN (root cause found)** | Compact (dashboard) map: `height:100%` wrapper inside an auto-height parent ⇒ 0-height canvas ⇒ blank. Non-compact (mobile) works. This is the actual root cause of the "map has repeatedly failed" experience — not tiles, not MapLibre, not the provider. |
| Needs Attention | NEEDS REFINEMENT | Structure is right (count + reason + oldest + action) but reads as generic cards; no priority ordering (the >2h wait should lead), no visual severity ramp. |
| Live activity | NEEDS REFINEMENT | Row spacing is loose, event names repeat "Incident created" without icons; the card floats alone next to a grid hole. |
| KPI strip / pipeline / aging | NEEDS REFINEMENT | Correct data, honest deltas, but visually flat; pipeline and aging are plain number+label rows. |
| Distributions | NEEDS REDESIGN | Crude horizontal filled bars with a 100%-single-value look; the "data quality" case (unknown animal group) is handled but the presentation is a dead-end paragraph. |
| Response network / queue rows | NEEDS REFINEMENT | IncidentQueueRow is consistent, but action alignment and meta density still read unfinished; table mode is bare. |
| Help Center (`pro-help-1920`) | **REPLACE** | A single skinny column of bordered cards, each a paragraph stub, with the right half of a 1920 px screen empty. This is exactly the "12 rectangles with paragraphs" antipattern — not a Help product. No article reader pane, no persistent category nav. |
| Settings | GOOD (preserve) | Clear section rail, search, honest copy. Minor visual polish only. |

## Reporter workspace

| Screen | Verdict | Why |
|---|---|---|
| Home (`rep-home-1920`) | NEEDS REFINEMENT | Right structure (safety → CTA → latest → counts → drafts) but visually flat: uniform white cards, weak typographic hierarchy, the greeting is small, the safety card is a plain bullet list. Should feel warm and guided, not form-like. |
| My reports (`rep-reports-1920`) | GOOD-ish (refine) | Search + filters + cards work; polish card hierarchy and status coloring. |
| Report wizard (`rep-report-1920`) | NEEDS REFINEMENT | Steps are clear but visually monotonous; step rail is a row of numbered buttons with no progress feel. |
| Help (reporter) | REPLACE | Same single-column card list. |
| Mobile (`rep-home-mobile`, `pro-ops-mobile`) | **GOOD** | Drawer shell + bottom nav work, touch scrolling fine, markers render, nothing clips. Preserve. |

## Shell

- Verdict: **NEEDS REFINEMENT** (not replace).
- A stray white rectangle artifact appears over the sidebar footer area at 1920 (`pro-ops-1920`, bottom-left).
- Sidebar identity, work-only nav, and bottom utility placement are correct; spacing/typography inside the sidebar are inconsistent with the new design system goals.
- Scroll ownership is correct (single `.main-area` owner) — verified by interaction, not just CSS.

## Cross-cutting

- Type scale is under-differentiated (h1/h3 look similar in cards); section labels do heavy lifting with all-caps micro-text everywhere.
- Elevation: one shadow value reused; cards, popovers and dialogs don't have a depth ladder.
- Charts: plain SVG lines/bars without area treatment, crosshair, or theme-aware gradients.
- Monochrome Dark: not re-judged here (token work scheduled this pass).
- Languages: 10 of 13 catalog locales have **no pack files at all** (silent English fallback if shown). Feasibility check: 856 keys/locale. Plan this pass: fully author de + pt-BR (machine-assisted, marked), keep others hidden honestly, document roadmap.

## Disposition summary

- REPLACE: Help Center layout; full-map destination (make it a real map page).
- NEEDS MAJOR REDESIGN: Operations dashboard grid + map compact container (root-cause fix), distributions/analytics visuals.
- NEEDS REFINEMENT: Reporter home, needs-attention/activity/KPI styling, queue rows, shell details, type/elevation system.
- GOOD (preserve): Settings IA, mobile shell, scroll architecture, onboarding flow.
