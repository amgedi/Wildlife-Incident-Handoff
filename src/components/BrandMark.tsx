/**
 * THE canonical Wildlife Incident Handoff mark (0.3) — the "handoff relay".
 *
 * The paw is retired as the app identity. The new mark is an abstract
 * transfer/relay symbol: a filled origin node handing off along a route
 * curve to a ringed destination node. Text-free, theme-token colored,
 * recognizable at 16px / 32px / 64px / installer size.
 *
 * Geometry contract (asserted by tests):
 *  - exactly TWO nodes (one filled circle, one stroked ring)
 *  - exactly ONE route path connecting them
 *  - NO hard-coded colors — only --brand-icon-* tokens
 *  - viewBox 0 0 64 64; clean at 16px, 32px, 64px, 512px
 *
 * The old BearPawMark geometry is retained only as a deprecated alias for
 * history tests; it is no longer used by the app shell or profile.
 */

export const ORIGIN_NODE = { cx: 20, cy: 44, r: 7.5 };
export const DEST_NODE = { cx: 44, cy: 20, r: 8 };
export const ROUTE_PATH = "M20 44 C 31 44 33 20 44 20";

export function AppMarkGeometry({ fg, bg }: { fg: string; bg?: string }) {
  return (
    <g>
      {/* route: origin → destination */}
      <path d={ROUTE_PATH} fill="none" stroke={fg} strokeWidth="5.5" strokeLinecap="round" />
      {/* origin: filled node (the case being handed off) */}
      <circle cx={ORIGIN_NODE.cx} cy={ORIGIN_NODE.cy} r={ORIGIN_NODE.r} fill={fg} />
      {/* destination: ringed node (the receiving responder) */}
      <circle cx={DEST_NODE.cx} cy={DEST_NODE.cy} r={DEST_NODE.r} fill={bg ?? "transparent"} stroke={fg} strokeWidth="5" />
    </g>
  );
}

export function AppMark({
  size = 28,
  tile = true,
  className,
  style,
  title,
}: {
  size?: number;
  tile?: boolean;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
}) {
  const bgToken = "var(--brand-icon-bg, #2f5d3f)";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
      className={className}
      style={style}
    >
      {tile && (
        <>
          <rect width="64" height="64" rx="14" fill={bgToken} />
          <rect
            width="63"
            height="63"
            x="0.5"
            y="0.5"
            rx="13.5"
            fill="none"
            stroke="var(--brand-icon-border, transparent)"
            strokeWidth="1"
          />
        </>
      )}
      <AppMarkGeometry
        fg="var(--brand-icon-fg, #eef3e9)"
        bg={tile ? bgToken : undefined}
      />
    </svg>
  );
}

/** Backwards-compatible alias used by the app shell — now the relay mark. */
export function BrandMark({ size = 28 }: { size?: number }) {
  return <AppMark size={size} title="Wildlife Incident Handoff" />;
}

/* --------------------------------------------------------------------- */
/* DEPRECATED paw geometry — kept verbatim for historical test coverage; */
/* nothing in the app renders it anymore.                                */
/* --------------------------------------------------------------------- */

export const PAW_TOES: { cx: number; cy: number; rot: number }[] = [
  { cx: 15.5, cy: 28, rot: -26 },
  { cx: 25.5, cy: 17.5, rot: -9 },
  { cx: 38.5, cy: 17.5, rot: 9 },
  { cx: 48.5, cy: 28, rot: 26 },
];

const TOE_RX = 7;
const TOE_RY = 10;

export const PAD_PATH =
  "M32 33.5C21.5 33.5 13.5 41 13.5 49.5c0 6 4.9 9.8 11.1 9.8 2.9 0 5-0.9 7.4-0.9s4.5 0.9 7.4 0.9c6.2 0 11.1-3.8 11.1-9.8 0-8.5-8-16-18.5-16Z";

export function BearPawMark({
  size = 28,
  tile = true,
  className,
  style,
  title,
}: {
  size?: number;
  tile?: boolean;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
}) {
  const bgToken = "var(--brand-icon-bg, #2f5d3f)";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
      className={className}
      style={style}
    >
      {tile && (
        <>
          <rect width="64" height="64" rx="14" fill={bgToken} />
          <rect width="63" height="63" x="0.5" y="0.5" rx="13.5" fill="none" stroke="var(--brand-icon-border, transparent)" strokeWidth="1" />
        </>
      )}
      <g transform={tile ? undefined : "translate(5.5 5.5) scale(0.83)"}>
        {PAW_TOES.map((toe) => {
          const rad = (toe.rot * Math.PI) / 180;
          const dx = Math.sin(rad) * (TOE_RY * 0.92);
          const dy = -Math.cos(rad) * (TOE_RY * 0.92);
          return (
            <g key={toe.cx} transform={`rotate(${toe.rot} ${toe.cx} ${toe.cy})`}>
              <ellipse cx={toe.cx} cy={toe.cy} rx={TOE_RX} ry={TOE_RY} fill="var(--brand-icon-fg, #eef3e9)" />
              <ellipse cx={toe.cx + dx} cy={toe.cy + dy} rx={2.9} ry={4.4} fill="var(--brand-icon-fg, #eef3e9)" fillOpacity={0.62} />
            </g>
          );
        })}
        <path d={PAD_PATH} fill="var(--brand-icon-fg, #eef3e9)" />
      </g>
    </svg>
  );
}
