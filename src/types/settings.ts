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
  | "mono-light"
  | "forest-night"
  | "midnight-ops"
  | "storm"
  | "aurora"
  | "sand"
  | "arctic";
export type Density = "comfortable" | "compact";
export type MotionPreference = "full" | "reduced" | "off";
export type AmbientPreference = "on" | "reduced" | "off";
export type MaterialPreference = "solid" | "frosted" | "glass";
export type DeviceTypeSetting = "desktop" | "laptop" | "tablet" | "phone" | "browser" | "other";

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

import type { ProfessionalRoleEntry } from "../features/network/authorization";

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
  material: MaterialPreference;
  /** Human-readable device label for the Device Center (local only). */
  deviceFriendlyName: string;
  /** Device type for the Device Center; null = auto-detect. */
  deviceType: DeviceTypeSetting | null;
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
  /** Professional roles held locally. Local = preview/pending only until a
   *  server verifies; see authorization.ts. */
  professionalRoles: ProfessionalRoleEntry[];
  /** Active role context among held roles (tailors dashboard/help/tours). */
  activeProfessionalRole: string | null;
  tourCompleted: boolean;
  /** Newcomer tour prompt dismissed ("maybe later") — dev.14. */
  tourPromptDismissed: boolean;
  /** Circular profile photo as a small data URL (dev.14). */
  profilePhoto: string | null;
  /** Decorative ring around the profile photo. */
  photoBorder: PhotoBorderStyle;
  language: string;
  /** When false, maps render local incident positions only — no tile downloads. */
  mapTilesEnabled: boolean;
  /** In-app notification preferences (delivery beyond in-app does not exist yet). */
  notifications: NotificationPreferences;
  /** Set when the user finishes the replayable first-run preview. */
  onboardingPreviewActive?: boolean;
  /** Developer-only: expose incomplete locales + the zz-ZZ pseudo-locale in pickers. */
  devPreviewLocales?: boolean;
}

export interface NotificationPreferences {
  inApp: boolean;
  /** Browser/PWA notifications — only offered where the API exists; no server push. */
  browser: boolean;
  /** dev.18: native system (Windows toast) delivery — desktop app only.
   *  Opt-in; never requested or enabled during first startup. */
  systemDelivery?: boolean;
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
  material: "frosted",
  displayName: "",
  defaultLocationPrecision: "approximate",
  includeContactsInShareable: false,
  lastBackupAt: null,
  country: "",
  units: "metric",
  savedReporterContact: null,
  professionalProfile: null,
  professionalRoles: [],
  activeProfessionalRole: null,
  tourCompleted: false,
  tourPromptDismissed: false,
  profilePhoto: null,
  photoBorder: "leaves" as PhotoBorderStyle,
  language: "en",
  mapTilesEnabled: true,
  notifications: DEFAULT_NOTIFICATION_PREFERENCES,
  onboardingPreviewActive: false,
  devPreviewLocales: false,
};

/** Decorative ring styles for the circular profile photo (dev.14). */
export type PhotoBorderStyle = "none" | "leaves" | "wood" | "rope" | "stars";

/** Versioned backup container.
 *  dev.18: optional `manifest` block adds integrity — per-record SHA-256
 *  hashes so restore can detect corruption instead of silently ignoring it.
 *  dev.19: manifest also covers attachments (attachmentHashes), so a corrupted
 *  photo/video is detected and refused, not silently imported.
 *  Legacy backups without a manifest remain importable (structural checks
 *  only). Media stays base64-embedded; export assembles the file in parts so
 *  multi-GB libraries don't need one giant string in memory. */
export interface BackupManifest {
  generatedBy: string;
  incidentCount: number;
  attachmentCount: number;
  /** SHA-256 (hex) of JSON.stringify(incident) per record id. */
  incidentHashes: Record<string, string>;
  /** dev.19: SHA-256 (hex) of the base64 payload per attachment id. */
  attachmentHashes?: Record<string, string>;
}

export interface BackupFormat {
  schemaVersion: number;
  applicationVersion: string;
  exportedAt: string;
  manifest?: BackupManifest;
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
  /** dev.18: records whose stored hash did not match (corrupted in transit
   *  or tampered). They are NOT imported. */
  corrupted: number;
  warnings: string[];
}
