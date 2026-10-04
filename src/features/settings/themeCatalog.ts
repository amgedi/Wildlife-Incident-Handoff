/** Canonical theme catalog — the single source both Settings → Appearance and
 *  onboarding render from. Adding a theme here is required for it to be
 *  user-selectable (0.3.0-dev.5: fixes the onboarding picker having drifted to
 *  a stale 10-entry list while Settings had all 16). */
import type { ThemeName } from "../../types/settings";

export interface ThemeOption {
  value: ThemeName;
  label: string;
  swatch: string[];
}

export const THEME_CATALOG: ThemeOption[] = [
  { value: "forest-night", label: "Forest Night", swatch: ["#0a120d", "#4e9d6f", "#dde8de"] },
  { value: "forest-dark", label: "Forest Dark", swatch: ["#1f3d2b", "#2f5d3f", "#f0f3ec"] },
  { value: "forest-light", label: "Forest Light", swatch: ["#e3ead9", "#2f5d3f", "#eef2e9"] },
  { value: "midnight", label: "Midnight", swatch: ["#10151d", "#4f9d6e", "#e2e8ee"] },
  { value: "midnight-ops", label: "Midnight Ops", swatch: ["#070c14", "#3d8bff", "#dbe6f2"] },
  { value: "storm", label: "Storm", swatch: ["#0d0f13", "#7c8cf8", "#dfe3ea"] },
  { value: "aurora", label: "Aurora", swatch: ["#060b0d", "#2fbf9b", "#d8e8e6"] },
  { value: "warm-field", label: "Warm Field", swatch: ["#4a3b28", "#7a5a2e", "#f7f2e8"] },
  { value: "moss", label: "Moss", swatch: ["#3f5233", "#55702f", "#eceee4"] },
  { value: "ocean", label: "Ocean", swatch: ["#123a5c", "#1c6e8c", "#e9eff4"] },
  { value: "slate", label: "Slate", swatch: ["#2d3748", "#4a6285", "#eef0f2"] },
  { value: "sand", label: "Sand", swatch: ["#6b4f2a", "#9a6b2f", "#f6f1e7"] },
  { value: "arctic", label: "Arctic", swatch: ["#1c4a5e", "#23708f", "#eef3f6"] },
  { value: "high-contrast-dark", label: "High Contrast Dark", swatch: ["#000000", "#7fb7ff", "#ffffff"] },
  { value: "mono-dark", label: "Monochrome Dark", swatch: ["#000000", "#e8e8e8", "#f2f2f2"] },
  { value: "mono-light", label: "Monochrome Light", swatch: ["#111111", "#171717", "#fafafa"] },
];
