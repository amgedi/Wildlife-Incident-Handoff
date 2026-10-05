/** Theme gallery data — mirrors the app's canonical themeCatalog. */
export interface ThemeDef { id: string; label: string; bg: string; accent: string; ink: string }

export const THEMES: ThemeDef[] = [
  { id: "forest-night", label: "Forest Night", bg: "#0a120d", accent: "#4e9d6f", ink: "#dde8de" },
  { id: "forest-dark", label: "Forest Dark", bg: "#1f3d2b", accent: "#4e9d6f", ink: "#f0f3ec" },
  { id: "forest-light", label: "Forest Light", bg: "#e3ead9", accent: "#2f5d3f", ink: "#1c2a20" },
  { id: "midnight", label: "Midnight", bg: "#10151d", accent: "#4f9d6e", ink: "#e2e8ee" },
  { id: "midnight-ops", label: "Midnight Ops", bg: "#070c14", accent: "#3d8bff", ink: "#dbe6f2" },
  { id: "storm", label: "Storm", bg: "#0d0f13", accent: "#7c8cf8", ink: "#dfe3ea" },
  { id: "aurora", label: "Aurora", bg: "#060b0d", accent: "#2fbf9b", ink: "#d8e8e6" },
  { id: "warm-field", label: "Warm Field", bg: "#4a3b28", accent: "#b58a4a", ink: "#f7f2e8" },
  { id: "moss", label: "Moss", bg: "#3f5233", accent: "#8fb060", ink: "#eceee4" },
  { id: "ocean", label: "Ocean", bg: "#123a5c", accent: "#3f9dbf", ink: "#e9eff4" },
  { id: "slate", label: "Slate", bg: "#2d3748", accent: "#7c9cc5", ink: "#eef0f2" },
  { id: "sand", label: "Sand", bg: "#6b4f2a", accent: "#d8a860", ink: "#f6f1e7" },
  { id: "arctic", label: "Arctic", bg: "#1c4a5e", accent: "#5aa8c5", ink: "#eef3f6" },
  { id: "high-contrast-dark", label: "High Contrast Dark", bg: "#000000", accent: "#7fb7ff", ink: "#ffffff" },
  { id: "mono-dark", label: "Monochrome Dark", bg: "#000000", accent: "#e8e8e8", ink: "#f2f2f2" },
  { id: "mono-light", label: "Monochrome Light", bg: "#111111", accent: "#8a8a8a", ink: "#fafafa" },
];

export const DEFAULT_THEME = "forest-night";
