/** Factory reset: delete ALL local application data (incidents, attachments,
 *  drafts, settings, notifications). Called only from a deliberate, warned,
 *  confirmed flow in Settings → Advanced → Reset & testing. */
import { getDb } from "./db";

export async function factoryReset(): Promise<void> {
  const db = await getDb();
  await Promise.all([
    db.clear("incidents"),
    db.clear("attachments"),
    db.clear("drafts"),
    db.clear("settings"),
    db.clear("notifications"),
  ]);
  // Reload so every in-memory cache restarts from a clean slate and onboarding runs.
  window.location.reload();
}
