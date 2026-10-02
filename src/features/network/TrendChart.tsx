/** Lightweight accessible SVG bar chart (no framework dependency). */
export interface SeriesPoint {
  day: string;
  reported: number;
  resolved: number;
}



export function TrendChart({ points }: { points: SeriesPoint[] }) {
  const max = Math.max(1, ...points.map((p) => Math.max(p.reported, p.resolved)));
  const barW = points.length > 14 ? 8 : 24;
  const gap = 6;
  const width = points.length * (barW * 2 + gap) + gap;
  const height = 140;
  const chartH = 110;
  const labelEvery = points.length > 14 ? Math.ceil(points.length / 7) : 1;

  return (
    <div role="img" aria-label={`Reports over time: ${points.map((p) => `${p.day}: ${p.reported} reported, ${p.resolved} resolved`).join("; ")}`}>
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ maxWidth: width }}>
        {/* baseline */}
        <line x1={gap} y1={chartH} x2={width - gap} y2={chartH} stroke="var(--c-border-strong)" strokeWidth="1" />
        {points.map((p: SeriesPoint, i) => {
          const x = gap + i * (barW * 2 + gap);
          const rh = (p.reported / max) * (chartH - 10);
          const sh = (p.resolved / max) * (chartH - 10);
          return (
            <g key={i}>
              <rect x={x} y={chartH - rh} width={barW} height={Math.max(rh, p.reported > 0 ? 2 : 0)} fill="var(--c-primary)" rx="2">
                <title>{`${p.day}: ${p.reported} reported`}</title>
              </rect>
              <rect x={x + barW} y={chartH - sh} width={barW} height={Math.max(sh, p.resolved > 0 ? 2 : 0)} fill="var(--c-ink-faint)" rx="2">
                <title>{`${p.day}: ${p.resolved} resolved`}</title>
              </rect>
              {(i % labelEvery === 0 || i === points.length - 1) && (
                <text x={x + barW} y={chartH + 14} fontSize="9" textAnchor="middle" fill="var(--c-ink-faint)">
                  {p.day}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="row" style={{ gap: 14, fontSize: "0.78rem", color: "var(--c-ink-soft)", marginTop: 4 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 10, height: 10, background: "var(--c-primary)", borderRadius: 2, display: "inline-block" }} /> Reported
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 10, height: 10, background: "var(--c-ink-faint)", borderRadius: 2, display: "inline-block" }} /> Resolved
        </span>
      </div>
    </div>
  );
}
