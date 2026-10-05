import { getDb } from "./db";
import type { Incident } from "../types/incident";

/** All incident persistence goes through this repository. UI never touches raw IndexedDB. */

export async function putIncident(incident: Incident): Promise<void> {
  const db = await getDb();
  await db.put("incidents", incident);
}

export async function getIncident(id: string): Promise<Incident | undefined> {
  const db = await getDb();
  const inc = await db.get("incidents", id);
  // 0.3.0-dev.5 concern migration: legacy records are wildlife-animal incidents.
  return inc && inc.concernType == null ? { ...inc, concernType: "wildlife_animal" } : inc;
}

export async function getAllIncidents(): Promise<Incident[]> {
  const db = await getDb();
  const all = await db.getAll("incidents");
  // 0.3.0-dev.5 concern migration (spec 67/141): records without a concernType
  // migrate as "wildlife_animal" — no facts change, no record loss. The
  // normalization is written back once so the on-disk form converges.
  let migrated = false;
  const out = all.map((i) => {
    if (i.concernType == null) {
      migrated = true;
      return { ...i, concernType: "wildlife_animal" as const };
    }
    return i;
  });
  if (migrated && out.length > 0) {
    try {
      const tx = db.transaction("incidents", "readwrite");
      await Promise.all(out.map((i) => tx.store.put(i)));
      await tx.done;
    } catch {
      // Read-only contexts (e.g. backup import previews) still see the
      // normalized values; the write-back is an optimization, not required.
    }
  }
  return out;
}

export async function deleteIncidentRecord(id: string): Promise<void> {
  const db = await getDb();
  await db.delete("incidents", id);
}

export async function bulkPutIncidents(incidents: Incident[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction("incidents", "readwrite");
  await Promise.all(incidents.map((i) => tx.store.put(i)));
  await tx.done;
}

/** All attachment blobs for one incident. */
export async function getAttachmentsForIncident(incidentId: string) {
  const db = await getDb();
  return db.getAllFromIndex("attachments", "by-incident", incidentId);
}

export async function getAllAttachmentBlobs() {
  const db = await getDb();
  return db.getAll("attachments");
}

export async function putAttachmentBlob(blob: {
  id: string;
  incidentId: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
  data: Blob;
}): Promise<void> {
  const db = await getDb();
  await db.put("attachments", blob);
}

export async function getAttachmentBlob(id: string) {
  const db = await getDb();
  return db.get("attachments", id);
}

export async function deleteAttachmentBlob(id: string): Promise<void> {
  const db = await getDb();
  await db.delete("attachments", id);
}

export async function deleteAttachmentsForIncident(incidentId: string): Promise<void> {
  const blobs = await getAttachmentsForIncident(incidentId);
  const db = await getDb();
  const tx = db.transaction("attachments", "readwrite");
  await Promise.all(blobs.map((b) => tx.store.delete(b.id)));
  await tx.done;
}

// --- Settings (small key/value) ---

export async function getSetting<T>(key: string): Promise<T | undefined> {
  const db = await getDb();
  const rec = await db.get("settings", key);
  return rec?.value as T | undefined;
}

export async function setSetting<T>(key: string, value: T): Promise<void> {
  const db = await getDb();
  await db.put("settings", { key, value });
}

// --- Drafts (autosave) ---

export async function saveDraft(draft: { id: string; step: number; data: unknown; savedAt: string }): Promise<void> {
  const db = await getDb();
  await db.put("drafts", draft);
}

export async function getDraft(id: string) {
  const db = await getDb();
  return db.get("drafts", id);
}

export async function getAllDrafts() {
  const db = await getDb();
  return db.getAll("drafts");
}

export async function deleteDraft(id: string): Promise<void> {
  const db = await getDb();
  await db.delete("drafts", id);
}

// --- Storage health ---

export async function estimateStorage(): Promise<{ usage: number; quota: number } | null> {
  if (navigator.storage?.estimate) {
    const est = await navigator.storage.estimate();
    return { usage: est.usage ?? 0, quota: est.quota ?? 0 };
  }
  return null;
}
