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
  return (
    <div className={`queue-row${attention ? " has-attention" : ""}`} data-incident-ref={incident.humanReference}>
      <div className="queue-row-main">
        <div className="rc-title-row">
          <p className="ic-title">{title}</p>
          <StatusBadge status={incident.status} />
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
