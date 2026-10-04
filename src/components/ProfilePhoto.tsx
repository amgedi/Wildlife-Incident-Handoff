/**
 * ProfilePhoto (0.3) — circular profile picture.
 *
 * 0.3 changes: the paw is no longer the person's default identity. Without
 * an uploaded photo the avatar shows a neutral human silhouette, or the
 * person's initials when a display name exists. The former decorative ring
 * options are retired — a single subtle accent ring. Colors come from theme
 * tokens so the avatar follows the active theme.
 */

export function initialsFor(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  const first = parts[0]![0]!;
  const last = parts.length > 1 ? parts[parts.length - 1]![0]! : "";
  return (first + last).toUpperCase();
}

export function ProfilePhoto({
  src,
  size = 30,
  name,
  title,
}: {
  src: string | null | undefined;
  size?: number;
  /** Display name — used for the initials fallback. */
  name?: string | null;
  title?: string;
}) {
  const fg = "var(--brand-icon-fg, #eef3e9)";
  const bg = "var(--brand-icon-bg, #2f5d3f)";
  const initials = initialsFor(name);
  if (!src) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        role={title ? "img" : undefined}
        aria-label={title}
        aria-hidden={title ? undefined : true}
        focusable="false"
      >
        <circle cx="32" cy="32" r="32" fill={bg} />
        {initials ? (
          <text
            x="32"
            y="32"
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily="var(--font-sans, sans-serif)"
            fontSize={initials.length > 1 ? 24 : 28}
            fontWeight="600"
            fill={fg}
          >
            {initials}
          </text>
        ) : (
          // neutral human silhouette
          <g fill={fg} opacity="0.85">
            <circle cx="32" cy="25" r="10" />
            <path d="M14 52c0-9 8-14 18-14s18 5 18 14v3H14v-3Z" />
          </g>
        )}
      </svg>
    );
  }
  const clipId = `pp-clip-${size}-${(title ?? "p").replace(/\W/g, "")}`;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true} focusable="false">
      <defs>
        <clipPath id={clipId}>
          <circle cx="32" cy="32" r="28" />
        </clipPath>
      </defs>
      <circle cx="32" cy="32" r="30" fill="none" stroke="var(--c-primary, #2f5d3f)" strokeWidth="3" />
      <image href={src} x="2" y="2" width="60" height="60" clipPath={`url(#${clipId})`} preserveAspectRatio="xMidYMid slice" />
    </svg>
  );
}
