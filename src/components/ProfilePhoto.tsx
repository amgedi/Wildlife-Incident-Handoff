/**
 * ProfilePhoto (0.2.0-dev.14) — circular profile picture with a selectable
 * decorative ring (leaves, wood, rope, stars). Falls back to the canonical
 * paw mark when no photo is set. Colors come from theme tokens so the ring
 * follows the active theme.
 */
import { BearPawMark } from "./BrandMark";
import type { PhotoBorderStyle } from "../types/settings";

export const PHOTO_BORDER_STYLES: PhotoBorderStyle[] = ["none", "leaves", "wood", "rope", "stars"];

export function ProfilePhoto({
  src,
  size = 30,
  border = "leaves",
  title,
}: {
  src: string | null | undefined;
  size?: number;
  border?: PhotoBorderStyle;
  title?: string;
}) {
  if (!src) {
    return <BearPawMark size={size} title={title} />;
  }
  const clipId = `pp-clip-${size}-${(title ?? "p").replace(/\W/g, "")}`;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true} focusable="false">
      <defs>
        <clipPath id={clipId}>
          <circle cx="32" cy="32" r={border === "none" ? 26 : 23} />
        </clipPath>
      </defs>
      <circle cx="32" cy="32" r="26" fill="var(--brand-icon-bg, #2f5d3f)" />
      <image href={src} x="4" y="4" width="56" height="56" clipPath={`url(#${clipId})`} preserveAspectRatio="xMidYMid slice" />
      <DecorativeRing border={border} />
    </svg>
  );
}

function DecorativeRing({ border }: { border: PhotoBorderStyle }) {
  const ink = "var(--brand-icon-fg, #eef3e9)";
  const accent = "var(--c-primary, #2f5d3f)";
  if (border === "none") {
    return <circle cx="32" cy="32" r="26" fill="none" stroke={ink} strokeWidth="2" />;
  }
  if (border === "rope") {
    return (
      <g fill="none">
        <circle cx="32" cy="32" r="25" stroke={accent} strokeWidth="3.4" strokeDasharray="4.5 3" strokeLinecap="round" />
        <circle cx="32" cy="32" r="25" stroke={ink} strokeWidth="1" strokeDasharray="4.5 3" strokeDashoffset="2.2" opacity="0.7" />
      </g>
    );
  }
  if (border === "wood") {
    // two wavy bark rings
    return (
      <g fill="none">
        <circle cx="32" cy="32" r="25" stroke={accent} strokeWidth="4" opacity="0.9" />
        <circle cx="32" cy="32" r="25" stroke={ink} strokeWidth="1.1" strokeDasharray="10 6" opacity="0.85" />
        <circle cx="32" cy="32" r="21.5" stroke={ink} strokeWidth="0.8" strokeDasharray="3 5" opacity="0.6" />
      </g>
    );
  }
  if (border === "stars") {
    return (
      <g>
        <circle cx="32" cy="32" r="25.5" fill="none" stroke={ink} strokeWidth="1.4" opacity="0.9" />
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i / 8) * Math.PI * 2;
          const x = 32 + Math.cos(a) * 29;
          const y = 32 + Math.sin(a) * 29;
          return (
            <polygon
              key={i}
              points={`${x},${y - 3} ${x + 0.9},${y - 0.9} ${x + 3},${y} ${x + 0.9},${y + 0.9} ${x},${y + 3} ${x - 0.9},${y + 0.9} ${x - 3},${y} ${x - 0.9},${y - 0.9}`}
              fill={accent}
            />
          );
        })}
      </g>
    );
  }
  // leaves (default): 10 leaves around the ring
  return (
    <g>
      <circle cx="32" cy="32" r="25.5" fill="none" stroke={accent} strokeWidth="1.6" opacity="0.9" />
      {Array.from({ length: 10 }, (_, i) => {
        const a = (i / 10) * Math.PI * 2;
        const x = 32 + Math.cos(a) * 29;
        const y = 32 + Math.sin(a) * 29;
        const rot = (a * 180) / Math.PI + 90;
        return (
          <g key={i} transform={`rotate(${rot} ${x} ${y})`}>
            <path
              d={`M${x} ${y - 3.4} C${x + 2.6} ${y - 1.6} ${x + 2.6} ${y + 1.6} ${x} ${y + 3.4} C${x - 2.6} ${y + 1.6} ${x - 2.6} ${y - 1.6} ${x} ${y - 3.4} Z`}
              fill={accent}
            />
            <line x1={x} y1={y - 2.4} x2={x} y2={y + 2.4} stroke={ink} strokeWidth="0.55" opacity="0.85" />
          </g>
        );
      })}
    </g>
  );
}
