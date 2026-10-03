/**
 * THE canonical bear-paw mark — one geometry, used everywhere.
 *
 * Geometry contract (asserted by tests):
 *  - exactly FOUR toes
 *  - exactly FOUR claws (one per toe, attached — never detached)
 *  - ONE main pad (exactly one <path> element in the rendered mark)
 *  - left/right symmetric
 *  - viewBox 0 0 64 64; clean at 16px, 32px, 64px, 512px
 *
 * 0.2.0-dev.11: the main pad can carry the scenic emblem from the new brand
 * artwork (mountain, forest, winding river). The scene is drawn with simple
 * polygons ON TOP of the solid pad — no extra <path> elements, so the
 * geometry contract holds. It uses only the two brand tokens, so it follows
 * the active theme automatically.
 *
 * Colors come from theme tokens (never hard-coded in the component):
 *  --brand-icon-bg    tile background (also the scene's "ink")
 *  --brand-icon-fg    paw foreground (also the scene's "sky" / river / snow)
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

export const PAD_PATH =
  "M32 33.5C21.5 33.5 13.5 41 13.5 49.5c0 6 4.9 9.8 11.1 9.8 2.9 0 5-0.9 7.4-0.9s4.5 0.9 7.4 0.9c6.2 0 11.1-3.8 11.1-9.8 0-8.5-8-16-18.5-16Z";

/**
 * Scenic pad interior — mountain ridge with snowcaps, forest band with a
 * serrated treeline, and a winding river. Only <polygon>/<rect>/<polyline>
 * are used (the geometry test counts <path> elements: there must be exactly
 * one — the pad itself). All shapes stay inside the pad silhouette.
 */
export function PadScene({ ink, sky }: { ink: string; sky: string }) {
  return (
    <g>
      {/* forest mass */}
      <rect x="14.8" y="45.6" width="34.4" height="12.6" rx="2.4" fill={ink} />
      {/* mountain ridge */}
      <polygon
        points="18.2,46.4 25,38.2 28.6,42.6 32,35.6 35.4,42.6 39,38.2 45.8,46.4 45.8,47.4 18.2,47.4"
        fill={ink}
      />
      {/* snowcaps (sky color) */}
      <polygon points="30.6,38.6 32,35.6 33.4,38.6 32.6,37.9 31.4,39.2" fill={sky} />
      <polygon points="24.2,40.1 25,38.2 25.8,40.1 25.3,39.6 24.7,40.4" fill={sky} />
      <polygon points="38.2,40.1 39,38.2 39.8,40.1 39.3,39.6 38.7,40.4" fill={sky} />
      {/* winding river (sky color) */}
      <polyline
        points="20.6,45.8 24,49 21.8,51.8 27.4,54.6 26.2,58.2"
        fill="none"
        stroke={sky}
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.92"
      />
      {/* serrated treeline over the band edge */}
      <polygon
        points="15.2,47.2 16.6,44.4 18,47.2 19.6,44 21.2,47.2 22.6,44.6 24,47.2 25.6,43.8 27,47.2 28.6,44.8 30,47.2 31.6,43.8 33,47.2 34.6,44.6 36,47.2 37.6,43.8 39,47.2 40.6,44.4 42,47.2 43.6,44 45.2,47.2 46.6,44.8 48.2,47.2 48.2,47.6 15.2,47.6"
        fill={ink}
      />
      {/* a few taller foreground pines */}
      <polygon points="17.4,52.6 19,48.6 20.6,52.6" fill={sky} opacity="0.35" />
      <polygon points="42.4,53.4 44.2,48.8 46,53.4" fill={sky} opacity="0.35" />
      <polygon points="35.2,56.2 36.6,52.8 38,56.2" fill={sky} opacity="0.28" />
    </g>
  );
}

export function PawGeometry({ fg, scene = false, bg }: { fg: string; scene?: boolean; bg?: string }) {
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
      <path d={PAD_PATH} fill={fg} />
      {scene && <PadScene ink={bg ?? "var(--brand-icon-bg, #2f5d3f)"} sky={fg} />}
    </g>
  );
}

export function BearPawMark({
  size = 28,
  tile = true,
  scene = true,
  className,
  style,
  title,
}: {
  size?: number;
  tile?: boolean;
  /** Draw the scenic emblem inside the main pad (theme-aware). */
  scene?: boolean;
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
      <g transform={tile ? undefined : "translate(5.5 5.5) scale(0.83)"}>
        <PawGeometry fg="var(--brand-icon-fg, #eef3e9)" scene={scene} bg={bgToken} />
      </g>
    </svg>
  );
}

/** Backwards-compatible alias used by the app shell. */
export function BrandMark({ size = 28 }: { size?: number }) {
  return <BearPawMark size={size} title="Wildlife Incident Handoff" />;
}
