/**
 * AnalyticsDetailDrawer (0.3.0-dev.5, spec 53–54): the persistent detail view
 * opened when the operator clicks a time bucket on an analytics chart.
 * Shows only metrics that actually exist for the window — never placeholders.
 */
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Icons } from "../../../components/Icons";
import type { AnalyticsBucket, MetricId } from "./metricRegistry";
import { METRIC_REGISTRY } from "./metricRegistry";

export interface AnalyticsDetailProps {
  bucket: AnalyticsBucket | null;
  metrics?: MetricId[];
  onClose: () => void;
  onOpenIncidents: (bucket: AnalyticsBucket) => void;
}

export function AnalyticsDetailDrawer({ bucket, metrics = ["reported", "assigned", "closed"], onClose, onOpenIncidents }: AnalyticsDetailProps) {
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

  return (
    <div className="ax5-drawer-scrim" onClick={onClose}>
      <aside
        className="ax5-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={t("ax5DrawerTitle", { defaultValue: "Time window details" })}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="row between" style={{ alignItems: "center", marginBottom: 8 }}>
          <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <Icons.clock size={16} /> {t("ax5DrawerTitle", { defaultValue: "Time window details" })}
          </h3>
          <button ref={closeRef} className="btn btn-quiet btn-sm" onClick={onClose} aria-label={t("common:close", { defaultValue: "Close" })}>
            <Icons.x size={16} />
          </button>
        </header>
        <p className="ax5-drawer-window">{bucket.windowLabel}</p>
        <dl className="kv">
          {metrics.map((m) => (
            <div key={m} className="ax5-drawer-metric" title={METRIC_REGISTRY[m].definition}>
              <dt>{METRIC_REGISTRY[m].label}</dt>
              <dd>{bucket[m]}</dd>
            </div>
          ))}
          {bucket.medianAssignmentMinutes != null && (
            <div className="ax5-drawer-metric" title={METRIC_REGISTRY.assigned.definition}>
              <dt>{t("ax5MedianAssign", { defaultValue: "Median assignment" })}</dt>
              <dd>
                {bucket.medianAssignmentMinutes < 60
                  ? `${Math.round(bucket.medianAssignmentMinutes)} ${t("ax5Min", { defaultValue: "min" })}`
                  : `${(bucket.medianAssignmentMinutes / 60).toFixed(1)} ${t("ax5Hours", { defaultValue: "h" })}`}
              </dd>
            </div>
          )}
        </dl>
        {bucket.incidentRefs.length > 0 && (
          <>
            <h4 style={{ margin: "12px 0 4px", fontSize: "0.8rem", letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--c-ink-faint)" }}>
              {t("ax5Incidents", { defaultValue: "Incidents reported in this window" })}
            </h4>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, maxHeight: 180, overflowY: "auto" }}>
              {bucket.incidentRefs.map((ref, i) => (
                <li key={`${ref}-${i}`} style={{ padding: "4px 0", borderTop: "1px solid var(--c-border)", fontVariantNumeric: "tabular-nums" }}>
                  {ref}
                </li>
              ))}
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
