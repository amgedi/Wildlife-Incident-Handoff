/**
 * AnalyticsChart V5 (0.3.0-dev.5, spec Part XI).
 *
 * Counts are drawn as BARS, never splines: a bar's height IS its count, so
 * the chart can never visually invent sub-zero values or fabricate
 * interpolation (the dev.4 Catmull-Rom spline could dip below zero between
 * points — eliminated by construction here).
 *
 * Interaction: hover shows a compact tooltip; click (or keyboard
 * focus + Enter) opens the detailed drawer for the nearest bucket.
 */
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { AnalyticsBucket, MetricId } from "./metricRegistry";
import { METRIC_REGISTRY } from "./metricRegistry";

const W = 920;
const H = 220;
const PAD_L = 36;
const PAD_R = 10;
const PAD_T = 14;
const BASELINE = H - 28;

export interface AnalyticsChartProps {
  buckets: AnalyticsBucket[];
  metrics?: MetricId[];
  selected: number | null;
  onSelect: (index: number | null) => void;
}

const SERIES_COLOR: Record<MetricId, string> = {
  reported: "var(--c-primary)",
  assigned: "var(--c-info, #4a8fd4)",
  closed: "var(--c-ok, #4f9d6e)",
};

export function AnalyticsChart({ buckets, metrics = ["reported", "closed"], selected, onSelect }: AnalyticsChartProps) {
  const { t } = useTranslation("professional");
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const n = buckets.length;
  const max = Math.max(1, ...buckets.map((b) => Math.max(...metrics.map((m) => b[m]))));
  const innerW = W - PAD_L - PAD_R;
  const slot = innerW / Math.max(1, n);
  const groupW = slot * 0.7;
  const barW = groupW / metrics.length;
  const yAt = (v: number) => BASELINE - (v / max) * (BASELINE - PAD_T);
  const active = hover ?? selected;
  const labelEvery = n > 16 ? Math.ceil(n / 8) : 1;
  const yTicks = max > 4 ? [0, Math.round(max / 2), max] : [0, max];

  const resolveIndex = (clientX: number): number | null => {
    const svg = svgRef.current;
    if (!svg || n === 0) return null;
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0) return null;
    const px = ((clientX - rect.left) / rect.width) * W;
    // Nearest logical bucket — never arbitrary pixel time (spec 55).
    const idx = Math.floor((px - PAD_L) / slot);
    return Math.min(n - 1, Math.max(0, idx));
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (n === 0) return;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      const next = active == null ? 0 : Math.min(n - 1, active + 1);
      setHover(null);
      onSelect(next);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      const prev = active == null ? n - 1 : Math.max(0, active - 1);
      setHover(null);
      onSelect(prev);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (active != null) onSelect(active);
    } else if (e.key === "Escape") {
      onSelect(null);
    }
  };

  return (
    <div className="ax5">
      <svg
        ref={svgRef}
        className="ax5-svg"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        tabIndex={0}
        aria-label={t("ax5Aria", {
          defaultValue: "Analytics chart. Use arrow keys to move between time buckets, Enter to open details.",
        })}
        onPointerMove={(e) => setHover(resolveIndex(e.clientX))}
        onPointerDown={(e) => {
          const idx = resolveIndex(e.clientX);
          setHover(idx);
          if (idx != null) onSelect(idx);
        }}
        onPointerLeave={() => setHover(null)}
        onKeyDown={onKeyDown}
        onBlur={() => setHover(null)}
      >
        {yTicks.map((tick) => (
          <g key={tick}>
            <line
              x1={PAD_L} y1={yAt(tick)} x2={W - PAD_R} y2={yAt(tick)}
              stroke="var(--c-border)" strokeWidth="1"
              strokeDasharray={tick === 0 ? undefined : "3 4"}
            />
            <text x={PAD_L - 6} y={yAt(tick) + 3} fontSize="10" textAnchor="end" fill="var(--c-ink-faint)">
              {tick}
            </text>
          </g>
        ))}

        {buckets.map((b, i) => {
          const x0 = PAD_L + i * slot + (slot - groupW) / 2;
          return (
            <g key={i}>
              {metrics.map((m, mi) => {
                const v = b[m];
                const y = yAt(v);
                const h = Math.max(0, BASELINE - y);
                return (
                  <rect
                    key={m}
                    x={x0 + mi * barW + 1}
                    y={y}
                    width={Math.max(1, barW - 2)}
                    height={h}
                    fill={SERIES_COLOR[m]}
                    opacity={active == null || active === i ? 0.9 : 0.4}
                    rx={Math.min(2, barW / 3)}
                  />
                );
              })}
              {(i % labelEvery === 0 || i === n - 1) && (
                <text x={x0 + groupW / 2} y={H - 10} fontSize="10" textAnchor="middle" fill="var(--c-ink-faint)">
                  {b.label}
                </text>
              )}
              {(hover === i || selected === i) && (
                <rect
                  x={PAD_L + i * slot} y={PAD_T - 8} width={slot} height={BASELINE - PAD_T + 8}
                  fill="var(--c-primary)" opacity="0.07"
                />
              )}
            </g>
          );
        })}
        {n === 0 && <text x={W / 2} y={H / 2} textAnchor="middle" fill="var(--c-ink-faint)" fontSize="12">—</text>}
      </svg>

      {active != null && buckets[active] && (
        <div
          className="ax5-tip"
          role="presentation"
          style={{ left: `${Math.min(86, Math.max(10, ((PAD_L + active * slot) / W) * 100))}%` }}
        >
          <div className="ax5-tip-window">{buckets[active]!.windowLabel}</div>
          {metrics.map((m) => (
            <div className="ax5-tip-row" key={m}>
              <span>
                <span className="ax5-swatch" style={{ background: SERIES_COLOR[m] }} aria-hidden="true" />
                {METRIC_REGISTRY[m].label}
              </span>
              <strong>{buckets[active]![m]}</strong>
            </div>
          ))}
          <div className="ax5-tip-hint">
            {t("ax5ClickHint", { defaultValue: "Click for details" })}
          </div>
        </div>
      )}

      <div className="ax5-legend">
        {metrics.map((m) => (
          <span className="ax5-legend-item" key={m}>
            <span className="ax5-swatch" style={{ background: SERIES_COLOR[m] }} aria-hidden="true" />
            {METRIC_REGISTRY[m].label}
          </span>
        ))}
      </div>

      {/* Accessible data table fallback */}
      <table className="sr-only">
        <caption>{t("ax5TableCaption", { defaultValue: "Data table: analytics by time bucket" })}</caption>
        <thead>
          <tr>
            <th scope="col">{t("trendColPeriod", { defaultValue: "Period" })}</th>
            {metrics.map((m) => (
              <th scope="col" key={m}>{METRIC_REGISTRY[m].label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {buckets.map((b) => (
            <tr key={b.startISO}>
              <th scope="row">{b.windowLabel}</th>
              {metrics.map((m) => (
                <td key={m}>{b[m]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
