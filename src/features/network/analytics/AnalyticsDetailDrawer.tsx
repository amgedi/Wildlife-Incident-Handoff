/**
 * AnalyticsDetailDrawer V6 (0.3.0-dev.6, Part VIII): the persistent detail
 * view opened when the operator clicks a time bucket on an analytics chart.
 *
 * dev.6 rebuild: header (window + date + one-line summary), compact metric
 * chips, and each incident in the bucket as a real interactive row — status
 * chip from the canonical registry, ref, concern label, reported time,
 * location summary, assignment — clickable into the record, bookmarkable,
 * with "Open filtered incidents" as the secondary action.
 */
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Icons } from "../../../components/Icons";
import type { AnalyticsBucket, MetricId } from "./metricRegistry";
import { METRIC_REGISTRY } from "./metricRegistry";
import { STATUS_REGISTRY, statusColor } from "../../incidents/statusRegistry";
import { animalLabel } from "../../export/exportService";
import { BookmarkButton } from "../../incidents/BookmarkButton";
import { relativeTime } from "../../../utils/time";
import type { Incident } from "../../../types/incident";

export interface AnalyticsDetailProps {
  bucket: AnalyticsBucket | null;
  metrics?: MetricId[];
  onClose: () => void;
  onOpenIncidents: (bucket: AnalyticsBucket) => void;
  /** Open a single incident record (Part VIII 41). */
  onOpenIncident?: (incidentId: string) => void;
  /** Refresh incidents after a bookmark toggle so counts stay honest. */
  onChanged?: () => void;
}

export function AnalyticsDetailDrawer({ bucket, metrics = ["reported", "assigned", "closed"], onClose, onOpenIncidents, onOpenIncident, onChanged }: AnalyticsDetailProps) {
  const { t } = useTranslation("professional");
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (bucket) closeRef.current?.focus();
  }, [bucket]);

  useEffect(() => {
    if (!bucket) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [bucket, onClose]);

  if (!bucket) return null;

  const summary = metrics.map((m) => `${bucket[m]} ${METRIC_REGISTRY[m].label.toLowerCase()}`).join(" · ");

  return (
    <div className="ax5-drawer-scrim" onClick={onClose}>
      <aside
        className="ax5-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={t("ax5DrawerTitle", { defaultValue: "Time window details" })}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="row between" style={{ alignItems: "flex-start", marginBottom: 4 }}>
          <div>
            <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
              <Icons.clock size={16} /> {bucket.windowLabel}
            </h3>
            <p className="hint" style={{ margin: "2px 0 0" }}>{summary}</p>
          </div>
          <button ref={closeRef} className="btn btn-quiet btn-sm" onClick={onClose} aria-label={t("common:close", { defaultValue: "Close" })}>
            <Icons.x size={16} />
          </button>
        </header>

        <div className="ax5-chips" role="list" aria-label={t("ax5Metrics", { defaultValue: "Metrics" })}>
          {metrics.map((m) => (
            <span className="ax5-chip" role="listitem" key={m} title={METRIC_REGISTRY[m].definition}>
              {METRIC_REGISTRY[m].label} <strong>{bucket[m]}</strong>
            </span>
          ))}
          {bucket.medianAssignmentMinutes != null && (
            <span className="ax5-chip" role="listitem" title={METRIC_REGISTRY.assigned.definition}>
              {t("ax5MedianAssign", { defaultValue: "Median assignment" })}{" "}
              <strong>
                {bucket.medianAssignmentMinutes < 60
                  ? `${Math.round(bucket.medianAssignmentMinutes)} ${t("ax5Min", { defaultValue: "min" })}`
                  : `${(bucket.medianAssignmentMinutes / 60).toFixed(1)} ${t("ax5Hours", { defaultValue: "h" })}`}
              </strong>
            </span>
          )}
        </div>

        {bucket.incidents.length > 0 && (
          <>
            <h4 className="ax5-drawer-sub">
              {t("ax5IncidentsInWindow", { defaultValue: "Incidents reported in this window" })}
            </h4>
            <ul className="ax5-rows" style={{ listStyle: "none", margin: 0, padding: 0, maxHeight: 320, overflowY: "auto" }}>
              {bucket.incidents.map((inc: Incident) => {
                const d = STATUS_REGISTRY[inc.status];
                return (
                  <li key={inc.id} className="ax5-row">
                    <button
                      className="ax5-row-btn"
                      onClick={() => onOpenIncident?.(inc.id)}
                    >
                      <span className="ax5-status" style={{ color: statusColor(inc.status) }} aria-hidden="true">
                        {d?.glyph ?? "●"}
                      </span>
                      <span className="ax5-row-main">
                        <span className="ax5-row-ref">{inc.humanReference}</span>
                        <span className="ax5-row-sub">
                          {animalLabel(inc)} · {relativeTime(inc.occurredAt ?? inc.createdAt)}
                          {inc.location.description ? ` · ${inc.location.description}` : ""}
                        </span>
                      </span>
                      <BookmarkButton incident={inc} onChanged={onChanged} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        {bucket.incidentIds.length > 0 && (
          <button className="btn btn-secondary btn-sm" style={{ marginTop: 12 }} onClick={() => onOpenIncidents(bucket)}>
            {t("ax5OpenFiltered", { defaultValue: "Open filtered incidents" })}
          </button>
        )}
      </aside>
    </div>
  );
}
