/**
 * LAN sync (0.2.0-dev.13) — optional local-network incident exchange.
 *
 * Desktop (Tauri) only: each device runs a tiny HTTP server (Rust side);
 * the frontend pushes its snapshot, drains the inbox, and pulls/pushes to
 * configured peer addresses. Nothing leaves the local network; there is no
 * internet relay and no cloud.
 *
 * Merge policy (pure, testable): records are matched by id; last writer
 * wins on `updatedAt`; demo records never sync. Media (attachment blobs)
 * is NOT synced yet — metadata travels, files stay local (honest v1).
 */
import { getAllIncidents, putIncident } from "../../storage/repositories";
import type { Incident } from "../../types/incident";

export const LAN_SYNC_DEFAULT_PORT = 47618;

export interface LanSyncConfig {
  enabled: boolean;
  port: number;
  peers: string[];
}

export const DEFAULT_LAN_SYNC_CONFIG: LanSyncConfig = {
  enabled: false,
  port: LAN_SYNC_DEFAULT_PORT,
  peers: [],
};

export interface MergeResult {
  merged: Incident[];
  added: number;
  updated: number;
  skipped: number;
}

/** Last-writer-wins merge by updatedAt, matched by id. Demo records never sync. */
export function mergeIncidents(local: Incident[], incoming: Incident[]): MergeResult {
  let added = 0;
  let updated = 0;
  let skipped = 0;
  const byId = new Map(local.map((i) => [i.id, i]));
  const merged = [...local];
  for (const candidate of incoming) {
    if (candidate.isDemo || !candidate?.id) {
      skipped += 1;
      continue;
    }
    const existing = byId.get(candidate.id);
    if (!existing) {
      merged.push(candidate);
      byId.set(candidate.id, candidate);
      added += 1;
      continue;
    }
    const incomingAt = candidate.updatedAt ?? candidate.createdAt ?? "";
    const existingAt = existing.updatedAt ?? existing.createdAt ?? "";
    if (incomingAt > existingAt) {
      const idx = merged.findIndex((i) => i.id === candidate.id);
      if (idx >= 0) merged[idx] = candidate;
      updated += 1;
    } else {
      skipped += 1;
    }
  }
  return { merged, added, updated, skipped };
}

/** Build the device snapshot: every non-demo incident as plain JSON. */
export function snapshotFrom(incidents: Incident[]): string {
  return JSON.stringify({ app: "wildlife-incident-handoff/1", incidents: incidents.filter((i) => !i.isDemo) });
}

/** Extract records from a peer snapshot payload; tolerant of shape drift. */
export function incidentsFromPayload(payload: string): Incident[] {
  try {
    const parsed = JSON.parse(payload) as { incidents?: Incident[] } | Incident[];
    if (Array.isArray(parsed)) return parsed;
    return Array.isArray(parsed.incidents) ? parsed.incidents : [];
  } catch {
    return [];
  }
}

// ---- Tauri bridge (browser builds never import the Rust side) -------------

function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  // Lazy + isolated so the web/PWA build never breaks on this module.
  return import("@tauri-apps/api/core").then((core) => core.invoke<T>(cmd, args));
}

export const lanSyncSupported = (): boolean =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in (window as unknown as Record<string, unknown>);

export async function lanStart(port: number): Promise<void> {
  await invoke("lan_sync_start", { port });
}

export async function lanStop(): Promise<void> {
  await invoke("lan_sync_stop");
}

export async function lanSetSnapshot(snapshot: string): Promise<void> {
  await invoke("lan_sync_set_snapshot", { snapshot });
}

export async function lanTakeInbox(): Promise<string[]> {
  return invoke<string[]>("lan_sync_take_inbox");
}

export async function lanPingPeer(url: string): Promise<boolean> {
  try {
    await invoke("lan_sync_ping_peer", { url });
    return true;
  } catch {
    return false;
  }
}

export async function lanPullPeer(url: string): Promise<Incident[]> {
  const payload = await invoke<string>("lan_sync_fetch_peer", { url });
  return incidentsFromPayload(payload);
}

export async function lanPushPeer(url: string, snapshot: string): Promise<void> {
  await invoke("lan_sync_push_peer", { url, body: snapshot });
}

export async function lanLocalAddress(port: number): Promise<string> {
  return invoke<string>("lan_sync_local_address", { port });
}

/** One sync round: refresh snapshot, drain inbox, pull+push each peer. */
export async function runSyncRound(
  config: LanSyncConfig,
  log: (line: string) => void
): Promise<{ added: number; updated: number; peersUp: number }> {
  const local = (await getAllIncidents()).filter((i) => !i.isDemo && !i.deletedAt);
  const snapshot = snapshotFrom(local);
  await lanSetSnapshot(snapshot);

  let added = 0;
  let updated = 0;
  let peersUp = 0;

  // Records peers pushed to us.
  const inbox = await lanTakeInbox();
  for (const payload of inbox) {
    const r = await applyIncoming(local, payload, log);
    added += r.added;
    updated += r.updated;
  }

  // Pull + push each configured peer.
  for (const peer of config.peers) {
    const up = await lanPingPeer(peer);
    if (!up) {
      log(`peer unreachable: ${peer}`);
      continue;
    }
    peersUp += 1;
    try {
      const incoming = await lanPullPeer(peer);
      const r = await applyIncoming(local, JSON.stringify({ incidents: incoming }), log);
      added += r.added;
      updated += r.updated;
      await lanPushPeer(peer, snapshot);
      log(`synced with ${peer} (+${r.added} new, ~${r.updated} updated)`);
    } catch (e) {
      log(`sync with ${peer} failed: ${String(e).slice(0, 80)}`);
    }
  }
  return { added, updated, peersUp };
}

async function applyIncoming(local: Incident[], payload: string, log: (line: string) => void): Promise<{ added: number; updated: number }> {
  const incoming = incidentsFromPayload(payload);
  const result = mergeIncidents(local, incoming);
  for (const inc of result.merged) {
    const wasLocal = local.some((i) => i.id === inc.id && i.updatedAt === inc.updatedAt);
    if (!wasLocal) await putIncident(inc);
  }
  if (result.added > 0 || result.updated > 0) {
    log(`merged +${result.added} new, ~${result.updated} updated (${result.skipped} unchanged)`);
  }
  return { added: result.added, updated: result.updated };
}
