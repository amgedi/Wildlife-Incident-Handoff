/** Local notification center store. All notifications are generated locally
 *  from real app events — there is no server push and no fake activity. */
import { getDb, type NotificationRecord } from "./db";
import { uuid as newId } from "../utils/id";
const MAX_NOTIFICATIONS = 200;

export interface NotificationDraft {
  category: string;
  title: string;
  body: string;
  incidentId?: string | null;
}

export async function recordNotification(draft: NotificationDraft): Promise<NotificationRecord> {
  const db = await getDb();
  const record: NotificationRecord = {
    id: newId(),
    createdAt: new Date().toISOString(),
    category: draft.category,
    title: draft.title,
    body: draft.body,
    incidentId: draft.incidentId ?? null,
    read: false,
  };
  await db.put("notifications", record);
  await trimNotifications(db);
  return record;
}

async function trimNotifications(db: Awaited<ReturnType<typeof getDb>>): Promise<void> {
  const all = await db.getAllFromIndex("notifications", "by-createdAt");
  if (all.length <= MAX_NOTIFICATIONS) return;
  const excess = all.slice(0, all.length - MAX_NOTIFICATIONS);
  await Promise.all(excess.map((n) => db.delete("notifications", n.id)));
}

export async function listNotifications(): Promise<NotificationRecord[]> {
  const db = await getDb();
  const all = await db.getAllFromIndex("notifications", "by-createdAt");
  return all.reverse();
}

export async function unreadNotificationCount(): Promise<number> {
  const all = await listNotifications();
  return all.filter((n) => !n.read).length;
}

export async function markNotificationRead(id: string): Promise<void> {
  const db = await getDb();
  const record = await db.get("notifications", id);
  if (record && !record.read) {
    await db.put("notifications", { ...record, read: true });
  }
}

export async function markAllNotificationsRead(): Promise<void> {
  const db = await getDb();
  const all = await db.getAll("notifications");
  await Promise.all(all.filter((n) => !n.read).map((n) => db.put("notifications", { ...n, read: true })));
}

export async function clearNotifications(): Promise<void> {
  const db = await getDb();
  await db.clear("notifications");
}

/** Quiet-hours check (local time). Returns true when notifications should be silent. */
export function isQuietHours(start: string, end: string, now = new Date()): boolean {
  const toMinutes = (s: string): number | null => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
    if (!m) return null;
    return Number(m[1]) * 60 + Number(m[2]);
  };
  const startMin = toMinutes(start);
  const endMin = toMinutes(end);
  if (startMin === null || endMin === null || startMin === endMin) return false;
  const cur = now.getHours() * 60 + now.getMinutes();
  if (startMin < endMin) return cur >= startMin && cur < endMin;
  return cur >= startMin || cur < endMin;
}
