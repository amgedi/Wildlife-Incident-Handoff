/** Timeline tab: chronological, append-only history. */
import type { Incident } from "../../../types/incident";
import { SectionHeading } from "../../../components/ui";
import { formatDateTime } from "../../../utils/time";
import { EmptyState } from "../../../components/ui";
import { Icons } from "../../../components/Icons";

export function TimelineTab({ incident }: { incident: Incident }) {
  const events = [...incident.timeline].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return (
    <div className="card">
      <SectionHeading help="Every important update is kept here in chronological order. Earlier entries are never overwritten — corrections appear as new events that reference the original value.">
        Timeline
      </SectionHeading>
      {events.length === 0 ? (
        <EmptyState icon={<Icons.timeline size={40} />} title="No events yet" hint="Timeline events appear as you add observations, photos, status changes and handoffs." />
      ) : (
        <ul className="timeline">
          {events.map((e) => (
            <li key={e.eventId} className={`type-${e.eventType}`}>
              <div className="tl-time">{formatDateTime(e.timestamp)}</div>
              <div className="tl-summary">{e.summary}</div>
              {e.details && <div className="tl-details">{e.details}</div>}
              {e.metadata && e.metadata.field && (
                <div className="tl-details" style={{ fontSize: "0.85rem" }}>
                  Original: “{e.metadata.previousValue}” → New: “{e.metadata.newValue}”
                </div>
              )}
              {e.actor && <div className="tl-actor">Recorded by {e.actor}</div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
