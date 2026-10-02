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

/** Locally-generated notification (notification center). Never server push. */
export interface NotificationRecord {
  id: string;
  createdAt: string;
  category: string;
  title: string;
  body: string;
  incidentId: string | null;
  read: boolean;
}

interface WihDB extends DBSchema {
  incidents: { key: string; value: Incident; indexes: { "by-updatedAt": string; "by-status": string } };
  attachments: { key: string; value: AttachmentBlob; indexes: { "by-incident": string } };
  drafts: { key: string; value: DraftRecord };
  settings: { key: string; value: { key: string; value: unknown } };
  notifications: { key: string; value: NotificationRecord; indexes: { "by-createdAt": string } };
}

const DB_NAME = "wildlife-incident-handoff";
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase<WihDB>> | null = null;

/** Test-only: close and forget the cached connection so a fresh IDB can be used. */
export async function resetDbForTests(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise;
    db.close();
    dbPromise = null;
  }
}

export function getDb(): Promise<IDBPDatabase<WihDB>> {
  if (!dbPromise) {
    dbPromise = openDB<WihDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
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
        // Version 2: notification center.
        if (oldVersion < 2 && !db.objectStoreNames.contains("notifications")) {
          const notifications = db.createObjectStore("notifications", { keyPath: "id" });
          notifications.createIndex("by-createdAt", "createdAt");
        }
      },
    });
  }
  return dbPromise;
}

export type { WihDB };
export type { AppSettings, Incident };
