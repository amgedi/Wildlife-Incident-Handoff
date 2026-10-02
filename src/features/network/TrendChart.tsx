/**
 * TrendChart (0.2.0-dev.7): accessible SVG grouped bar chart with y-axis
 * gridlines, hover/focus values, legend and a screen-reader data table.
 * Scales to actual data — never leaves a huge empty region.
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";

export interface SeriesPoint {
  day: string;
  reported: number;
  resolved: number;
}

export function TrendChart({ points }: { points: SeriesPoint[] }) {
  const { t } = useTranslation("professional");
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...points.map((p) => Math.max(p.reported, p.resolved)));
  const barW = points.length > 40 ? 3 : points.length > 14 ? 8 : 24;
  const gap = 6;
  const width = points.length * (barW * 2 + gap) + gap;
  const height = 168;
  const chartH = 118;
  const labelEvery = points.length > 40 ? Math.ceil(points.length / 6) : points.length > 14 ? Math.ceil(points.length / 7) : 1;
  const yTicks = max > 4 ? [0, Math.round(max / 2), max] : [0, max];
  const hoverPoint = hover != null ? points[hover] : null;

  return (
    <div>
      <div role="img" aria-label={t("trendAria", { defaultValue: "Reports over time bar chart. Details follow in the data table." })}>
        <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ maxWidth: "100%", display: "block" }}>
          {/* y gridlines + axis labels */}
          {yTicks.map((tick) => {
            const y = chartH - (tick / max) * (chartH - 12);
            return (
              <g key={tick}>
                <line x1={30} y1={y} x2={width - gap} y2={y} stroke="var(--c-border)" strokeWidth="1" strokeDasharray={tick === 0 ? undefined : "3 4"} />
                <text x={24} y={y + 3} fontSize="9" textAnchor="end" fill="var(--c-ink-faint)">{tick}</text>
              </g>
            );
          })}
          {points.map((p, i) => {
            const x = 30 + i * (barW * 2 + gap);
            const rh = (p.reported / max) * (chartH - 12);
            const sh = (p.resolved / max) * (chartH - 12);
            const isHover = hover === i;
            return (
              <g
                key={i}
                tabIndex={0}
                role="presentation"
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                style={{ cursor: "pointer", outline: isHover ? "none" : undefined }}
              >
                {/* invisible hover area */}
                <rect x={x - gap / 2} y={0} width={barW * 2 + gap} height={chartH} fill="transparent" />
                <rect x={x} y={chartH - rh} width={barW} height={Math.max(rh, p.reported > 0 ? 2 : 0)} fill="var(--c-primary)" opacity={hover == null || isHover ? 1 : 0.45} rx="2" />
                <rect x={x + barW} y={chartH - sh} width={barW} height={Math.max(sh, p.resolved > 0 ? 2 : 0)} fill="var(--c-ink-faint)" opacity={hover == null || isHover ? 1 : 0.45} rx="2" />
                {(i % labelEvery === 0 || i === points.length - 1) && (
                  <text x={x + barW} y={chartH + 14} fontSize="9" textAnchor="middle" fill="var(--c-ink-faint)">
                    {p.day}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      {/* hover/focus value readout */}
      <div aria-live="polite" style={{ minHeight: 22, marginTop: 2, fontSize: "0.82rem", color: "var(--c-ink-soft)" }}>
        {hoverPoint
          ? t("trendPoint", { defaultValue: "{{day}}: {{reported}} reported, {{resolved}} resolved", day: hoverPoint.day, reported: hoverPoint.reported, resolved: hoverPoint.resolved })
          : t("trendHoverHint", { defaultValue: "Hover or focus a point for exact values." })}
      </div>
      <div className="row" style={{ gap: 14, fontSize: "0.78rem", color: "var(--c-ink-soft)", marginTop: 4 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 10, height: 10, background: "var(--c-primary)", borderRadius: 2, display: "inline-block" }} /> {t("seriesReported", { defaultValue: "Reported" })}
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 10, height: 10, background: "var(--c-ink-faint)", borderRadius: 2, display: "inline-block" }} /> {t("seriesResolved", { defaultValue: "Resolved" })}
        </span>
      </div>
      {/* accessible table fallback */}
      <details style={{ marginTop: 6 }}>
        <summary style={{ fontSize: "0.8rem", cursor: "pointer", color: "var(--c-ink-faint)" }}>{t("trendDataTable", { defaultValue: "Data table" })}</summary>
        <table style={{ width: "100%", fontSize: "0.8rem", borderCollapse: "collapse", marginTop: 6 }}>
          <thead>
            <tr>
              <th scope="col" style={{ textAlign: "left", padding: 4 }}>{t("trendColPeriod", { defaultValue: "Period" })}</th>
              <th scope="col" style={{ textAlign: "right", padding: 4 }}>{t("seriesReported", { defaultValue: "Reported" })}</th>
              <th scope="col" style={{ textAlign: "right", padding: 4 }}>{t("seriesResolved", { defaultValue: "Resolved" })}</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p, i) => (
              <tr key={i}>
                <td style={{ padding: 3, borderTop: "1px solid var(--c-border)" }}>{p.day}</td>
                <td style={{ padding: 3, borderTop: "1px solid var(--c-border)", textAlign: "right" }}>{p.reported}</td>
                <td style={{ padding: 3, borderTop: "1px solid var(--c-border)", textAlign: "right" }}>{p.resolved}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
