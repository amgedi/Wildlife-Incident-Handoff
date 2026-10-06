/**
 * Canonical Wildlife Incident Handoff app mark.
 *
 * The mark represents information moving from an origin to a destination.
 * It stays text-free, uses theme tokens, and remains legible at small sizes.
 */

export const ORIGIN_NODE = { cx: 20, cy: 44, r: 7.5 };
export const DEST_NODE = { cx: 44, cy: 20, r: 8 };
export const ROUTE_PATH = "M20 44 C 31 44 33 20 44 20";

export function AppMarkGeometry({ fg, bg }: { fg: string; bg?: string }) {
  return (
    <g>
      <path d={ROUTE_PATH} fill="none" stroke={fg} strokeWidth="5.5" strokeLinecap="round" />
      <circle cx={ORIGIN_NODE.cx} cy={ORIGIN_NODE.cy} r={ORIGIN_NODE.r} fill={fg} />
      <circle
        cx={DEST_NODE.cx}
        cy={DEST_NODE.cy}
        r={DEST_NODE.r}
        fill={bg ?? "transparent"}
        stroke={fg}
        strokeWidth="5"
      />
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

export function BrandMark({ size = 28 }: { size?: number }) {
  return <AppMark size={size} title="Wildlife Incident Handoff" />;
}

/** Compatibility alias for older internal imports. New code should use AppMark. */
export function BearPawMark(props: React.ComponentProps<typeof AppMark>) {
  return <AppMark {...props} />;
}
