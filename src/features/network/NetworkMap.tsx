/** React wrapper for the MapLibre provider (network map + dashboard panel). */
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import type { Incident } from "../../types/incident";
import { createMapLibreProvider, markerPositionFor, markerStateFor, STATUS_MARKER_COLORS, getMapDiagnostics, type MapPrivacy, type MapServiceArea } from "./mapProvider";
import { animalLabel } from "../export/exportService";
import { Icons } from "../../components/Icons";

type MapState = "loading" | "ready" | "offline" | "provider-failed" | "no-coordinates";

export function NetworkMap({
  incidents,
  privacy,
  onSelect,
  compact = false,
  serviceArea = null,
  fitMode = "points",
}: {
  incidents: Incident[];
  privacy: MapPrivacy;
  onSelect?: (incident: Incident) => void;
  /** Compact dashboard panel: reduced default height. */
  compact?: boolean;
  /** P31/P34: fit the camera to the service area instead of the world. */
  serviceArea?: MapServiceArea | null;
  fitMode?: "service-area" | "points";
}) {
  const { t } = useTranslation("professional");
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
    const provider = createMapLibreProvider({ serviceArea, fitMode });
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
  }, [incidents, privacy, onSelect, retryToken, serviceArea, fitMode]);

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
          style={{ borderRadius: "var(--radius-md)", border: "1px solid var(--c-border)", overflow: "auto", background: "var(--c-surface-alt)", maxHeight: compact ? 280 : 460 }}
          role="region"
          aria-label={t("fallbackRegion", { defaultValue: "Location list (map unavailable)" })}
        >
          <div style={{ padding: "var(--space-3) var(--space-4)", borderBottom: "1px solid var(--c-border)", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <strong>{t("fallbackTitle", { defaultValue: "Map temporarily unavailable" })}</strong>
            <button className="btn btn-secondary btn-sm" onClick={() => setRetryToken((n) => n + 1)}>
              <Icons.refresh size={14} /> {t("retryMap", { defaultValue: "Retry" })}
            </button>
            {getMapDiagnostics().lastErrorMessage && (
              <span style={{ fontSize: "0.8rem", color: "var(--c-ink-faint)" }}>{getMapDiagnostics().lastErrorMessage}</span>
            )}
          </div>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {incidents.map((i) => {
              const pos = markerPositionFor(i, privacy);
              const isSensitive = i.location.precision === "sensitive";
              return (
                <li key={i.id} style={{ padding: "10px var(--space-4)", borderTop: "1px solid var(--c-border)" }}>
                  <div className="row" style={{ gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                    <span className={`map-marker offline`} data-state={markerStateFor(i)} aria-hidden="true">
                      <span className="map-marker-shape">●</span>
                    </span>
                    <Link to={`/incidents/${i.id}`} style={{ fontWeight: 600 }}>{animalLabel(i)}</Link>
                    <span style={{ fontSize: "0.8rem", color: "var(--c-ink-faint)" }}>{i.humanReference}</span>
                    <span className="badge">{isSensitive ? t("privacySensitive", { defaultValue: "Sensitive — area only" }) : t("privacyApprox", { defaultValue: "Approximate" })}</span>
                  </div>
                  <div style={{ fontSize: "0.82rem", color: "var(--c-ink-soft)", marginTop: 2 }}>
                    {pos ? (
                      <code>{pos.lat.toFixed(2)}°, {pos.lon.toFixed(2)}°</code>
                    ) : (
                      t("noMappableLocation", { defaultValue: "No mappable location" })
                    )}
                    {i.location.description ? ` · ${i.location.description}` : ""}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <div
          ref={containerRef}
          style={{ height: compact ? "100%" : 460, minHeight: compact ? 280 : undefined, borderRadius: "var(--radius-md)", border: "1px solid var(--c-border)", overflow: "hidden", position: "relative" }}
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
