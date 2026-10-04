/**
 * Report Integrity (0.3, spec items 75–83) — protection against fake/spam/
 * malicious reports WITHOUT accusing anyone of lying.
 *
 * Contract:
 * - Signals are deterministic, heuristic REVIEW HINTS. They are never proof
 *   of fraud, never shown to reporters as accusations, and NEVER trigger
 *   automatic rejection, deletion or rate-limit rejection.
 * - Provenance is recorded honestly ("where the report came from") — not an
 *   identity claim.
 * - Professionals decide: keep, mark duplicate, block local source (with
 *   audit + unblock, never erasing previous reports), or dismiss the signal.
 * - No invasive browser/device fingerprinting: signals derive only from
 *   app-generated local data (timestamps, text, media hashes, LAN device
 *   identity the user already controls).
 * - Rate limiting is local burst protection only; it does NOT pretend to
 *   protect a wider network in offline/local mode.
 */
import type { Incident } from "../../types/incident";

export type IntegritySignalKey =
  | "possible_duplicate"
  | "rapid_repeat"
  | "repeated_text"
  | "reused_media"
  | "missing_contact"
  | "location_conflict"
  | "blocked_source";

export interface IntegrityReviewItem {
  incident: Incident;
  signals: Array<{ key: IntegritySignalKey; detail?: string }>;
}

export interface IntegrityReview {
  /** Reports with active signals, most-signalled first. */
  queue: IntegrityReviewItem[];
  /** Signal counts for the compact band. */
  counts: Record<string, number>;
}

export interface BlockedSource {
  /** App-generated local identifier (device fingerprint or profile key). */
  id: string;
  type: "device" | "profile";
  at: string;
  note?: string;
}

const RAPID_WINDOW_MS = 60 * 60_000;
const RAPID_COUNT = 3;

function normText(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

/** Local burst guard: counts submissions from this device in the last hour.
 *  Returns advisory info only — the report is still accepted. */
export function localBurstStatus(recentCreatedAt: string[], now = new Date()): { count: number; advisory: boolean } {
  const cutoff = now.getTime() - RAPID_WINDOW_MS;
  const count = recentCreatedAt.filter((t) => new Date(t).getTime() >= cutoff).length;
  return { count, advisory: count >= RAPID_COUNT };
}

/** Compute integrity review items across a live incident scope. */
export function computeIntegrityReview(
  incidents: Incident[],
  options: { duplicatePairs: Array<{ a: Incident; b: Incident }>; blockedSources?: BlockedSource[]; now?: Date }
): IntegrityReview {
  const { duplicatePairs, blockedSources = [] } = options;
  const blocked = new Set(blockedSources.map((b) => b.id));
  const counts: Record<string, number> = {};
  const byId = new Map(incidents.map((i) => [i.id, i]));

  // repeated identical text: same normalized description on 2+ live reports
  const textGroups = new Map<string, Incident[]>();
  for (const i of incidents) {
    const key = normText(i.animal.description || i.summary);
    if (key.length < 8) continue; // too generic to compare
    const group = textGroups.get(key) ?? [];
    group.push(i);
    textGroups.set(key, group);
  }
  const repeatedTextIds = new Set<string>();
  for (const group of textGroups.values()) {
    if (group.length > 1) group.forEach((i) => repeatedTextIds.add(i.id));
  }

  // reused media: identical attachment hash on 2+ live reports
  const hashGroups = new Map<string, Incident[]>();
  for (const i of incidents) {
    for (const att of i.attachments ?? []) {
      const h = (att as unknown as { sha256?: string; hash?: string }).sha256 ?? (att as unknown as { hash?: string }).hash;
      if (!h) continue;
      const group = hashGroups.get(h) ?? [];
      group.push(i);
      hashGroups.set(h, group);
    }
  }
  const reusedMediaIds = new Set<string>();
  for (const group of hashGroups.values()) {
    if (group.length > 1) group.forEach((i) => reusedMediaIds.add(i.id));
  }

  // rapid repeat: same-source reports created within the window (by provenance
  // bucket + createdVia; purely local data)
  const rapidIds = new Set<string>();
  const bySource = new Map<string, Incident[]>();
  for (const i of incidents) {
    const src = i.provenance ?? "unknown";
    const arr = bySource.get(src) ?? [];
    arr.push(i);
    bySource.set(src, arr);
  }
  for (const group of bySource.values()) {
    const sorted = [...group].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    for (let idx = 0; idx < sorted.length; idx++) {
      const window = sorted.filter(
        (o) =>
          Math.abs(new Date(o.createdAt).getTime() - new Date(sorted[idx]!.createdAt).getTime()) <= RAPID_WINDOW_MS
      );
      if (window.length >= RAPID_COUNT) window.forEach((o) => rapidIds.add(o.id));
    }
  }

  const dupByIncident = new Map<string, string[]>();
  for (const pair of duplicatePairs) {
    (dupByIncident.get(pair.a.id) ?? dupByIncident.set(pair.a.id, []).get(pair.a.id)!).push(pair.b.id);
    (dupByIncident.get(pair.b.id) ?? dupByIncident.set(pair.b.id, []).get(pair.b.id)!).push(pair.a.id);
  }

  const queue: IntegrityReviewItem[] = [];
  for (const inc of incidents) {
    const dismissed = new Set(inc.integrityDismissed ?? []);
    const signals: IntegrityReviewItem["signals"] = [];
    const push = (key: IntegritySignalKey, detail?: string) => {
      if (dismissed.has(key)) return;
      signals.push({ key, detail });
      counts[key] = (counts[key] ?? 0) + 1;
    };
    const dupPartners = dupByIncident.get(inc.id) ?? [];
    if (dupPartners.length > 0) {
      push("possible_duplicate", dupPartners.map((id) => byId.get(id)?.humanReference ?? id).join(", "));
    }
    if (rapidIds.has(inc.id)) push("rapid_repeat");
    if (repeatedTextIds.has(inc.id)) push("repeated_text");
    if (reusedMediaIds.has(inc.id)) push("reused_media");
    if (blocked.has(inc.provenance ?? "") || blocked.has(inc.id)) push("blocked_source");
    if (signals.length > 0) queue.push({ incident: inc, signals });
  }
  queue.sort((a, b) => b.signals.length - a.signals.length || a.incident.createdAt.localeCompare(b.incident.createdAt));
  return { queue: queue.slice(0, 25), counts };
}

/** Record a follow-up state (spec 82) — only when contact was provided. */
export function applyFollowUp(incident: Incident, followUp: Exclude<import("../../types/incident").ReporterFollowUp, null>): Incident {
  return { ...incident, followUp, updatedAt: new Date().toISOString() };
}

/** Dismiss a signal for one incident (professionals decided; auditable). */
export function dismissSignal(incident: Incident, key: IntegritySignalKey): Incident {
  return {
    ...incident,
    integrityDismissed: [...new Set([...(incident.integrityDismissed ?? []), key])],
    updatedAt: new Date().toISOString(),
  };
}

/** Block a local source identifier with audit fields; previous reports are
 *  never erased (spec 81). Unblock removes the entry entirely. */
export function blockSource(sources: BlockedSource[], id: string, type: BlockedSource["type"], note?: string, now = new Date()): BlockedSource[] {
  if (sources.some((s) => s.id === id)) return sources;
  return [...sources, { id, type, at: now.toISOString(), note }];
}

export function unblockSource(sources: BlockedSource[], id: string): BlockedSource[] {
  return sources.filter((s) => s.id !== id);
}
