# GUI Overhaul — Before / After (0.2.0-dev.9 → 0.2.0-dev.10)

Before shots: `screenshots/archive/before/` · After shots: `screenshots/archive/after/`
Audit with per-screen verdicts: `docs/GUI_OVERHAUL_AUDIT.md`

## Operations dashboard (professional)
- **Before** (`before/pro-ops-1920.png`): empty white map box (compact map rendered a 0-height canvas), Live activity floating alone beside 8 empty grid columns, plain white cards, ~1130 px content column with dead margins at 1920.
- **After** (`after/pro-ops-1920.png`, `after/pro-ops-1600.png`, `after/pro-ops-1366.png`): real map with markers, service-area ring and inspector; hole-free grid; severity-ramped Needs Attention; full-width pulse strip; activity(4)+flow(8) pairing; 1560 px content. Why better: the primary situational anchor actually shows the situation, and the layout has no dead zones — it reads as an operations console, not a card pile.

## Full map destination
- **Before** (`before/pro-map-1920.png`): the "Map" segmented just re-showed the dashboard.
- **After** (`after/pro-map-1920.png`): a real full-height map page (`calc(100dvh - 240px)`) with service-area summary and back link. Why better: a professional asking for the map gets the map.

## Help Center
- **Before** (`before/pro-help-1920.png`): single skinny column of bordered paragraph-cards; right half of a 1920 screen empty; no article reader.
- **After** (`after/pro-help-1920.png`, reporter variant): persistent rail (search, categories, tutorials, glossary, support) + reading pane with related links, Show me, helpful-feedback. Why better: it behaves like documentation, not a card grid.

## Analytics
- **Before**: grouped bars with a clipped "Oct"-style axis; flat progress-bar distributions.
- **After**: gradient area chart with crosshair + dot readout and padded axis (`TrendChart.tsx`); stacked segmented distribution with legend list (`opsCharts.tsx`); proportional aging strip with 4 h+ emphasis. Why better: higher information density, no clipped labels, theme-aware, still accessible (data table + text rows by construction).

## Map reliability
- **Before**: intermittent blank desktop map (percentage-height container + overlay re-render race) — screenshots captured one live occurrence.
- **After**: explicit heights, resize/rAF overlay refresh, refId-based clicks, service-area ring. Verified interactively in browser; root causes + measurements in `docs/MAP_FAILURE_ANALYSIS.md`.

## Languages
- **Before**: en/fr/es only selectable; 10 catalog locales had no pack files at all (silent English fallback).
- **After**: de + pt-BR authored to 100% key parity (872 keys each) and selectable; live-switch sweep across Home/Reports/Help/Network passes for all five; pseudo-locale sweep fixed the hard-coded strings it exposed (headings, card meta, legend, notices, support namespace).

## Shell / mobile
- Sidebar footer bounds verified at 650/720/768/900/1080 px heights; mobile drawer + bottom nav unchanged (was already GOOD — preserved); scroll ownership re-verified by touch-scroll at 390×844.

## Tutorial engine
- Retained (generation-token state machine was already sound); 20 documented runs — 10 reporter + 10 professional across 1366/1600/1920, normal/fast pacing, one Back-step variant and one exit+restart variant — **20/20 completed, 0 target failures**.

## Performance (1,014 incidents seeded)
- Dashboard ready ~1.3 s · list (100 cards) ~0.46 s · language switch (lazy pack) ~1.0 s · map DOM bounded via dense clustering (104 clusters + 9 markers instead of 1,014 marker nodes).
