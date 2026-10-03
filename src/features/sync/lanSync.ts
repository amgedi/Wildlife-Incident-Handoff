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
import { getAllIncidents, putIncident, getSetting, setSetting } from "../../storage/repositories";
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


export const SYNC_CONFLICTS_KEY = "sync-conflicts";
export const SYNC_PEER_STATE_KEY = "lan-sync-peer-state";

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

// ---- v2 (0.2.0-dev.15): device identity, ack-based three-way merge, tombstones, conflicts ----

export interface SyncPeerState {
  deviceId?: string;
  name?: string;
  trusted: boolean;
  lastSyncAt?: string;
  /** incidentId -> updatedAt at the last successful exchange with this peer (common ancestor). */
  ack: Record<string, string>;
}

export type SyncPeerStates = Record<string, SyncPeerState>;

export interface SyncConflict {
  id: string;
  incidentId: string;
  reference: string;
  local: Incident;
  incoming: Incident;
  peerName: string;
  peerDeviceId: string;
  at: string;
}

export interface MergeResultV2 {
  merged: Incident[];
  added: number;
  updated: number;
  skipped: number;
  tombstoned: number;
  conflicts: SyncConflict[];
  ack: Record<string, string>;
}

/** Accept the peer's record while preserving local-only timeline events
 *  (append-only history can never lose an event). Used on accept and when a
 *  conflict is resolved as "theirs". */
export function acceptPeerWithUnion(local: Incident, incoming: Incident, peer: { deviceId?: string; name?: string }): Incident {
  const stamped = stampSyncSource(incoming, peer);
  const localOnlyEvents = local.timeline.filter((e) => !stamped.timeline.some((x) => x.eventId === e.eventId));
  if (localOnlyEvents.length === 0) return stamped;
  return { ...stamped, timeline: [...stamped.timeline, ...localOnlyEvents].sort((a, b) => a.timestamp.localeCompare(b.timestamp)) };
}

function stampSyncSource(inc: Incident, peer: { deviceId?: string; name?: string }): Incident {
  return {
    ...inc,
    syncSource: { deviceId: peer.deviceId ?? "unknown", name: peer.name ?? "Unknown device", at: new Date().toISOString() },
  };
}

/**
 * Ack-based three-way merge. Both-changed -> CONFLICT (queued for human
 * resolution; the local record is never silently overwritten, regardless of
 * clock). Only-peer-changed -> accept, tombstones included, with a timeline
 * UNION by eventId so append-only history never loses an event.
 * Only-local-changed -> keep ours. Demo records never sync.
 */
export function mergeIncidentsV2(
  local: Incident[],
  incoming: Incident[],
  ack: Record<string, string>,
  peer: { deviceId?: string; name?: string },
  now = new Date().toISOString()
): MergeResultV2 {
  const conflicts: SyncConflict[] = [];
  const nextAck: Record<string, string> = { ...ack };
  const byId = new Map(local.map((i) => [i.id, i]));
  const merged = [...local];
  let added = 0, updated = 0, skipped = 0, tombstoned = 0;

  for (const candidate of incoming) {
    if (candidate.isDemo || !candidate?.id) { skipped += 1; continue; }
    const existing = byId.get(candidate.id);
    if (!existing) {
      const stamped = stampSyncSource(candidate, peer);
      merged.push(stamped);
      byId.set(candidate.id, stamped);
      nextAck[candidate.id] = stamped.updatedAt ?? "";
      added += 1;
      if (candidate.deletedAt) tombstoned += 1;
      continue;
    }
    const ackAt = ack[candidate.id];
    const peerChanged = candidate.updatedAt !== ackAt;
    const localChanged = existing.updatedAt !== ackAt;

    if (!peerChanged) {
      nextAck[candidate.id] = existing.updatedAt ?? "";
      skipped += 1;
      continue;
    }
    if (!localChanged) {
      const stamped = acceptPeerWithUnion(existing, candidate, peer);
      const idx = merged.findIndex((i) => i.id === candidate.id);
      if (idx >= 0) merged[idx] = stamped;
      nextAck[candidate.id] = candidate.updatedAt ?? "";
      updated += 1;
      if (candidate.deletedAt && !existing.deletedAt) tombstoned += 1;
      continue;
    }
    if (candidate.deletedAt && existing.deletedAt) {
      nextAck[candidate.id] = candidate.updatedAt ?? "";
      skipped += 1;
      continue;
    }
    conflicts.push({
      id: "conflict-" + candidate.id + "-" + now,
      incidentId: candidate.id,
      reference: existing.humanReference,
      local: existing,
      incoming: candidate,
      peerName: peer.name ?? "Unknown device",
      peerDeviceId: peer.deviceId ?? "unknown",
      at: now,
    });
    skipped += 1;
  }
  return { merged, added, updated, skipped, tombstoned, conflicts, ack: nextAck };
}

/** Extract the peer's device display name from a snapshot payload. */
export function deviceNameFromPayload(payload: string): string | null {
  try {
    const parsed = JSON.parse(payload) as { deviceName?: string };
    return typeof parsed.deviceName === "string" && parsed.deviceName.trim() ? parsed.deviceName.trim() : null;
  } catch {
    return null;
  }
}

