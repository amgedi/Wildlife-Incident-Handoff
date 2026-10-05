/** Semantic navigation icons for the launcher. */
interface IconProps { size?: number }

const base = (size = 17) => ({
  width: size, height: size, viewBox: "0 0 24 24", fill: "none",
  stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
  "aria-hidden": true,
});

export const IconHome = ({ size }: IconProps) => (
  <svg {...base(size)}><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10.5V20h13v-9.5" /></svg>
);
export const IconUpdates = ({ size }: IconProps) => (
  <svg {...base(size)}><path d="M12 3v12" /><path d="m7 11 5 5 5-5" /><path d="M4 19h16" /></svg>
);
export const IconDiagnostics = ({ size }: IconProps) => (
  <svg {...base(size)}><path d="M3 12h4l2.5-6 4 12L16 12h5" /></svg>
);
export const IconSettings = ({ size }: IconProps) => (
  <svg {...base(size)}><path d="M4 7h10" /><circle cx="18" cy="7" r="2.4" /><path d="M20 17H10" /><circle cx="6" cy="17" r="2.4" /></svg>
);
export const IconAbout = ({ size }: IconProps) => (
  <svg {...base(size)}><circle cx="12" cy="12" r="9" /><path d="M12 11v6" /><path d="M12 7.4v.4" /></svg>
);
export const IconDeveloper = ({ size }: IconProps) => (
  <svg {...base(size)}><path d="m8 8-4 4 4 4" /><path d="m16 8 4 4-4 4" /><path d="m13 5-2 14" /></svg>
);
export const IconRefresh = ({ size }: IconProps) => (
  <svg {...base(size)}><path d="M20 12a8 8 0 1 1-2.5-5.8" /><path d="M20 4v4h-4" /></svg>
);
export const IconWrench = ({ size }: IconProps) => (
  <svg {...base(size)}><path d="M14.5 6.5a4 4 0 0 0-5.6 4.9L4 16.3V20h3.7l4.9-4.9a4 4 0 0 0 4.9-5.6L14.7 12l-2.7-2.7 2.5-2.8Z" /></svg>
);
export const IconDownload = ({ size }: IconProps) => (
  <svg {...base(size)}><path d="M12 3v11" /><path d="m7.5 10.5 4.5 4 4.5-4" /><path d="M5 20h14" /></svg>
);
export const IconFolder = ({ size }: IconProps) => (
  <svg {...base(size)}><path d="M3.5 7V19h17V9.5H12l-2-2.5H3.5Z" /></svg>
);
export const IconRocket = ({ size }: IconProps) => (
  <svg {...base(size)}><path d="M12 15c5-3.5 6.5-7.5 6-11-3.5-.5-7.5 1-11 6l-2.5 3.5L8 17l4-2Z" /><circle cx="13.5" cy="9.5" r="1.6" /><path d="M6 18c-1 1-1.4 2.4-1.5 3.5C5.6 21.4 7 21 8 20" /></svg>
);
export const IconGlobe = ({ size }: IconProps) => (
  <svg {...base(size)}><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3c2.6 2.6 3.8 5.8 3.8 9S14.6 18.4 12 21c-2.6-2.6-3.8-5.8-3.8-9S9.4 5.6 12 3Z" /></svg>
);
export const IconClock = ({ size }: IconProps) => (
  <svg {...base(size)}><circle cx="12" cy="12" r="9" /><path d="M12 7v5.2l3.4 2" /></svg>
);
export const IconCopy = ({ size }: IconProps) => (
  <svg {...base(size)}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5h10" /></svg>
);
export const IconHeart = ({ size }: IconProps) => (
  <svg {...base(size)}><path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10Z" /></svg>
);
export const IconTerminal = ({ size }: IconProps) => (
  <svg {...base(size)}><rect x="3" y="4.5" width="18" height="15" rx="2.5" /><path d="m7 9.5 3 3-3 3" /><path d="M12.5 15.5H17" /></svg>
);
