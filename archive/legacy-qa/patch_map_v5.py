# -*- coding: utf-8 -*-
p = 'src/features/network/NetworkMap.tsx'
s = open(p, encoding='utf8').read()

s = s.replace(
    'import { disableTerrain, enableTerrain, queryElevationM, resetCompass, setMeasureLine } from "./map/v4Map";',
    'import { disableTerrain, easePitch, enableTerrain, queryElevationM, resetCompass, setMeasureLine } from "./map/v4Map";\n'
    'import { CONCERN_TYPES, isAnimalConcern } from "../incidents/concernTypes";')

s = s.replace(
    '  const [view, setView] = useState({ bearing: 0, pitch: 0 });',
    '  const [view, setView] = useState({ bearing: 0, pitch: 0 });\n  const preTerrainPitchRef = useRef(0);')

old_terrain = '''    const wantTerrain = mode === "terrain" && !offline && prefs.layers.terrain;
    if (wantTerrain) {
      // Real DEM or nothing: a failed setup falls back to 2D with an honest
      // notice (never synthesized elevation).
      const ok = enableTerrain(map, prefs.exaggeration, () => setTerrainFailed(true));
      setTerrainActive(ok);
      if (!ok) {
        setTerrainFailed(true);
        setPrefs((p) => ({ ...p, mode: "2d" }));
        return;
      }
      setTerrainFailed(false);
      map.easeTo({ pitch: TERRAIN_PITCH, duration: 500 });
    } else {
      disableTerrain(map);
      setTerrainFailed(false);
      if (mode !== "terrain") map.easeTo({ pitch: 0, duration: 400 });
    }
  }, [mapReady, mode, offline, prefs.layers.terrain, prefs.exaggeration, terrainAttempt]);'''

new_terrain = '''    const wantTerrain = mode === "terrain" && !offline && prefs.layers.terrain;
    if (wantTerrain) {
      // 0.3.0-dev.5 (spec 29): a failed setup NO LONGER kicks the user to 2D.
      // Terrain stays selected with an honest notice + [Retry]/[Use 2D map];
      // the operator decides. Never synthesized elevation.
      const ok = enableTerrain(map, prefs.exaggeration, () => setTerrainFailed(true));
      setTerrainActive(ok);
      if (!ok) {
        setTerrainFailed(true);
        return;
      }
      setTerrainFailed(false);
      // Preserve the user's center/zoom/bearing — only tilt the camera.
      try { preTerrainPitchRef.current = map.getPitch(); } catch { /* map gone */ }
      map.easeTo({ pitch: TERRAIN_PITCH, duration: 500 });
    } else {
      disableTerrain(map);
      setTerrainFailed(false);
      // Returning to 2D restores the previous 2D pitch while keeping location.
      if (mode !== "terrain") map.easeTo({ pitch: preTerrainPitchRef.current ?? 0, duration: 400 });
    }
  }, [mapReady, mode, offline, prefs.layers.terrain, prefs.exaggeration, terrainAttempt]);'''

assert old_terrain in s
s = s.replace(old_terrain, new_terrain)

old_vis = '''  const visibleIncidents = useMemo(
    () => filterByStatuses(filterByTimeRange(incidents, prefs.timeRange), prefs.statuses),
    [incidents, prefs.timeRange, prefs.statuses],
  );'''
new_vis = '''  const visibleIncidents = useMemo(() => {
    const inTime = filterByTimeRange(incidents, prefs.timeRange);
    const inStatus = filterByStatuses(inTime, prefs.statuses);
    // 0.3.0-dev.5 concern filter (spec 48): legacy records are wildlife_animal.
    if (prefs.concern !== "all") {
      return inStatus.filter((i) => (i.concernType ?? "wildlife_animal") === prefs.concern);
    }
    return inStatus;
  }, [incidents, prefs.timeRange, prefs.statuses, prefs.concern]);'''
assert old_vis in s
s = s.replace(old_vis, new_vis)

s = s.replace(
    '<span>{t("mv4TerrainError", { defaultValue: "Terrain unavailable — using the 2D map. Terrain 3D needs an internet connection and WebGL." })}</span>',
    '<span>{t("mv4TerrainError", { defaultValue: "Terrain unavailable — elevation couldn\'t load. Terrain 3D needs an internet connection and WebGL." })}</span>')

old_retry = '''            {t("mv4TerrainRetry", { defaultValue: "Retry" })}
          </button>
        </div>
      )}'''
