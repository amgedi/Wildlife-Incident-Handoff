/** Shared command-palette index of settings sections (id, labelKey, keywords).
 *  Kept separate from SettingsPage to avoid a component import cycle. */
export const SECTIONS_HINTS: Array<{ id: string; labelKey: string; keywords: string }> = [
  { id: "appearance", labelKey: "appearance", keywords: "theme material density motion ambient" },
  { id: "experience", labelKey: "experience", keywords: "workspace detail experience" },
  { id: "accessibility", labelKey: "accessibility", keywords: "motion contrast keyboard" },
  { id: "profile", labelKey: "profile", keywords: "name organization role country" },
  { id: "devices", labelKey: "devices", keywords: "devices fingerprint trust pair" },
  { id: "privacy", labelKey: "privacy", keywords: "privacy location contacts" },
  { id: "storage", labelKey: "storage", keywords: "backup restore export import" },
  { id: "notifications", labelKey: "notifications", keywords: "notifications quiet sound" },
  { id: "map", labelKey: "map", keywords: "map tiles offline provider" },
  { id: "sync", labelKey: "sync", keywords: "lan sync pair trusted" },
  { id: "advanced", labelKey: "advanced", keywords: "language reset testing" },
  { id: "about", labelKey: "about", keywords: "version license about" },
];
