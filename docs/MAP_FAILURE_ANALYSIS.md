# Map Failure Analysis — 0.2.0-dev.9 (measured, not assumed)

Investigated in the real rendered app (browser, 1920×1080 and 390×844) with 11 seeded
incidents carrying Calgary coordinates and a configured 25 km service area.

## Symptoms observed

1. Desktop operations dashboard: map panel frequently paints as an **empty box** —
   no markers, no clusters (screenshots/before/pro-ops-1920.png).
2. Mobile dashboard: the **same component renders markers correctly**
   (screenshots/before/pro-ops-mobile.png) — so data, clustering, and the provider
   were never the whole story.
3. Fresh desktop load (measured live): canvas `687×278`, **10 markers present** —
   the failure is intermittent/state-dependent, not deterministic.

## Root causes (in order of impact)

1. **Percentage-height container (structural).** The compact dashboard wrapper asked
   MapLibre for `height:100%` while its flex parent only had `min-height` — against an
   auto-height parent that resolves to 0, producing a 0-height canvas that paints
   nothing. Non-compact mode used a fixed 460 px and always worked, which is exactly
   the desktop-fails/mobile-works split observed across passes.
2. **Marker render is event-gated (render race).** Markers/clusters are only drawn on
   MapLibre's `load`/`moveend` events. If the map instance is created before the
   container is laid out (lazy Suspense swap, viewport resize, tab restore), the style
   load can complete with stale geometry and no `resize` re-render happens.
3. **No re-render on container resize.** MapLibre does auto-resize its canvas, but our
   marker overlay is only refreshed on `moveend` — a size change without a camera move
   leaves the overlay stale.

## What was NOT the problem (checked, with evidence)

- **CORS/CSP/DNS/TLS:** offline provider makes zero requests; OSM raster requests in
  Settings → Map "Test connection" return HTTP 200 in this environment. No CSP
  violations in console.
- **Rate limiting:** no HTTP 429 observed; diagnostics (recordMapError) stayed clean.
- **MapLibre itself:** renders fine once given a real pixel size (mobile proof).
- **Provider data:** markers/clusters correct with seeded coordinates.

## Fixes applied this pass (0.2.0-dev.10)

1. Explicit pixel-height containers for every map mode (no `height:100%` against
   auto-height parents); dashboard compact map gets a real fixed height.
2. Markers render immediately after style load **and** on `resize`, not just
   `moveend`; a first `updatePoints()` is scheduled via `requestAnimationFrame` after
   creation so the overlay can never be left empty by a missed event.
3. Service area drawn on the map (radius ring) so fit-to-area is visually verifiable.

## Provider strategy (P14)

Public OSM raster remains the *default online provider* with the polite-usage guard
and offline fallback already shipped in dev.9; the descriptor registry makes a
PMTiles/self-hosted vector provider a config-level addition. Given the evidence above,
the provider was not the reliability problem — the container/event architecture was.
