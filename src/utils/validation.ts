/**
 * Validation for imported backups and structurally critical fields.
 * We validate identity/structure, NOT optional "unknown" scientific content.
 */
import { SCHEMA_VERSION } from "../types/incident";
import type { BackupFormat, BackupManifest, ImportResult } from "../types/settings";

export interface ValidationIssue {
  code: string;
  message: string;
}

export function validateBackup(raw: unknown): { issues: ValidationIssue[]; backup: BackupFormat | null } {
  const issues: ValidationIssue[] = [];
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return { issues: [{ code: "not_object", message: "This file is not a valid Wildlife Incident Handoff backup." }], backup: null };
  }
  const obj = raw as Record<string, unknown>;
  if (typeof obj.schemaVersion !== "number") {
    issues.push({ code: "missing_schema_version", message: "The backup is missing its data-format version." });
  } else if (obj.schemaVersion > SCHEMA_VERSION) {
    issues.push({ code: "newer_schema", message: `This backup was made by a newer version of the app (data format v${obj.schemaVersion}). Please update Wildlife Incident Handoff first.` });
  }
  if (typeof obj.exportedAt !== "string") {
    issues.push({ code: "missing_exported_at", message: "The backup is missing its export date." });
  }
  if (!Array.isArray(obj.incidents)) {
    issues.push({ code: "missing_incidents", message: "The backup does not contain an incident list." });
  }
  if (issues.length > 0) return { issues, backup: null };
  return { issues: [], backup: raw as BackupFormat };
}

const REQUIRED_INCIDENT_FIELDS = ["id", "humanReference", "createdAt", "updatedAt"] as const;

export function validateIncidentRecord(raw: unknown): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return [{ code: "not_object", message: "Incident record is malformed." }];
  }
  const inc = raw as Record<string, unknown>;
  for (const field of REQUIRED_INCIDENT_FIELDS) {
    if (typeof inc[field] !== "string" || (inc[field] as string).length === 0) {
      issues.push({ code: "missing_field", message: `Incident record is missing "${field}".` });
    }
  }
  if (Array.isArray(inc.timeline)) {
    for (const ev of inc.timeline as unknown[]) {
      const e = ev as Record<string, unknown>;
      if (!e || typeof e.eventId !== "string" || typeof e.eventType !== "string" || typeof e.timestamp !== "string") {
        issues.push({ code: "bad_event", message: "A timeline event in this incident is malformed." });
        break;
      }
    }
  }
  if (inc.location !== null && typeof inc.location === "object" && !Array.isArray(inc.location)) {
    const loc = inc.location as Record<string, unknown>;
    const lat = Number(loc.latitude);
    const lon = Number(loc.longitude);
    if (loc.latitude != null && (!Number.isFinite(lat) || lat < -90 || lat > 90)) {
      issues.push({ code: "bad_coordinate", message: "A latitude value is outside the valid range (-90 to 90)." });
    }
    if (loc.longitude != null && (!Number.isFinite(lon) || lon < -180 || lon > 180)) {
      issues.push({ code: "bad_coordinate", message: "A longitude value is outside the valid range (-180 to 180)." });
    }
  }
  return issues;
}

export function emptyImportResult(): ImportResult {
  return { imported: 0, skipped: 0, attachmentCount: 0, corrupted: 0, warnings: [] };
}

/** dev.18: parse/validate an optional manifest block. Returns null for
 *  legacy backups (no manifest) — they stay importable. */
export function validateBackupManifest(raw: unknown): { manifest: BackupManifest | null; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return { manifest: null, issues };
  const obj = raw as Record<string, unknown>;
  const m = obj.manifest;
  if (m == null) return { manifest: null, issues };
  if (typeof m !== "object" || Array.isArray(m)) {
    issues.push({ code: "bad_manifest", message: "The backup manifest is malformed." });
    return { manifest: null, issues };
  }
  const mm = m as Record<string, unknown>;
  if (typeof mm.incidentCount !== "number" || typeof mm.incidentHashes !== "object" || mm.incidentHashes === null || Array.isArray(mm.incidentHashes)) {
    issues.push({ code: "bad_manifest", message: "The backup manifest is malformed." });
    return { manifest: null, issues };
  }
  return { manifest: m as unknown as BackupManifest, issues };
}

/** SHA-256 hex of a string via WebCrypto (secure contexts incl. Tauri). */
export async function sha256Hex(text: string): Promise<string | null> {
  try {
    const subtle = globalThis.crypto?.subtle;
    if (!subtle) return null;
    const buf = await subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return null;
  }
}
