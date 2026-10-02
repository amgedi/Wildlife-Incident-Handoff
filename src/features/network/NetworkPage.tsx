/**
 * Response network dashboard — LOCAL PREVIEW build.
 *
 * Shows the professional incident feed over LOCAL incidents with a mock
 * service area and mock organization registry. Nothing is transmitted
 * anywhere; this validates the dashboard UX and the data model that a real
 * backend would implement (docs/NETWORK_ARCHITECTURE.md).
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../../app/AppContext";
import { useIncidents } from "../incidents/IncidentCard";
import { Icons } from "../../components/Icons";
import { EmptyState, StatusBadge, TextField } from "../../components/ui";
import { animalLabel } from "../export/exportService";
import { relativeTime } from "../../utils/time";
import {
  FEED_GROUPS, LOCAL_ORG_REGISTRY, distanceFromArea, feedGroupFor,
  findDuplicateCandidates, inServiceArea, type ServiceArea,
} from "./networkService";
import { formatDistance } from "../../utils/units";
import { NetworkMap } from "./NetworkMap";
import { useNavigate } from "react-router-dom";
import { getSetting, setSetting } from "../../storage/repositories";
import { useEffect } from "react";
import { changeStatus } from "../../storage/incidentService";

export function NetworkPage() {
  const { incidents, refresh } = useIncidents();
  const { settings, showToast } = useApp();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"list" | "map">("list");
  const [area, setArea] = useState<ServiceArea>({ centerLat: null, centerLon: null, radiusKm: 25, label: "My service area" });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getSetting<ServiceArea>("network-service-area").then((saved) => {
      if (saved) setArea(saved);
      setLoaded(true);
    });
  }, []);

  const saveArea = (next: ServiceArea) => {
    setArea(next);
    void setSetting("network-service-area", next);
  };

  const org = LOCAL_ORG_REGISTRY[0];
  const live = useMemo(() => (incidents ?? []).filter((i) => !i.deletedAt && !i.archivedAt), [incidents]);
  const inArea = useMemo(() => live.filter((i) => inServiceArea(i, area)), [live, area]);
  const duplicates = useMemo(() => findDuplicateCandidates(live), [live]);

  const grouped = useMemo(() => {
    const map: Record<string, typeof inArea> = { new: [], active: [], transfer: [], closed: [] };
    for (const i of inArea) map[feedGroupFor(i)]!.push(i);
    for (const key of Object.keys(map)) {
      map[key]!.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    }
    return map;
  }, [inArea]);

  const dupIds = useMemo(() => new Set(duplicates.flatMap((d) => [d.a.id, d.b.id])), [duplicates]);

  if (!loaded) return <main className="content" id="main-content" />;

  return (
    <main className="content wide" id="main-content">
      <div className="row between" style={{ flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0 }}>Response network</h1>
          <p style={{ color: "var(--c-ink-faint)", fontSize: "0.88rem", margin: "4px 0 0" }}>
            <span className="demo-banner" style={{ marginRight: 8 }}>LOCAL PREVIEW</span>
            Running against incidents on this device for the organization “{org?.name}”. Nothing is shared or transmitted.
          </p>
        </div>
        <div className="segmented" role="group" aria-label="Dashboard view">
          <button aria-pressed={tab === "list"} onClick={() => setTab("list")}>List</button>
          <button aria-pressed={tab === "map"} onClick={() => setTab("map")}>Map</button>
        </div>
      </div>

      <div className="card" style={{ marginTop: "var(--space-5)" }}>
        <h3 style={{ marginTop: 0 }}>Service area</h3>
        <p style={{ color: "var(--c-ink-soft)", fontSize: "0.9rem" }}>
          Incidents inside this radius appear in the feed. Set the center from any incident with coordinates, or enter it
          manually. Polygons and administrative regions are planned for the real network backend.
        </p>
        <div className="row" style={{ alignItems: "flex-end" }}>
          <TextField label="Center latitude" type="number" step="any" value={area.centerLat?.toString() ?? ""} onChange={(v) => saveArea({ ...area, centerLat: v ? parseFloat(v) : null })} optional />
          <TextField label="Center longitude" type="number" step="any" value={area.centerLon?.toString() ?? ""} onChange={(v) => saveArea({ ...area, centerLon: v ? parseFloat(v) : null })} optional />
          <TextField label="Radius (km)" type="number" value={area.radiusKm.toString()} onChange={(v) => saveArea({ ...area, radiusKm: Math.max(1, parseFloat(v) || 25) })} />
        </div>
      </div>

      {tab === "map" ? (
        <div className="card" style={{ marginTop: "var(--space-4)" }}>
          <h3 style={{ marginTop: 0 }}>Map</h3>
          <NetworkMap
            incidents={inArea}
            privacy="approximate"
            onSelect={(incident) => navigate(`/incidents/${incident.id}`)}
          />
        </div>
            ) : (
        <>
          {duplicates.length > 0 && (
            <div className="notice warning" style={{ marginTop: "var(--space-4)" }}>
              <Icons.warning size={18} />
              <div>
                <strong>Possible duplicate report{duplicates.length === 1 ? "" : "s"}</strong> — these incidents look
                similar by location, time and description. Nothing is merged automatically; review them:
                <ul style={{ margin: "6px 0 0", paddingLeft: 20 }}>
                  {duplicates.map((d, idx) => (
                    <li key={idx}>
                      <Link to={`/incidents/${d.a.id}`}>{d.a.humanReference}</Link> and{" "}
                      <Link to={`/incidents/${d.b.id}`}>{d.b.humanReference}</Link>
                      {d.distanceKm != null && <> — {formatDistance(d.distanceKm, settings.units)} apart, ~{Math.round(d.ageHours)}h</>}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {FEED_GROUPS.map((group) => (
            <section key={group.id} style={{ marginTop: "var(--space-5)" }}>
              <h2 className="section-label">{group.label} ({grouped[group.id]!.length})</h2>
              {grouped[group.id]!.length === 0 ? (
                <p style={{ color: "var(--c-ink-faint)", fontSize: "0.88rem" }}>Nothing here right now.</p>
              ) : (
                <div className="card-list">
                  {grouped[group.id]!.map((i) => {
                    const dist = distanceFromArea(i, area);
                    return (
                      <div key={i.id} className="incident-card" style={{ flexWrap: "wrap" }}>
                        <div className="ic-body">
                          <div className="row between" style={{ gap: 8 }}>
                            <p className="ic-title">
                              {animalLabel(i)}
                              {dupIds.has(i.id) && (
                                <span className="badge warn" style={{ marginLeft: 8 }} title="Possible duplicate report">possible duplicate</span>
                              )}
                            </p>
                            <StatusBadge status={i.status} />
                          </div>
                          <p className="ic-meta">
                            {i.humanReference} · Reported {relativeTime(i.occurredAt ?? i.createdAt)}
                            {dist != null && <> · {formatDistance(dist, settings.units)} away</>}
                            {i.hazards && i.hazards.hazards.length > 0 && <> · {i.hazards.hazards.length} hazard{i.hazards.hazards.length === 1 ? "" : "s"}</>}
                            {i.custody.some((c) => !c.endedAt) && i.status !== "reported" ? "" : " · No responder assigned"}
                          </p>
                          {i.location.description && <p className="ic-meta">{i.location.description}</p>}
                        </div>
                        <div className="row" style={{ gap: 8 }}>
                          {group.id === "new" && (
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={async () => {
                                await changeStatus(i, "responder_assigned", settings.displayName || null, `Accepted by ${org?.name ?? "local organization"}`);
                                showToast("Incident accepted — responder assigned");
                                await refresh();
                              }}
                            >
                              Accept
                            </button>
                          )}
                          <Link className="btn btn-secondary btn-sm" to={`/incidents/${i.id}`}>Review</Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          ))}

          {inArea.length === 0 && (
            <div className="card" style={{ marginTop: "var(--space-4)" }}>
              <EmptyState
                icon={<Icons.handoff size={40} />}
                title="No incidents in your service area yet"
                hint="When incidents with coordinates inside your radius exist on this device, they appear here grouped by response stage."
              />
            </div>
          )}
        </>
      )}
    </main>
  );
}
