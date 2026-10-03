/**
 * TrendChart (0.2.0-dev.10): accessible SVG area/line chart — gradient area
 * for reported, line for resolved — with y gridlines, crosshair hover/focus
 * with dot markers, padded x-axis (no clipped labels), legend and a
 * screen-reader data table. Scales to actual data — never a huge empty region.
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";

export interface SeriesPoint {
  day: string;
  reported: number;
  resolved: number;
}

const PAD_L = 34;
const PAD_R = 14;
const PAD_T = 8;

export function TrendChart({ points }: { points: SeriesPoint[] }) {
  const { t } = useTranslation("professional");
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...points.map((p) => Math.max(p.reported, p.resolved)));
  const width = 920;
  const height = 190;
  const chartH = 128;
  const plotW = width - PAD_L - PAD_R;
  const n = Math.max(1, points.length);
  const xAt = (i: number) => PAD_L + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const yAt = (v: number) => chartH - (v / max) * (chartH - PAD_T) + 0;
  const labelEvery = points.length > 40 ? Math.ceil(points.length / 6) : points.length > 14 ? Math.ceil(points.length / 7) : 1;
  const yTicks = max > 4 ? [0, Math.round(max / 2), max] : [0, max];
  const hoverPoint = hover != null ? points[hover] : null;

  const linePath = (key: "reported" | "resolved") =>
    points.map((p, i) => `${i === 0 ? "M" : "L"}${xAt(i).toFixed(1)},${yAt(p[key]).toFixed(1)}`).join(" ");
  const areaPath =
    points.length > 0
      ? `M${xAt(0).toFixed(1)},${chartH} L` +
        points.map((p, i) => `${xAt(i).toFixed(1)},${yAt(p.reported).toFixed(1)}`).join(" L") +
        ` L${xAt(points.length - 1).toFixed(1)},${chartH} Z`
      : "";

  return (
    <div>
      <div role="img" aria-label={t("trendAria", { defaultValue: "Reports over time chart. Details follow in the data table." })}>
        <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ maxWidth: "100%", display: "block" }}>
          <defs>
            <linearGradient id="trend-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--c-primary)" stopOpacity="0.34" />
              <stop offset="100%" stopColor="var(--c-primary)" stopOpacity="0.03" />
            </linearGradient>
          </defs>
          {yTicks.map((tick) => {
            const y = yAt(tick) + 12;
            return (
              <g key={tick}>
                <line x1={PAD_L} y1={y} x2={width - PAD_R} y2={y} stroke="var(--c-border)" strokeWidth="1" strokeDasharray={tick === 0 ? undefined : "3 4"} />
                <text x={PAD_L - 8} y={y + 3} fontSize="10" textAnchor="end" fill="var(--c-ink-faint)">{tick}</text>
              </g>
            );
          })}
          {points.length > 0 && <path d={areaPath} fill="url(#trend-area)" />}
          {points.length > 1 && (
            <path d={linePath("resolved")} fill="none" stroke="var(--c-ink-soft)" strokeWidth="1.6" strokeDasharray="1 0" opacity="0.85" />
          )}
          {points.map((p, i) => {
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
                style={{ cursor: "pointer", outline: "none" }}
              >
                <rect x={xAt(i) - plotW / (2 * n)} y={0} width={Math.max(6, plotW / n)} height={chartH + 12} fill="transparent" />
                {isHover && <line x1={xAt(i)} y1={2} x2={xAt(i)} y2={chartH + 12} stroke="var(--c-ink-soft)" strokeWidth="1" opacity="0.6" />}
                <circle cx={xAt(i)} cy={yAt(p.reported) + 12} r={isHover ? 4 : 2.4} fill="var(--c-primary)" opacity={hover == null || isHover ? 1 : 0.5} />
                <circle cx={xAt(i)} cy={yAt(p.resolved) + 12} r={isHover ? 3.4 : 2} fill="var(--c-ink-soft)" opacity={hover == null || isHover ? 0.9 : 0.4} />
                {(i % labelEvery === 0 || i === points.length - 1) && (
                  <text x={xAt(i)} y={chartH + 30} fontSize="10" textAnchor="middle" fill="var(--c-ink-faint)">
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
          <span style={{ width: 10, height: 10, background: "var(--c-ink-soft)", borderRadius: 2, display: "inline-block" }} /> {t("seriesResolved", { defaultValue: "Resolved" })}
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
