/** React wrapper for the MapLibre provider (network map tab). */
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import type { Incident } from "../../types/incident";
import { createMapLibreProvider, markerPositionFor, markerStateFor, STATUS_MARKER_COLORS, type MapPrivacy } from "./mapProvider";
import { animalLabel } from "../export/exportService";

type MapState = "loading" | "ready" | "offline" | "provider-failed" | "no-coordinates";

export function NetworkMap({
  incidents,
  privacy,
  onSelect,
  compact = false,
}: {
  incidents: Incident[];
  privacy: MapPrivacy;
  onSelect?: (incident: Incident) => void;
  /** Compact dashboard panel: reduced default height. */
  compact?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<MapState>(() => (incidents.length === 0 ? "no-coordinates" : "loading"));
  const [retryToken, setRetryToken] = useState(0);
  const providerRef = useRef<ReturnType<typeof createMapLibreProvider> | null>(null);

  useEffect(() => {
    if (incidents.length === 0) {
      setState("no-coordinates");
      return;
    }
    if (!containerRef.current) return;
    setState((s) => (s === "ready" ? s : "loading"));
    const provider = createMapLibreProvider();
    // Bounded failure detection: if tiles haven't produced a load event within
    // 8 seconds while errors fired, classify as provider failure.
    let settled = false;
    provider.setErrorHandler((isError) => {
      if (!settled && isError) {
        if (navigator.onLine === false) setState("offline");
        else setState("provider-failed");
      }
    });
    // A successful map load is authoritative: a single transient tile error
    // must not permanently mark the provider failed when tiles do arrive.
    provider.setLoadHandler(() => {
      if (!settled) {
        settled = true;
        setState("ready");
      }
    });
    providerRef.current = provider;

    const points = incidents
      .map((i) => {
        const pos = markerPositionFor(i, privacy);
        if (!pos) return null;
        return { lat: pos.lat, lon: pos.lon, state: markerStateFor(i), label: animalLabel(i), incident: i };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);

    provider.renderMarkers(containerRef.current, points);
    containerRef.current.querySelectorAll<HTMLDivElement>(".map-marker").forEach((el, idx) => {
      el.addEventListener("click", () => onSelect?.(points[idx]!.incident));
    });
    // Treat a successful render pass as ready unless errors say otherwise.
    const readyTimer = window.setTimeout(() => {
      if (!settled) {
        settled = true;
        setState((s) => (s === "loading" ? "ready" : s));
      }
    }, 3500);

    return () => {
      window.clearTimeout(readyTimer);
      provider.destroy();
      providerRef.current = null;
    };
  }, [incidents, privacy, onSelect, retryToken]);

  return (
    <div>
      <div className="notice" style={{ marginBottom: "var(--space-3)" }}>
        <span>
          Map tiles from <strong>OpenStreetMap</strong> require an internet connection — the incident list works fully
          offline. Marker positions respect each incident's location privacy: approximate reports are fuzzed to ~1 km and
          sensitive reports never show a precise point.
        </span>
      </div>
      {(state === "offline" || state === "provider-failed") && (
        <div className="notice warning" style={{ marginBottom: "var(--space-3)" }} role="status">
          <div>
            <strong>
              {state === "offline"
                ? "Internet unavailable — showing an offline position view instead."
                : "Map tiles could not be loaded — the internet works, but the tile provider (OpenStreetMap) is unreachable, blocked, or rate-limited."}
            </strong>
            <div style={{ marginTop: 8 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setRetryToken((n) => n + 1)}>Retry map</button>
            </div>
            <p style={{ margin: "8px 0 0", fontSize: "0.85rem" }}>
              Coordinates below are shown as stored (subject to each incident's location privacy).
            </p>
          </div>
        </div>
      )}
      {state === "no-coordinates" && (
        <div className="notice" style={{ marginBottom: "var(--space-3)" }} role="status">
          <span>Map is available, but no incident on this device has a mappable location yet.</span>
        </div>
      )}
      {(state === "offline" || state === "provider-failed") ? (
        <div
          className="offline-position-view"
          style={{ height: 460, borderRadius: "var(--radius-md)", border: "1px solid var(--c-border)", overflow: "auto", position: "relative", background: "var(--c-surface-alt)", padding: "var(--space-4)" }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "var(--space-3)" }}>
            {incidents.map((i) => {
              const pos = markerPositionFor(i, privacy);
              return (
                <div key={i.id} className="card" style={{ boxShadow: "none", padding: "var(--space-3)" }}>
                  <div className="row" style={{ gap: 8 }}>
                    <span className={`map-marker offline`} data-state={markerStateFor(i)} aria-hidden="true">
                      <span className="map-marker-shape">●</span>
                    </span>
                    <strong style={{ fontSize: "0.9rem" }}>{animalLabel(i)}</strong>
                  </div>
                  <div style={{ fontSize: "0.82rem", color: "var(--c-ink-soft)", marginTop: 4 }}>
                    {pos ? (
                      <code>{pos.lat.toFixed(4)}, {pos.lon.toFixed(4)}</code>
                    ) : (
                      "No mappable location"
                    )}
                    {i.location.description ? ` · ${i.location.description}` : ""}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div
          ref={containerRef}
          style={{ height: compact ? 280 : 460, borderRadius: "var(--radius-md)", border: "1px solid var(--c-border)", overflow: "hidden", position: "relative" }}
        />
      )}
      <div className="row" style={{ marginTop: "var(--space-2)", gap: 12, fontSize: "0.82rem", color: "var(--c-ink-soft)" }}>
        {Object.entries(STATUS_MARKER_COLORS).map(([state, color]) => (
          <span key={state} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span className={`map-marker-legend`} data-state={state} style={{ background: color }} />
            {state === "new" ? "New / reported" : state === "active" ? "Assigned / responding" : state === "transfer" ? "Transfer / in care" : "Closed"}
          </span>
        ))}
      </div>
    </div>
  );
}
