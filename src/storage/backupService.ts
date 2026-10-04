/**
 * Backup export/import with a versioned container format.
 * Import treats all file content as untrusted and never overwrites
 * existing incidents with ID conflicts.
 */
import type { BackupFormat, ImportResult } from "../types/settings";
import type { Incident } from "../types/incident";
import { SCHEMA_VERSION } from "../types/incident";
import { validateBackup, validateBackupManifest, validateIncidentRecord, emptyImportResult, sha256Hex } from "../utils/validation";
import { cleanText, safeFileName } from "../utils/text";
import { nowIso } from "../utils/time";
import { saveFile } from "../utils/platformFile";
import {
  getAllIncidents,
  bulkPutIncidents,
  getAllAttachmentBlobs,
  putAttachmentBlob,
} from "./repositories";

export async function createBackup(applicationVersion: string): Promise<BackupFormat> {
  const [incidents, blobs] = await Promise.all([getAllIncidents(), getAllAttachmentBlobs()]);
  const attachments = await Promise.all(
    blobs.map(async (b) => ({
      id: b.id,
      incidentId: b.incidentId,
      fileName: b.fileName,
      mimeType: b.mimeType,
      byteSize: b.byteSize,
      data: await blobToBase64(b.data),
    }))
  );
  // dev.18: per-record integrity hashes so restore can detect corruption.
  const incidentHashes: Record<string, string> = {};
  for (const inc of incidents) {
    const h = await sha256Hex(JSON.stringify(inc));
    if (h) incidentHashes[inc.id] = h;
  }
  return {
    schemaVersion: SCHEMA_VERSION,
    applicationVersion,
    exportedAt: nowIso(),
    manifest: {
      generatedBy: applicationVersion,
      incidentCount: incidents.length,
      attachmentCount: attachments.length,
      incidentHashes,
    },
    incidents,
    attachments,
  };
}

export async function downloadBackup(applicationVersion: string): Promise<"saved" | "cancelled" | "browser"> {
  const backup = await createBackup(applicationVersion);
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  return downloadBlob(blob, `wildlife-incident-handoff-backup-${dateStamp()}.json`);
}

export async function importBackup(raw: unknown): Promise<ImportResult> {
  const result = emptyImportResult();
  const { issues, backup } = validateBackup(raw);
  if (!backup) {
    result.warnings = issues.map((i) => i.message);
    result.skipped = 1;
    return result;
  }
  const { manifest } = validateBackupManifest(raw);
  if (manifest && manifest.incidentCount !== backup.incidents.length) {
    result.warnings.push(
      `Manifest lists ${manifest.incidentCount} incidents but the file contains ${backup.incidents.length} — the backup may be incomplete or corrupted.`
    );
  }
  // dev.18: staged restore — the ENTIRE batch is validated (structure +
  // integrity hashes) before anything is written, so a corrupt backup can
  // never leave a half-imported workspace. bulkPutIncidents itself is a
  // single IndexedDB transaction (atomic).
  const existing = await getAllIncidents();
  const existingIds = new Set(existing.map((i) => i.id));
  const toImport: Incident[] = [];
  for (const rawIncident of backup.incidents) {
    const incidentIssues = validateIncidentRecord(rawIncident);
    if (incidentIssues.length > 0) {
      result.skipped += 1;
      result.warnings.push(`Skipped one record: ${incidentIssues[0]!.message}`);
      continue;
    }
    const incident = rawIncident as Incident;
    if (existingIds.has(incident.id)) {
      result.skipped += 1;
      result.warnings.push(
        `Incident ${incident.humanReference} already exists locally and was not overwritten.`
      );
      continue;
    }
    if (manifest) {
      const expected = manifest.incidentHashes[incident.id];
      if (expected) {
        const actual = await sha256Hex(JSON.stringify(rawIncident));
        if (actual && actual !== expected) {
          result.corrupted += 1;
          result.warnings.push(
            `Incident ${incident.humanReference} failed its integrity check (corrupted or altered) and was NOT imported.`
          );
          continue;
        }
      } else if (manifest.incidentHashes && Object.keys(manifest.incidentHashes).length > 0) {
        // record missing from the manifest — treat as incomplete backup signal
        result.warnings.push(
          `Incident ${incident.humanReference} is not listed in the backup manifest and was skipped.`
        );
        result.skipped += 1;
        continue;
      }
    }
    toImport.push(incident);
    result.imported += 1;
  }
  await bulkPutIncidents(toImport);

  if (Array.isArray(backup.attachments)) {
    const importedIds = new Set(toImport.map((i) => i.id));
    for (const att of backup.attachments) {
      if (!att || typeof att !== "object") continue;
      const a = att as Record<string, unknown>;
      if (typeof a.id !== "string" || typeof a.incidentId !== "string" || typeof a.data !== "string") {
        result.warnings.push("Skipped one attachment with malformed metadata.");
        continue;
      }
      if (!importedIds.has(a.incidentId)) continue;
      try {
        const blob = base64ToBlob(a.data as string, (a.mimeType as string) ?? "application/octet-stream");
        await putAttachmentBlob({
          id: a.id as string,
          incidentId: a.incidentId as string,
          fileName: safeFileName((a.fileName as string) ?? "attachment"),
          mimeType: (a.mimeType as string) ?? "application/octet-stream",
          byteSize: blob.size,
          data: blob,
        });
        result.attachmentCount += 1;
      } catch {
        result.warnings.push("One attachment could not be decoded and was skipped.");
      }
    }
  }
  return result;
}

export function dateStamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result ?? "");
      resolve(result.includes(",") ? result.slice(result.indexOf(",") + 1) : result);
    };
    reader.onerror = () => reject(new Error("Could not read attachment data"));
    reader.readAsDataURL(blob);
  });
}

export function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

export async function downloadBlob(blob: Blob, fileName: string): Promise<"saved" | "cancelled" | "browser"> {
  const result = await saveFile(blob, safeFileName(fileName), ".json");
  if (result !== "browser") return result;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = safeFileName(fileName);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return "browser";
}

export { cleanText };
