/**
 * IncidentQueueRow (P29/P30/P64): ONE consistent operational row used by the
 * dashboard feed and the Response Network. Title + status inline, metadata
 * line, right-aligned action rail. Narrow viewports stack cleanly — no
 * arbitrary margin-left positioning.
 */
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { StatusBadge } from "../../../components/ui";
import { STATUS_MARKER_STYLES } from "../mapProvider";
import { Icons } from "../../../components/Icons";
import type { Incident } from "../../../types/incident";

export interface QueueRowAction {
  label: string;
  onClick?: () => void;
  to?: string;
  primary?: boolean;
}

export function IncidentQueueRow({
  incident,
  title,
  meta,
  context,
  attention,
  actions,
}: {
  incident: Incident;
  title: string;
  meta: ReactNode;
  context?: ReactNode;
  attention?: string | null;
  actions: QueueRowAction[];
}) {
  const { t } = useTranslation("professional");
  // Live-console feel (dev.17): a status color strip on the left edge and a
  // bold wait-age badge once a case has been sitting for over 2 hours.
  const ageHours = (Date.now() - new Date(incident.occurredAt ?? incident.createdAt).getTime()) / 3_600_000;
  const stale = ageHours > 2 && !incident.deletedAt;
  const strip = STATUS_MARKER_STYLES[incident.status]?.color ?? "var(--c-border-strong)";
  return (
    <div
      className={`queue-row${attention ? " has-attention" : ""}`}
      data-incident-ref={incident.humanReference}
      style={{ borderLeft: `4px solid ${strip}`, borderRadius: "var(--radius-sm)" }}
    >
      <div className="queue-row-main">
        <div className="rc-title-row">
          <p className="ic-title">{title}</p>
          <StatusBadge status={incident.status} />
          {stale && (
            <span
              className="badge"
              style={{ background: "color-mix(in srgb, var(--c-warn) 18%, transparent)", color: "var(--c-warn)", fontWeight: 700 }}
              title={t("waitingBadgeTitle", { defaultValue: "Waiting more than 2 hours" })}
            >
              {t("waitingBadge", { defaultValue: "⏱ waiting {{h}} h", h: Math.floor(ageHours), interpolation: { escapeValue: false } })}
            </span>
          )}
          {attention && <span className="badge warn">{attention}</span>}
        </div>
        <p className="ic-meta">{meta}</p>
        {context && <p className="ic-meta">{context}</p>}
      </div>
      <div className="queue-row-actions" role="group" aria-label={t("rowActions", { defaultValue: "Actions" })}>
        {actions.map((a) =>
          a.to ? (
            <Link key={a.label} to={a.to} className={`btn btn-sm ${a.primary ? "btn-primary" : "btn-secondary"}`}>
              {a.label}
            </Link>
          ) : (
            <button key={a.label} className={`btn btn-sm ${a.primary ? "btn-primary" : "btn-secondary"}`} onClick={a.onClick}>
              {a.label}
            </button>
          )
        )}
        <Link to={`/incidents/${incident.id}`} className="btn btn-quiet btn-sm" aria-label={t("moreActions", { defaultValue: "Open incident" })}>
          <Icons.chevronRight size={14} />
        </Link>
      </div>
    </div>
  );
}
