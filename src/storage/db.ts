/**
 * IndexedDB database bootstrap and migrations.
 * Stores: incidents, attachments (blobs kept separate from records),
 * drafts (autosave), and a small key/value store for settings.
 */
import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Incident } from "../types/incident";
import type { AppSettings } from "../types/settings";

export interface AttachmentBlob {
  id: string;
  incidentId: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
  data: Blob;
}

export interface DraftRecord {
  id: string;
  step: number;
  data: unknown;
  savedAt: string;
}

interface WihDB extends DBSchema {
  incidents: { key: string; value: Incident; indexes: { "by-updatedAt": string; "by-status": string } };
  attachments: { key: string; value: AttachmentBlob; indexes: { "by-incident": string } };
  drafts: { key: string; value: DraftRecord };
  settings: { key: string; value: { key: string; value: unknown } };
}

const DB_NAME = "wildlife-incident-handoff";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<WihDB>> | null = null;

export function getDb(): Promise<IDBPDatabase<WihDB>> {
  if (!dbPromise) {
    dbPromise = openDB<WihDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Version 1: initial schema.
        if (!db.objectStoreNames.contains("incidents")) {
          const incidents = db.createObjectStore("incidents", { keyPath: "id" });
          incidents.createIndex("by-updatedAt", "updatedAt");
          incidents.createIndex("by-status", "status");
        }
        if (!db.objectStoreNames.contains("attachments")) {
          const attachments = db.createObjectStore("attachments", { keyPath: "id" });
          attachments.createIndex("by-incident", "incidentId");
        }
        if (!db.objectStoreNames.contains("drafts")) {
          db.createObjectStore("drafts", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("settings")) {
          db.createObjectStore("settings", { keyPath: "key" });
        }
      },
    });
  }
  return dbPromise;
}

export type { WihDB };
export type { AppSettings, Incident };