new_retry = '''            {t("mv4TerrainRetry", { defaultValue: "Retry" })}
          </button>
          <button className="btn btn-quiet btn-sm" onClick={() => setPrefs((p) => ({ ...p, mode: "2d" }))}>
            {t("mv4TerrainUseStreets", { defaultValue: "Use 2D map" })}
          </button>
        </div>
      )}'''
assert old_retry in s
s = s.replace(old_retry, new_retry)

old_compass = '''            <button className="btn btn-quiet btn-sm mv4-ctl" onClick={resetCompassView} aria-label={t("mv4Compass", { defaultValue: "Reset compass — face north, level view" })} title={t("mv4Compass", { defaultValue: "Reset compass — face north, level view" })}>
              <span aria-hidden="true" style={{ display: "inline-block", transform: `rotate(${-view.bearing}deg)` }}>↑</span>
              {t("mv4CompassShort", { defaultValue: "N" })}
            </button>'''
new_compass = '''            <button className="btn btn-quiet btn-sm mv4-ctl" onClick={resetCompassView} aria-label={t("mv4Compass", { defaultValue: "Reset north" })} title={t("mv4Compass", { defaultValue: "Reset north" })}>
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" style={{ display: "inline-block", transform: `rotate(${-view.bearing}deg)` }}>
                <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.5" />
                <path d="M8 2 L10 8 L8 7 L6 8 Z" fill="#ef4444" />
                <path d="M8 14 L6 8 L8 9 L10 8 Z" fill="currentColor" opacity="0.8" />
              </svg>
              {t("mv4CompassShort", { defaultValue: "N" })}
            </button>
            {mode === "terrain" && (
              <button
                className="btn btn-quiet btn-sm mv4-ctl"
                aria-pressed={(view.pitch ?? 0) > 5}
                onClick={() => {
                  const map = providerRef.current?.getMap();
                  if (!map) return;
                  easePitch(map, (view.pitch ?? 0) > 5 ? 0 : TERRAIN_PITCH);
                }}
                title={t("mv4Tilt", { defaultValue: "3D tilt on / off" })}
              >
                {t("mv4Tilt", { defaultValue: "3D tilt on / off" })}
              </button>
            )}'''
assert old_compass in s
s = s.replace(old_compass, new_compass)

old_measure = '''              <span style={{ fontSize: "0.82rem" }}>
                {measureKm != null
                  ? t("mv4MeasureResult", { defaultValue: "Distance: {{distance}}", distance: formatDistance(measureKm, units) })
                  : t("mv4MeasureHint", { defaultValue: "Click two points on the map to measure the distance. Esc exits." })}
              </span>'''
new_measure = '''              <span style={{ fontSize: "0.82rem" }}>
                {measureKm != null
                  ? t("mv4MeasureResult", {
                      defaultValue: "Distance {{distance}} · Bearing {{bearing}}",
                      distance: formatDistance(measureKm, units),
                      bearing: measureBearing,
                    })
                  : t("mv4MeasureHint", { defaultValue: "Click two points on the map to measure the distance. Esc exits." })}
              </span>'''
assert old_measure in s
s = s.replace(old_measure, new_measure)

old_km = '''  const measureKm =
    measurePts.length === 2 ? greatCircleKm(measurePts[0]![1], measurePts[0]![0], measurePts[1]![1], measurePts[1]![0]) : null;'''
new_km = old_km + '''
  const measureBearing =
    measurePts.length === 2 ? bearingToCompass(initialBearingDeg(measurePts[0]![1], measurePts[0]![0], measurePts[1]![1], measurePts[1]![0])) : null;'''
assert old_km in s
s = s.replace(old_km, new_km)

old_status = '''              <div className="mv4-group">
                <span className="mv4-label">{t("mv4StatusFilter", { defaultValue: "Statuses" })}</span>'''
new_status = '''              <div className="mv4-group">
                <span className="mv4-label">{t("mv4ConcernFilter", { defaultValue: "Concern type" })}</span>
                <select
                  className="input"
                  aria-label={t("mv4ConcernFilter", { defaultValue: "Concern type" })}
                  value={prefs.concern}
                  onChange={(e) => setPrefs((p) => ({ ...p, concern: e.target.value }))}
                >
                  <option value="all">{t("mv4ConcernAll", { defaultValue: "All concerns" })}</option>
                  {CONCERN_TYPES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div className="mv4-group">
                <span className="mv4-label">{t("mv4StatusFilter", { defaultValue: "Statuses" })}</span>'''
assert old_status in s
s = s.replace(old_status, new_status)

open(p, 'w', encoding='utf8', newline='\n').write(s)
print('patched OK')
