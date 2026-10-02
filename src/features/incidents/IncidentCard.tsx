/** Shared data hook for loading incidents + an incident card component. */
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Incident } from "../../types/incident";
import { getAllIncidents } from "../../storage/repositories";
import { relativeTime, formatDateTime } from "../../utils/time";
import { animalLabel } from "../export/exportService";
import { StatusBadge } from "../../components/ui";
import { Icons } from "../../components/Icons";
import { labelFor, ANIMAL_LOCATIONS } from "./labels";

export function useIncidents() {
  const [incidents, setIncidents] = useState<Incident[] | null>(null);
  const refresh = useCallback(async () => {
    setIncidents(await getAllIncidents());
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return { incidents, refresh };
}

export function IncidentCard({ incident }: { incident: Incident }) {
  const last = [...incident.timeline].sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
  const custody = incident.custody.filter((c) => !c.endedAt).at(-1);
  return (
    <Link to={`/incidents/${incident.id}`} className="incident-card">
      <div className="ic-body">
        <div className="row between" style={{ gap: 8 }}>
          <p className="ic-title">{animalLabel(incident)}</p>
          <StatusBadge status={incident.status} />
        </div>
        <p className="ic-meta">
          {incident.humanReference} · Reported {relativeTime(incident.occurredAt ?? incident.createdAt)}
          {incident.location.description ? ` · ${incident.location.description}` : ""}
        </p>
        {custody && (
          <p className="ic-meta">Current custody: {custody.holder}{custody.holderRole ? ` (${custody.holderRole})` : ""}</p>
        )}
        {incident.animalNow && (
          <p className="ic-meta">Animal now: {labelFor(ANIMAL_LOCATIONS, incident.animalNow)}</p>
        )}
        {last && <p className="ic-updates">Last update: {last.summary} — {relativeTime(last.timestamp)}</p>}
      </div>
      <span style={{ color: "var(--c-ink-faint)", alignSelf: "center" }} aria-hidden="true">
        <Icons.chevronRight size={18} />
      </span>
    </Link>
  );
}

export function IncidentCardFull({ incident }: { incident: Incident }) {
  const last = [...incident.timeline].sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
  return (
    <Link to={`/incidents/${incident.id}`} className="incident-card">
      <div className="ic-body">
        <div className="row between" style={{ gap: 8 }}>
          <p className="ic-title">{animalLabel(incident)}</p>
          <StatusBadge status={incident.status} />
        </div>
        <p className="ic-meta">
          {incident.humanReference} · {formatDateTime(incident.occurredAt ?? incident.createdAt)}
          {incident.location.description ? ` · ${incident.location.description}` : ""}
        </p>
        {last && <p className="ic-updates">Last update: {last.summary}</p>}
      </div>
      <span style={{ color: "var(--c-ink-faint)", alignSelf: "center" }} aria-hidden="true">
        <Icons.chevronRight size={18} />
      </span>
    </Link>
  );
}
