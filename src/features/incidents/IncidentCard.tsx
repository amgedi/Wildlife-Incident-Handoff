/** Shared data hook for loading incidents + an incident card component. */
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Incident } from "../../types/incident";
import { getAllIncidents } from "../../storage/repositories";
import { relativeTime, formatDateTime } from "../../utils/time";
import { animalLabel } from "../export/exportService";
import { Icons } from "../../components/Icons";
import { labelFor, ANIMAL_LOCATIONS } from "./labels";
import { StatusBadge } from "../../components/ui";
import { BookmarkButton } from "./BookmarkButton";

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

/** 0.3.0-dev.6: shared card body — bookmark responds instantly via a local
 *  shadow; a genuinely newer record from the parent always wins. */
function CardBody({ incident, full }: { incident: Incident; full: boolean }) {
  const [shadow, setShadow] = useState(incident);
  const current = shadow.updatedAt === incident.updatedAt ? shadow : incident;
  const last = [...current.timeline].sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
  const custody = current.custody.filter((c) => !c.endedAt).at(-1);
  return (
    <Link to={`/incidents/${current.id}`} className="incident-card">
      <div className="ic-body">
        <p className="ic-title">{animalLabel(current)}</p>
        <p className="ic-meta">
          {current.humanReference} · {full
            ? formatDateTime(current.occurredAt ?? current.createdAt)
            : <>Reported {relativeTime(current.occurredAt ?? current.createdAt)}</>}
          {current.location.description ? ` · ${current.location.description}` : ""}
        </p>
        {!full && custody && (
          <p className="ic-meta">Current custody: {custody.holder}{custody.holderRole ? ` (${custody.holderRole})` : ""}</p>
        )}
        {!full && current.animalNow && (
          <p className="ic-meta">Animal now: {labelFor(ANIMAL_LOCATIONS, current.animalNow)}</p>
        )}
        {last && <p className="ic-updates">Last update: {last.summary} — {relativeTime(last.timestamp)}</p>}
      </div>
      <div className="ic-side">
        <StatusBadge status={current.status} />
        <BookmarkButton incident={current} onChanged={setShadow} />
        <span style={{ color: "var(--c-ink-faint)", display: "inline-flex" }} aria-hidden="true">
          <Icons.chevronRight size={18} />
        </span>
      </div>
    </Link>
  );
}

export function IncidentCard({ incident }: { incident: Incident }) {
  return <CardBody incident={incident} full={false} />;
}

export function IncidentCardFull({ incident }: { incident: Incident }) {
  return <CardBody incident={incident} full={true} />;
}
