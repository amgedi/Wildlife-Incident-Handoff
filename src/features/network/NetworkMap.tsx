/** React wrapper for the MapLibre provider (network map tab). */
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import type { Incident } from "../../types/incident";
import { createMapLibreProvider, markerPositionFor, markerStateFor, STATUS_MARKER_COLORS, type MapPrivacy } from "./mapProvider";
import { animalLabel } from "../export/exportService";

export function NetworkMap({
  incidents,
  privacy,
  onSelect,
}: {
  incidents: Incident[];
  privacy: MapPrivacy;
  onSelect?: (incident: Incident) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [offline, setOffline] = useState(false);
  const providerRef = useRef<ReturnType<typeof createMapLibreProvider> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const provider = createMapLibreProvider();
    provider.setErrorHandler((isError) => setOffline(isError));
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

    return () => {
      provider.destroy();
      providerRef.current = null;
    };
  }, [incidents, privacy, onSelect]);

  return (
    <div>
      <div className="notice" style={{ marginBottom: "var(--space-3)" }}>
        <span>
          Map tiles from <strong>OpenStreetMap</strong> require an internet connection — the incident list works fully
          offline. Marker positions respect each incident's location privacy: approximate reports are fuzzed to ~1 km and
          sensitive reports never show a precise point.
        </span>
      </div>
      {offline && (
        <div className="notice warning" style={{ marginBottom: "var(--space-3)" }}>
          <strong>Map tiles are unavailable right now</strong> — switch to the List view for coordinates and details.
        </div>
      )}
      <div
        ref={containerRef}
        style={{ height: 460, borderRadius: "var(--radius-md)", border: "1px solid var(--c-border)", overflow: "hidden", position: "relative" }}
      />
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
