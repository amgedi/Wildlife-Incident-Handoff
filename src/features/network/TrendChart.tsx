/**
 * TrendChart (0.2.0-dev.14): smooth area/line chart — gradient fill for
 * reported, line for resolved — with y gridlines, crosshair hover/focus,
 * padded x-axis, click/tap a dot for a details card, legend and a
 * screen-reader data table. Scales to actual data.
 */
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

export interface SeriesPoint {
  day: string;
  reported: number;
  resolved: number;
}

const PAD_L = 34;
const PAD_R = 14;
const PAD_T = 8;

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
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const max = Math.max(1, ...points.map((p) => Math.max(p.reported, p.resolved)));
  const width = 920;
  const height = 190;
  const chartH = 128;
  const plotW = width - PAD_L - PAD_R;
  const n = Math.max(1, points.length);
  const xAt = (i: number) => PAD_L + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const yAt = (v: number) => chartH - (v / max) * (chartH - PAD_T);
  const labelEvery = points.length > 40 ? Math.ceil(points.length / 6) : points.length > 14 ? Math.ceil(points.length / 7) : 1;
  const yTicks = max > 4 ? [0, Math.round(max / 2), max] : [0, max];
  const hoverPoint = hover != null ? points[hover] : null;
  const openPoint = openIdx != null ? points[openIdx] : null;

  // Close the details box on outside click / Escape.
  useEffect(() => {
    if (openIdx == null) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpenIdx(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenIdx(null);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [openIdx]);

  const reportedPts = points.map((p, i) => ({ x: xAt(i), y: yAt(p.reported) }));
  const resolvedPts = points.map((p, i) => ({ x: xAt(i), y: yAt(p.resolved) }));
  const areaPath =
    points.length > 1
      ? `${smoothPath(reportedPts)} L${xAt(points.length - 1).toFixed(1)},${chartH} L${xAt(0).toFixed(1)},${chartH} Z`
      : "";

  // SVG viewBox → screen % position for the details box.
  const boxLeftPct = openIdx != null ? (xAt(openIdx) / width) * 100 : 0;
  const boxTopPx = openIdx != null ? yAt(points[openIdx]!.reported) + 12 : 0;

  return (
    <div style={{ position: "relative" }}>
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
          {points.length > 1 && <path d={areaPath} fill="url(#trend-area)" />}
          {points.length > 1 && <path d={smoothPath(resolvedPts)} fill="none" stroke="var(--c-ink-soft)" strokeWidth="1.6" opacity="0.85" />}
          {points.map((p, i) => {
            const isHover = hover === i;
            const isOpen = openIdx === i;
            return (
              <g
                key={i}
                tabIndex={0}
                role="button"
                aria-label={`${p.day}: ${p.reported} reported, ${p.resolved} resolved`}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onClick={() => setOpenIdx(isOpen ? null : i)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setOpenIdx(isOpen ? null : i);
                  }
                }}
                style={{ cursor: "pointer", outline: "none" }}
              >
                <rect x={xAt(i) - plotW / (2 * n)} y={0} width={Math.max(6, plotW / n)} height={chartH + 12} fill="transparent" />
                {isHover && <line x1={xAt(i)} y1={2} x2={xAt(i)} y2={chartH + 12} stroke="var(--c-ink-soft)" strokeWidth="1" opacity="0.6" />}
                <circle cx={xAt(i)} cy={yAt(p.reported) + 12} r={isHover || isOpen ? 4.5 : 2.4} fill="var(--c-primary)" opacity={hover == null || isHover || isOpen ? 1 : 0.5} />
                <circle cx={xAt(i)} cy={yAt(p.resolved) + 12} r={isHover || isOpen ? 3.6 : 2} fill="var(--c-ink-soft)" opacity={hover == null || isHover || isOpen ? 0.9 : 0.4} />
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

      {/* click/tap details card */}
      {openPoint && (
        <div
          ref={boxRef}
          className="card trend-info-box"
          role="dialog"
          aria-label={t("trendInfoTitle", { defaultValue: "Period details" })}
          style={{ left: `${Math.min(92, Math.max(2, boxLeftPct))}%`, top: Math.max(0, boxTopPx - 8) }}
        >
          <div className="row between" style={{ gap: 8, marginBottom: 4 }}>
            <strong style={{ fontSize: "0.88rem" }}>{openPoint.day}</strong>
            <button className="btn btn-quiet btn-sm" aria-label={t("close", { defaultValue: "Close" })} onClick={() => setOpenIdx(null)}>×</button>
          </div>
          <dl className="kv" style={{ margin: 0 }}>
            <dt>{t("seriesReported", { defaultValue: "Reported" })}</dt>
            <dd>{openPoint.reported}</dd>
            <dt>{t("seriesResolved", { defaultValue: "Resolved" })}</dt>
            <dd>{openPoint.resolved}</dd>
            <dt>{t("trendNet", { defaultValue: "Still open from this period" })}</dt>
            <dd>{Math.max(0, openPoint.reported - openPoint.resolved)}</dd>
          </dl>
        </div>
      )}

      {/* hover/focus value readout */}
      <div aria-live="polite" style={{ minHeight: 22, marginTop: 2, fontSize: "0.82rem", color: "var(--c-ink-soft)" }}>
        {hoverPoint
          ? t("trendPoint", { defaultValue: "{{day}}: {{reported}} reported, {{resolved}} resolved", day: hoverPoint.day, reported: hoverPoint.reported, resolved: hoverPoint.resolved })
          : t("trendHoverHint", { defaultValue: "Hover or click a point for details." })}
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
