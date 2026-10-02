import type { DetailLevel, ExperienceMode } from "./incident";

export type { DetailLevel, ExperienceMode };

export type ThemeName =
  | "forest-dark"
  | "forest-light"
  | "midnight"
  | "warm-field"
  | "moss"
  | "ocean"
  | "slate"
  | "high-contrast-dark"
  | "mono-dark"
  | "mono-light";
export type Density = "comfortable" | "compact";
export type MotionPreference = "full" | "reduced" | "off";
export type AmbientPreference = "on" | "reduced" | "off";

export type Workspace = "reporter" | "professional";

export interface ReporterContactProfile {
  name: string;
  phone: string;
  email: string;
  preferred: string;
  /** Optional organization affiliation (never shared automatically). */
  organization?: string;
  /** Optional professional/volunteer role, e.g. "Volunteer transport". */
  role?: string;
}

/** Local professional setup answers. These are convenience/labeling only —
 *  they NEVER grant authorization (see src/features/network/authorization.ts). */
export interface ProfessionalProfile {
  name: string;
  organization: string;
  role: string;
  workEmail: string;
  workPhone: string;
  /** Free-text service area description (city, county, region). */
  serviceArea: string;
}

export interface AppSettings {
  schemaVersion: number;
  onboarded: boolean;
  workspace: Workspace;
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
  savedReporterContact: ReporterContactProfile | null;
  /** Local professional setup answers (Professional Preview; not verification). */
  professionalProfile: ProfessionalProfile | null;
  tourCompleted: boolean;
  language: string;
  /** When false, maps render local incident positions only — no tile downloads. */
  mapTilesEnabled: boolean;
  /** In-app notification preferences (delivery beyond in-app does not exist yet). */
  notifications: NotificationPreferences;
  /** Set when the user finishes the replayable first-run preview. */
  onboardingPreviewActive?: boolean;
}

export interface NotificationPreferences {
  inApp: boolean;
  /** Browser/PWA notifications — only offered where the API exists; no server push. */
  browser: boolean;
  sound: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string; // "HH:MM"
  quietHoursEnd: string;
  categories: Record<string, boolean>;
}

export const DEFAULT_NOTIFICATION_CATEGORIES = [
  "status_changed",
  "responder_assigned",
  "information_requested",
  "handoff_recorded",
  "resolved",
  "draft_reminder",
  "backup_reminder",
  "new_in_service_area",
  "assignment",
  "unassigned_aging",
  "reporter_update",
  "handoff_waiting",
  "possible_duplicate",
] as const;

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  inApp: true,
  browser: false,
  sound: false,
  quietHoursEnabled: false,
  quietHoursStart: "22:00",
  quietHoursEnd: "07:00",
  categories: Object.fromEntries(DEFAULT_NOTIFICATION_CATEGORIES.map((c) => [c, true])),
};

export const DEFAULT_SETTINGS: AppSettings = {
  schemaVersion: 1,
  onboarded: false,
  workspace: "reporter",
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
  professionalProfile: null,
  tourCompleted: false,
  language: "en",
  mapTilesEnabled: true,
  notifications: DEFAULT_NOTIFICATION_PREFERENCES,
  onboardingPreviewActive: false,
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
