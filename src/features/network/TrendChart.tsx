/**
 * TrendChart (0.3 overhaul): premium operations-analytics area/line chart.
 * Gradient fill under the reported line, distinct dashed resolved line,
 * crosshair + tooltip driven by pointer events on the svg, keyboard-focusable
 * svg with an aria-label summary, a visually-hidden data table fallback and a
 * polite live region for the hovered values. No entry animations (motion-safe
 * by construction). Props contract unchanged: `{ points }`.
 */
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

export interface SeriesPoint {
  day: string;
  reported: number;
  resolved: number;
}

const W = 920;
const H = 200;
const PAD_L = 38;
const PAD_R = 12;
const PAD_T = 14;
const BASELINE = H - 30;

/** Catmull-Rom → cubic bezier for a gentle monotone-ish curve. */
function smoothPath(pts: Array<{ x: number; y: number }>): string {
  if (pts.length < 2) return pts.map((p) => `L${p.x},${p.y}`).join(" ");
  let d = `M${pts[0]!.x},${pts[0]!.y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[Math.min(pts.length - 1, i + 2)]!;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}

export function TrendChart({ points }: { points: SeriesPoint[] }) {
  const { t } = useTranslation("professional");
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const max = Math.max(1, ...points.map((p) => Math.max(p.reported, p.resolved)));
  const totalReported = points.reduce((s, p) => s + p.reported, 0);
  const totalResolved = points.reduce((s, p) => s + p.resolved, 0);
  const n = points.length;
  const step = n > 1 ? (W - PAD_L - PAD_R) / (n - 1) : 0;
  const xAt = (i: number) => PAD_L + (n === 1 ? (W - PAD_L - PAD_R) / 2 : i * step);
  const yAt = (v: number) => BASELINE - (v / max) * (BASELINE - PAD_T);
  const labelEvery = n > 40 ? Math.ceil(n / 6) : n > 14 ? Math.ceil(n / 7) : 1;
  const yTicks = max > 4 ? [0, Math.round(max / 2), max] : [0, max];
  const hoverPoint = hover != null ? points[hover] ?? null : null;

  const moveTo = (clientX: number) => {
    const svg = svgRef.current;
    if (!svg || n === 0) return;
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0) return;
    const px = ((clientX - rect.left) / rect.width) * W;
    const idx = step === 0 ? 0 : Math.round((px - PAD_L) / step);
    setHover(Math.min(n - 1, Math.max(0, idx)));
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (n === 0) return;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      setHover((h) => (h == null ? 0 : Math.min(n - 1, h + 1)));
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      setHover((h) => (h == null ? n - 1 : Math.max(0, h - 1)));
    } else if (e.key === "Escape") {
      setHover(null);
    }
  };

  const reportedPts = points.map((p, i) => ({ x: xAt(i), y: yAt(p.reported) }));
  const resolvedPts = points.map((p, i) => ({ x: xAt(i), y: yAt(p.resolved) }));
  const areaPath =
    n > 1
      ? `${smoothPath(reportedPts)} L${xAt(n - 1).toFixed(1)},${BASELINE} L${xAt(0).toFixed(1)},${BASELINE} Z`
      : "";

  return (
    <div className="ax-trend">
      <svg
        ref={svgRef}
        className="ax-trend-svg"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        tabIndex={0}
        aria-label={t("axTrendAria", {
          defaultValue:
            "Reports over time: {{reported}} reported and {{resolved}} resolved over {{days}} days. A data table with all values follows.",
          reported: totalReported,
          resolved: totalResolved,
          days: n,
        })}
        onPointerMove={(e) => moveTo(e.clientX)}
        onPointerDown={(e) => moveTo(e.clientX)}
        onPointerLeave={() => setHover(null)}
        onKeyDown={onKeyDown}
        onBlur={() => setHover(null)}
      >
        <defs>
          <linearGradient id="ax-trend-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--c-primary)" stopOpacity="0.30" />
            <stop offset="100%" stopColor="var(--c-primary)" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {yTicks.map((tick) => {
          const y = yAt(tick);
          return (
            <g key={tick}>
              <line
                x1={PAD_L} y1={y} x2={W - PAD_R} y2={y}
                stroke="var(--c-border)"
                strokeWidth="1"
                strokeDasharray={tick === 0 ? undefined : "3 4"}
              />
              <text x={PAD_L - 8} y={y + 3} fontSize="10" textAnchor="end" fill="var(--c-ink-faint)">
                {tick}
              </text>
            </g>
          );
        })}

        {n > 1 && <path d={areaPath} fill="url(#ax-trend-area)" />}
        {n > 1 && (
          <path
            d={smoothPath(resolvedPts)}
            fill="none"
            stroke="var(--c-ink-soft)"
            strokeWidth="1.6"
            strokeDasharray="5 4"
            opacity="0.85"
          />
        )}
        {n > 1 && (
          <path d={smoothPath(reportedPts)} fill="none" stroke="var(--c-primary)" strokeWidth="2.4" strokeLinecap="round" />
        )}

        {hover != null && hoverPoint && (
          <g aria-hidden="true">
            <line
              x1={xAt(hover)} y1={PAD_T - 6} x2={xAt(hover)} y2={BASELINE}
              stroke="var(--c-ink-soft)" strokeWidth="1" opacity="0.55"
            />
            <circle cx={xAt(hover)} cy={yAt(hoverPoint.reported)} r="4" fill="var(--c-primary)" stroke="var(--c-surface)" strokeWidth="1.5" />
            <circle cx={xAt(hover)} cy={yAt(hoverPoint.resolved)} r="3.2" fill="var(--c-ink-soft)" stroke="var(--c-surface)" strokeWidth="1.5" />
          </g>
        )}

        {points.map((p, i) =>
          i % labelEvery === 0 || i === n - 1 ? (
            <text
              key={i}
              x={xAt(i)}
              y={H - 10}
              fontSize="10"
              textAnchor="middle"
              fill="var(--c-ink-faint)"
            >
              {p.day}
            </text>
          ) : null
        )}
      </svg>

      {hoverPoint && (
        <div
          className="ax-trend-tip"
          role="presentation"
          style={{
            left: `${Math.min(88, Math.max(12, (xAt(hover!) / W) * 100))}%`,
            top: `${Math.max(14, (yAt(hoverPoint.reported) / H) * 100)}%`,
          }}
        >
          <div className="ax-trend-tip-date">{hoverPoint.day}</div>
          <div className="ax-trend-tip-row">
            <span>{t("seriesReported", { defaultValue: "Reported" })}</span>
            <strong>{hoverPoint.reported}</strong>
          </div>
          <div className="ax-trend-tip-row">
            <span>{t("seriesResolved", { defaultValue: "Resolved" })}</span>
            <strong>{hoverPoint.resolved}</strong>
          </div>
        </div>
      )}

      <div className="ax-trend-legend">
        <span className="ax-trend-legend-item">
          <span className="ax-trend-swatch" aria-hidden="true" />
          {t("seriesReported", { defaultValue: "Reported" })}
        </span>
        <span className="ax-trend-legend-item">
          <span className="ax-trend-swatch is-resolved" aria-hidden="true" />
          {t("seriesResolved", { defaultValue: "Resolved" })}
        </span>
        <span className="ax-trend-hint" aria-hidden="true">
          {t("axTrendHint", { defaultValue: "Hover for daily values." })}
        </span>
      </div>

      <p className="sr-only" aria-live="polite">
        {hoverPoint
          ? t("trendPoint", { defaultValue: "{{day}}: {{reported}} reported, {{resolved}} resolved", day: hoverPoint.day, reported: hoverPoint.reported, resolved: hoverPoint.resolved })
          : ""}
      </p>

      {/* accessible data table fallback (visually hidden) */}
      <table className="sr-only">
        <caption>{t("axTrendTableSummary", { defaultValue: "Data table: reports over time" })}</caption>
        <thead>
          <tr>
            <th scope="col">{t("trendColPeriod", { defaultValue: "Period" })}</th>
            <th scope="col">{t("seriesReported", { defaultValue: "Reported" })}</th>
            <th scope="col">{t("seriesResolved", { defaultValue: "Resolved" })}</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p, i) => (
            <tr key={i}>
              <th scope="row">{p.day}</th>
              <td>{p.reported}</td>
              <td>{p.resolved}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
