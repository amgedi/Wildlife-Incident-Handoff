/**
 * Canonical bear-paw mark.
 *
 * ONE geometry, used everywhere: app logo, sidebar, home-hero watermark,
 * empty states, and the source for the favicon/PWA/desktop icons
 * (public/favicon.svg + tauri icon pipeline derive from the same paths).
 * Variants may change size/color/opacity/background — never the geometry.
 */
export function BearPawMark({
  size = 28,
  tile = true,
  tileColor = "#2f5d3f",
  pawColor = "#eef3e9",
  className,
  style,
}: {
  size?: number;
  tile?: boolean;
  tileColor?: string;
  pawColor?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role="img"
      aria-label="Wildlife Incident Handoff"
      focusable="false"
      className={className}
      style={style}
    >
      {tile && <rect width="32" height="32" rx="8" fill={tileColor} />}
      <g transform={tile ? undefined : "translate(2.5 2.5)"}>
        <ellipse cx="9.4" cy="12.2" rx="2.5" ry="3.1" transform="rotate(-18 9.4 12.2)" fill={pawColor} />
        <ellipse cx="14.6" cy="9.9" rx="2.5" ry="3.2" transform="rotate(-6 14.6 9.9)" fill={pawColor} />
        <ellipse cx="20" cy="10.6" rx="2.5" ry="3.1" transform="rotate(8 20 10.6)" fill={pawColor} />
        <ellipse cx="24.6" cy="13.6" rx="2.3" ry="2.9" transform="rotate(22 24.6 13.6)" fill={pawColor} />
        <path
          d="M16.4 14.6c-4.1 0-7.1 2.9-7.1 6 0 2.3 1.9 3.8 4.3 3.8 1.1 0 1.9-.3 2.8-.3.9 0 1.7.3 2.8.3 2.4 0 4.3-1.5 4.3-3.8 0-3.1-3-6-7.1-6Z"
          fill={pawColor}
        />
      </g>
    </svg>
  );
}

/** Backwards-compatible alias used by the app shell. */
export function BrandMark({ size = 28 }: { size?: number }) {
  return <BearPawMark size={size} />;
}