/** Persistent device identity: generated once, stored in app settings. */
export async function ensureDeviceIdentity(): Promise<{ deviceId: string; deviceLabel: string }> {
  const settings = (await getSetting<Record<string, unknown>>("app-settings")) ?? {};
  let deviceId = (settings.deviceId as string) ?? "";
  if (!deviceId) {
    deviceId = crypto.randomUUID?.() ?? ("dev-" + Date.now() + "-" + Math.random().toString(36).slice(2));
    settings.deviceId = deviceId;
    await setSetting("app-settings", settings);
  }
  return { deviceId, deviceLabel: (settings.deviceLabel as string) ?? "" };
}

export async function lanSetTrusted(deviceIds: string[]): Promise<void> {
  await invoke("lan_sync_set_trusted", { deviceIds });
}
export async function lanSetPairingCode(code: string): Promise<void> {
  await invoke("lan_sync_set_pairing_code", { code });
}
export async function lanTakePairRequests(): Promise<string[]> {
  return invoke<string[]>("lan_sync_take_pair_requests");
}
export async function lanPairPeer(url: string, deviceId: string, name: string, code: string): Promise<void> {
  await invoke("lan_sync_pair_peer", { url, deviceId, name, code });
}

export interface SyncRoundResult {
  added: number;
  updated: number;
  tombstoned: number;
  conflicts: number;
  peersUp: number;
}

/**
 * One sync round (v2): snapshot -> pull+push each peer using the ack-based
 * merge; conflicts are persisted for human review, never auto-resolved.
 */
export async function runSyncRound(
  config: LanSyncConfig,
  deviceName: string,
  deviceId: string,
  onLog: (line: string) => void
): Promise<SyncRoundResult> {
  const local = (await getAllIncidents()).filter((i) => !i.isDemo);
  const snapshot = snapshotFrom(local, deviceName);
  await lanSetSnapshot(snapshot);

  const peerStates = ((await getSetting<SyncPeerStates>(SYNC_PEER_STATE_KEY)) ?? {}) as SyncPeerStates;
  let added = 0, updated = 0, tombstoned = 0, conflicts = 0, peersUp = 0;

  for (const raw of config.peers) {
    const peer = peerStates[raw] ?? { trusted: true, ack: {} };
    if (peer.trusted === false) continue;
    const up = await lanPingPeer(raw);
    if (!up) { onLog("peer unreachable: " + raw); continue; }
    peersUp += 1;
    try {
      const payload = await lanFetchSnapshot(raw, deviceId);
      const peerName = deviceNameFromPayload(payload) ?? peer.name ?? raw.replace(/^https?:\/\/[^:]+/, "").split(":")[0] ?? "Device";
      const incoming = incidentsFromPayload(payload);
      const result = mergeIncidentsV2(local, incoming, peer.ack ?? {}, { deviceId: peer.deviceId, name: peerName });
      for (const inc of result.merged) {
        const unchanged = local.some((i) => i.id === inc.id && i.updatedAt === inc.updatedAt);
        if (!unchanged) await putIncident(inc);
      }
      added += result.added; updated += result.updated; tombstoned += result.tombstoned;
      if (result.conflicts.length > 0) {
        conflicts += result.conflicts.length;
        const existingConflicts = (await getSetting<SyncConflict[]>(SYNC_CONFLICTS_KEY)) ?? [];
        await setSetting(SYNC_CONFLICTS_KEY, [...existingConflicts, ...result.conflicts].slice(-50));
      }
      peerStates[raw] = { ...peer, deviceId: peer.deviceId, name: peerName, trusted: true, lastSyncAt: new Date().toISOString(), ack: result.ack };
      await lanPushPeer(raw, deviceId, snapshot);
      onLog("synced with " + peerName + " (+" + result.added + " new, ~" + result.updated + " updated, " + result.tombstoned + " removed, " + result.conflicts.length + " conflicts)");
    } catch (e) {
      onLog("sync with " + raw + " failed: " + String(e).slice(0, 80));
    }
  }
  await setSetting(SYNC_PEER_STATE_KEY, peerStates);
  return { added, updated, tombstoned, conflicts, peersUp };
}

/** Build the device snapshot: every non-demo incident as plain JSON, with an
 *  optional device display name (used by the local reporter leaderboard). */
export function snapshotFrom(incidents: Incident[], deviceName?: string): string {
  return JSON.stringify({
    app: "wildlife-incident-handoff/1",
    deviceName: deviceName || undefined,
    incidents: incidents.filter((i) => !i.isDemo),
  });
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

/** Peer device display name from a snapshot payload, if provided. */

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

export async function lanFetchSnapshot(url: string, deviceId: string): Promise<string> {
  return invoke<string>("lan_sync_fetch_peer", { url, deviceId });
}

export async function lanPullPeer(url: string): Promise<Incident[]> {
  const payload = await invoke<string>("lan_sync_fetch_peer", { url });
  return incidentsFromPayload(payload);
}

export async function lanPushPeer(url: string, deviceId: string, snapshot: string): Promise<void> {
  await invoke("lan_sync_push_peer", { url, deviceId, body: snapshot });
}

export async function lanLocalAddress(port: number): Promise<string> {
  return invoke<string>("lan_sync_local_address", { port });
}

/** One sync round: refresh snapshot, drain inbox, pull+push each peer. */

