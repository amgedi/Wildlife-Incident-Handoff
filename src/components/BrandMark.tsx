/**
 * THE canonical bear-paw mark — one geometry, used everywhere.
 *
 * Geometry contract (asserted by tests):
 *  - exactly FOUR toes
 *  - exactly FOUR claws (one per toe, attached — never detached)
 *  - ONE main pad
 *  - left/right symmetric
 *  - viewBox 0 0 64 64; clean at 16px, 32px, 64px, 512px
 *
 * Colors come from theme tokens (never hard-coded in the component):
 *  --brand-icon-bg    tile background
 *  --brand-icon-fg    paw foreground
 *  --brand-icon-border optional tile border
 * Variants may change size/opacity/background via props — never geometry.
 */

export const PAW_TOES: { cx: number; cy: number; rot: number }[] = [
  { cx: 15.5, cy: 28, rot: -26 },
  { cx: 25.5, cy: 17.5, rot: -9 },
  { cx: 38.5, cy: 17.5, rot: 9 },
  { cx: 48.5, cy: 28, rot: 26 },
];

const TOE_RX = 7;
const TOE_RY = 10;

/** Claw position: attached at the toe tip (offset along the toe's own axis). */
export function clawFor(toe: { cx: number; cy: number; rot: number }) {
  const rad = (toe.rot * Math.PI) / 180;
  const dx = Math.sin(rad) * (TOE_RY * 0.92);
  const dy = -Math.cos(rad) * (TOE_RY * 0.92);
  return { cx: toe.cx + dx, cy: toe.cy + dy, rot: toe.rot };
}

export function PawGeometry({ fg }: { fg: string }) {
  return (
    <g>
      {PAW_TOES.map((toe, i) => {
        const claw = clawFor(toe);
        return (
          <g key={i} transform={`rotate(${toe.rot} ${toe.cx} ${toe.cy})`}>
            <ellipse cx={toe.cx} cy={toe.cy} rx={TOE_RX} ry={TOE_RY} fill={fg} />
            <ellipse
              cx={claw.cx}
              cy={claw.cy}
              rx={2.9}
              ry={4.4}
              fill={fg}
              fillOpacity={0.62}
              transform={`rotate(${toe.rot - toe.rot} ${claw.cx} ${claw.cy})`}
            />
          </g>
        );
      })}
      <path
        d="M32 33.5C21.5 33.5 13.5 41 13.5 49.5c0 6 4.9 9.8 11.1 9.8 2.9 0 5-0.9 7.4-0.9s4.5 0.9 7.4 0.9c6.2 0 11.1-3.8 11.1-9.8 0-8.5-8-16-18.5-16Z"
        fill={fg}
      />
    </g>
  );
}

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
          <rect width="64" height="64" rx="14" fill="var(--brand-icon-bg, #2f5d3f)" />
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
      <g transform={tile ? undefined : "translate(5.5 5.5) scale(0.83)"}>
        <PawGeometry fg="var(--brand-icon-fg, #eef3e9)" />
      </g>
    </svg>
  );
}

/** Backwards-compatible alias used by the app shell. */
export function BrandMark({ size = 28 }: { size?: number }) {
  return <BearPawMark size={size} title="Wildlife Incident Handoff" />;
}
