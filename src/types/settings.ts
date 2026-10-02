import type { DetailLevel, ExperienceMode } from "./incident";

export type { DetailLevel, ExperienceMode };

export type ThemeName = "forest-dark" | "forest-light" | "midnight" | "warm-field";
export type Density = "comfortable" | "compact";
export type MotionPreference = "full" | "reduced" | "off";
export type AmbientPreference = "on" | "reduced" | "off";

export interface AppSettings {
  schemaVersion: number;
  onboarded: boolean;
  experienceMode: ExperienceMode;
  detailLevel: DetailLevel;
  theme: ThemeName;
  density: Density;
  motion: MotionPreference;
  ambient: AmbientPreference;
  /** Display name used as the default "actor" on new events. */
  displayName: string;
  defaultLocationPrecision: "exact" | "approximate" | "sensitive";
  includeContactsInShareable: boolean;
  lastBackupAt: string | null;
  country: string;
  units: "metric" | "imperial";
  savedReporterContact: { name: string; phone: string; email: string; preferred: string } | null;
  tourCompleted: boolean;
  language: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  schemaVersion: 1,
  onboarded: false,
  experienceMode: "general",
  detailLevel: "standard",
  theme: "forest-dark",
  density: "comfortable",
  motion: "full",
  ambient: "on",
  displayName: "",
  defaultLocationPrecision: "approximate",
  includeContactsInShareable: false,
  lastBackupAt: null,
  country: "",
  units: "metric",
  savedReporterContact: null,
  tourCompleted: false,
  language: "en",
};

/** Versioned backup container. */
export interface BackupFormat {
  schemaVersion: number;
  applicationVersion: string;
  exportedAt: string;
  incidents: unknown[];
  attachments: Array<{
    id: string;
    incidentId: string;
    fileName: string;
    mimeType: string;
    byteSize: number;
    data: string; // base64
  }>;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  attachmentCount: number;
  warnings: string[];
}
