/** One coherent icon set: 24px viewBox, 1.8 stroke, round caps. */
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 20, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const Icons = {
  home: (p: IconProps) => (
    <Icon {...p}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /></Icon>
  ),
  list: (p: IconProps) => (
    <Icon {...p}><path d="M8 6h13M8 12h13M8 18h13" /><circle cx="3.5" cy="6" r="0.8" /><circle cx="3.5" cy="12" r="0.8" /><circle cx="3.5" cy="18" r="0.8" /></Icon>
  ),
  plus: (p: IconProps) => (
    <Icon {...p}><path d="M12 5v14M5 12h14" /></Icon>
  ),
  search: (p: IconProps) => (
    <Icon {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.8-3.8" /></Icon>
  ),
  settings: (p: IconProps) => (
    <Icon {...p}><circle cx="12" cy="12" r="3.2" /><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5 5l2.1 2.1M16.9 16.9 19 19M19 5l-2.1 2.1M7.1 16.9 5 19" /></Icon>
  ),
  paw: (p: IconProps) => (
    <Icon {...p}>
      <ellipse cx="7" cy="9" rx="1.8" ry="2.4" />
      <ellipse cx="17" cy="9" rx="1.8" ry="2.4" />
      <ellipse cx="4.5" cy="13.5" rx="1.5" ry="2" />
      <ellipse cx="19.5" cy="13.5" rx="1.5" ry="2" />
      <path d="M12 11.5c-3.2 0-5.5 2.6-5.5 5.2 0 1.6 1.2 2.6 2.8 2.6 1 0 1.8-.4 2.7-.4s1.7.4 2.7.4c1.6 0 2.8-1 2.8-2.6 0-2.6-2.3-5.2-5.5-5.2Z" />
    </Icon>
  ),
  bird: (p: IconProps) => (
    <Icon {...p}><path d="M16 7a3 3 0 1 0-6 0c0 4-4 5-7 5 2 3 5.5 5 9 5 4.5 0 8-3 8-7.5 0-1.5-.5-2.5-1.5-3.5L16 3v3.5" /><circle cx="13.8" cy="6.3" r="0.4" fill="currentColor" /></Icon>
  ),
  timeline: (p: IconProps) => (
    <Icon {...p}><path d="M12 3v18" /><circle cx="12" cy="6.5" r="2.5" /><circle cx="12" cy="17.5" r="2.5" /><path d="M14 6.5h5M14 17.5h5" /></Icon>
  ),
  handoff: (p: IconProps) => (
    <Icon {...p}><path d="M3 8h11l-3-3M21 16H10l3 3" /></Icon>
  ),
  eye: (p: IconProps) => (
    <Icon {...p}><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="3" /></Icon>
  ),
  camera: (p: IconProps) => (
    <Icon {...p}><path d="M4 8h3l2-2.5h6L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" /><circle cx="12" cy="13.5" r="3.5" /></Icon>
  ),
  warning: (p: IconProps) => (
    <Icon {...p}><path d="M12 3 2.5 20h19L12 3Z" /><path d="M12 10v4.5" /><circle cx="12" cy="17.2" r="0.4" fill="currentColor" /></Icon>
  ),
  info: (p: IconProps) => (
    <Icon {...p}><circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><circle cx="12" cy="8" r="0.4" fill="currentColor" /></Icon>
  ),
  help: (p: IconProps) => (
    <Icon {...p}><circle cx="12" cy="12" r="9" /><path d="M9.5 9.2a2.6 2.6 0 0 1 5 .8c0 1.7-2.5 2-2.5 3.5" /><circle cx="12" cy="16.8" r="0.4" fill="currentColor" /></Icon>
  ),
  trash: (p: IconProps) => (
    <Icon {...p}><path d="M4 6h16M9.5 6V4.5A1.5 1.5 0 0 1 11 3h2a1.5 1.5 0 0 1 1.5 1.5V6M6.5 6l1 14h9l1-14" /></Icon>
  ),
  archive: (p: IconProps) => (
    <Icon {...p}><rect x="3" y="4" width="18" height="4.5" rx="1" /><path d="M5 8.5V19a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8.5M10 12.5h4" /></Icon>
  ),
  pin: (p: IconProps) => (
    <Icon {...p}><path d="M9 4h6l-.7 5.2 3.2 3.3H6.5l3.2-3.3L9 4ZM12 12.5V21" /></Icon>
  ),
  download: (p: IconProps) => (
    <Icon {...p}><path d="M12 4v11M7 11l5 5 5-5" /><path d="M4 20h16" /></Icon>
  ),
  upload: (p: IconProps) => (
    <Icon {...p}><path d="M12 15V4M7 9l5-5 5 5" /><path d="M4 20h16" /></Icon>
  ),
  print: (p: IconProps) => (
    <Icon {...p}><path d="M7 8V3h10v5" /><rect x="4" y="8" width="16" height="8" rx="1.5" /><path d="M7 13h10v8H7v-8Z" /></Icon>
  ),
  check: (p: IconProps) => (
    <Icon {...p}><path d="m4.5 12.5 5 5 10-11" /></Icon>
  ),
  x: (p: IconProps) => (
    <Icon {...p}><path d="M6 6l12 12M18 6 6 18" /></Icon>
  ),
  chevronRight: (p: IconProps) => (
    <Icon {...p}><path d="m9 5 7 7-7 7" /></Icon>
  ),
  chevronLeft: (p: IconProps) => (
    <Icon {...p}><path d="M15 5 8 12l7 7" /></Icon>
  ),
  chevronDown: (p: IconProps) => (
    <Icon {...p}><path d="m5 9 7 7 7-7" /></Icon>
  ),
  edit: (p: IconProps) => (
    <Icon {...p}><path d="M14.5 4.5 19.5 9.5 8 21H3v-5L14.5 4.5Z" /><path d="m12.5 6.5 5 5" /></Icon>
  ),
  shield: (p: IconProps) => (
    <Icon {...p}><path d="M12 3 5 5.5v6C5 16 8 19.5 12 21c4-1.5 7-5 7-9.5v-6L12 3Z" /></Icon>
  ),
  compass: (p: IconProps) => (
    <Icon {...p}><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" /></Icon>
  ),
  book: (p: IconProps) => (
    <Icon {...p}><path d="M4 5a2 2 0 0 1 2-2h13v17H6a2 2 0 0 0-2 2V5Z" /><path d="M19 16H6a2 2 0 0 0-2 2" /></Icon>
  ),
  heart: (p: IconProps) => (
    <Icon {...p}><path d="M12 20.5C6.5 16.5 3 13.5 3 9.7 3 7 5 5 7.5 5c1.8 0 3.4 1 4.5 2.6C13.1 6 14.7 5 16.5 5 19 5 21 7 21 9.7c0 3.8-3.5 6.8-9 10.8Z" /></Icon>
  ),
  undo: (p: IconProps) => (
    <Icon {...p}><path d="M8 5 3.5 9.5 8 14" /><path d="M4 9.5h10a6 6 0 0 1 0 12h-4" /></Icon>
  ),
};
