/**
 * Incident bookmarks (0.3.0-dev.6, Part VI).
 *
 * A star/bookmark is purely personal organizational metadata: it never
 * changes incident status, never syncs meaning to other devices beyond the
 * record itself, and never appears in shareable/public exports (exports are
 * explicit-field builders — this field is local-only). Persisted on the
 * incident record as `bookmarkedAt` so it survives restarts and backups.
 */
import type { Incident } from "../../types/incident";

export function isBookmarked(incident: Pick<Incident, "bookmarkedAt">): boolean {
  return incident.bookmarkedAt != null;
}

export function withBookmarkToggled(incident: Incident, now = new Date()): Incident {
  if (incident.bookmarkedAt != null) {
    return { ...incident, bookmarkedAt: null, updatedAt: incident.updatedAt };
  }
  return { ...incident, bookmarkedAt: now.toISOString(), updatedAt: incident.updatedAt };
}
