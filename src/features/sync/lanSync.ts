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
/** dev.19: content-aware record version. Acks compare VERSIONS, not raw
 *  updatedAt timestamps — two different edits can share a timestamp (Windows
 *  clock granularity is ~15 ms), and a timestamp-only ack then mistakes
 *  "peer has my version" for "peer made a different edit". The version is a
 *  deterministic hash of the record with per-device sync stamps excluded
 *  (syncSource differs on every device by design). Not a security control —
 *  change detection only. "v3:" prefix distinguishes from legacy acks. */
const VERSION_PREFIX = "v3:";
export function recordVersion(inc: Incident): string {
  const { syncSource: _syncSource, ...core } = inc;
  const json = JSON.stringify(core);
  // FNV-1a 32-bit over the canonical JSON + length (cheap, deterministic).
  let h = 0x811c9dc5;
  for (let i = 0; i < json.length; i++) {
    h ^= json.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return VERSION_PREFIX + (h >>> 0).toString(16) + "-" + json.length.toString(36);
}

/** True when the stored ack refers to a legacy (pre-dev.19) updatedAt value. */
function isLegacyAck(ackValue: string | undefined): boolean {
  return !!ackValue && !ackValue.startsWith(VERSION_PREFIX);
}

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
      nextAck[candidate.id] = recordVersion(stamped);
      added += 1;
      if (candidate.deletedAt) tombstoned += 1;
      continue;
    }
    const ackAt = ack[candidate.id];
    // Legacy acks (pre-dev.19) stored raw updatedAt strings; keep comparing
    // those the old way so an upgrade never conflict-spams unchanged records.
    const legacy = isLegacyAck(ackAt);
    const peerChanged = legacy ? candidate.updatedAt !== ackAt : recordVersion(candidate) !== ackAt;
    const localChanged = legacy ? existing.updatedAt !== ackAt : recordVersion(existing) !== ackAt;

    if (!peerChanged) {
      // dev.19: the peer still shows the common-ancestor version — the ack
      // MUST STAY that version. Rewriting it to our own (possibly diverged)
      // version would claim the peer already has our edit and defuse a real
      // conflict once their snapshot catches up.
      if (ackAt !== undefined) nextAck[candidate.id] = ackAt;
      skipped += 1;
      continue;
    }
    if (!localChanged) {
      const stamped = acceptPeerWithUnion(existing, candidate, peer);
      const idx = merged.findIndex((i) => i.id === candidate.id);
      if (idx >= 0) merged[idx] = stamped;
      nextAck[candidate.id] = recordVersion(candidate);
      updated += 1;
      if (candidate.deletedAt && !existing.deletedAt) tombstoned += 1;
      continue;
    }
    if (candidate.deletedAt && existing.deletedAt) {
      nextAck[candidate.id] = recordVersion(candidate);
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

/** dev.19 protocol v3: cryptographic device identity lives on the Rust side
 *  (persistent P-256 keypair). The frontend only displays fingerprints and
 *  drives pairing; it can never forge sync authority. */
export interface LanIdentity {
  fingerprint: string;
  fingerprintFormatted: string;
  publicKey: string;
}

export async function lanIdentity(): Promise<LanIdentity> {
  return invoke<LanIdentity>("lan_sync_identity");
}

export async function lanNewPairingCode(): Promise<string> {
  return invoke<string>("lan_sync_new_pairing_code");
}
export async function lanClosePairing(): Promise<void> {
  await invoke("lan_sync_close_pairing");
}
export async function lanTakePairRequests(): Promise<Array<{ fingerprint: string; public_key: string; name: string; address: string }>> {
  return invoke("lan_sync_take_pair_requests");
}
export async function lanTakeInbox(): Promise<Array<{ from: string; payload: string }>> {
  return invoke("lan_sync_take_inbox");
}
export async function lanApprovePair(fingerprint: string, publicKey: string, name: string): Promise<void> {
  await invoke("lan_sync_approve_pair", { fingerprint, publicKey, name });
}
export async function lanDenyPair(fingerprint: string): Promise<void> {
  await invoke("lan_sync_deny_pair", { fingerprint });
}
export async function lanTrusted(): Promise<Array<{ fingerprint: string; fingerprintFormatted: string; name: string; addedAt: string }>> {
  return invoke("lan_sync_trusted");
}
export async function lanRevoke(fingerprint: string): Promise<void> {
  await invoke("lan_sync_revoke", { fingerprint });
}
export async function lanPairPeer(url: string, code: string, name: string, listenAddress: string): Promise<{ fingerprint: string; fingerprintFormatted: string; name: string; ownFingerprint: string }> {
  return invoke("lan_sync_pair_peer", { url, code, name, listenAddress });
}
export async function lanExchange(url: string, fingerprint: string, snapshot: string): Promise<string> {
  return invoke<string>("lan_sync_exchange", { url, fingerprint, snapshot });
}

/** dev.19: the sealed exchange body carries our snapshot PLUS our ack map
 *  (what we last saw of the peer's records) so the peer's three-way merge has
 *  a common ancestor. Without the ack exchange, the first edit to a record
 *  that predates the pairing looks like a both-changed conflict. */
export interface ExchangeBody {
  payload: string;
  acks: Record<string, string>;
}

export function exchangeBodyFrom(snapshot: string, ack: Record<string, string>): string {
  return JSON.stringify({ payload: snapshot, acks: ack ?? {} } satisfies ExchangeBody);
}

export function parseExchangeBody(raw: string): ExchangeBody {
  try {
    const parsed = JSON.parse(raw) as Partial<ExchangeBody>;
    if (parsed && typeof parsed.payload === "string" && typeof parsed.acks === "object" && parsed.acks !== null) {
      return { payload: parsed.payload, acks: parsed.acks as Record<string, string> };
    }
  } catch { /* legacy/plain snapshot */ }
  return { payload: raw, acks: {} };
}

/** Apply the peer's ack map to our own: for records our side has NOT changed
 *  since the version they last saw, adopt their ack as the common ancestor. */
function adoptPeerAcks(own: Record<string, string>, peerAcks: Record<string, string>, local: Incident[]): Record<string, string> {
  const next = { ...own };
  const byId = new Map(local.map((i) => [i.id, i]));
  for (const [id, at] of Object.entries(peerAcks)) {
    const inc = byId.get(id);
    if (!inc) continue;
    // Their ack tells us what THEY have; it becomes our baseline only if our
    // copy still matches it (we made no local change since). Legacy acks
    // compare by updatedAt (pre-dev.19 peers).
    const matches = isLegacyAck(at)
      ? (inc.updatedAt ?? inc.createdAt ?? "") === at
      : recordVersion(inc) === at;
    if (matches) {
      next[id] = at;
    }
  }
  return next;
}

export interface SyncRoundResult {
  added: number;
  updated: number;
  tombstoned: number;
  conflicts: number;
  peersUp: number;
}

/**
 * One sync round (v3, encrypted): snapshot -> one sealed exchange per peer.
 * The exchange both pushes our snapshot and returns the peer's (single
 * round-trip); merge stays ack-based three-way; conflicts are persisted for
 * human review, never auto-resolved.
 */
export async function runSyncRound(
  config: LanSyncConfig,
  deviceName: string,
  onLog: (line: string) => void
): Promise<SyncRoundResult> {
  let local = (await getAllIncidents()).filter((i) => !i.isDemo);
  const snapshot = snapshotFrom(local, deviceName);

  const peerStates = ((await getSetting<SyncPeerStates>(SYNC_PEER_STATE_KEY)) ?? {}) as SyncPeerStates;
  // Per-peer reply bodies: our snapshot PLUS our acks for that peer, so the
  // peer's three-way merge gets a common ancestor in both directions.
  const replyBodies: Array<[string, string]> = [];
  for (const st of Object.values(peerStates)) {
    if (st.deviceId) replyBodies.push([st.deviceId, exchangeBodyFrom(snapshot, st.ack ?? {})]);
  }
  await lanSetSnapshot(replyBodies);
  let added = 0, updated = 0, tombstoned = 0, conflicts = 0, peersUp = 0;

  // dev.19: drain the inbox FIRST — pushes from peers (tagged with their
  // fingerprint by the server) merge with that peer's ack state. This is the
  // only path by which the OTHER side's proactive changes arrive.
  const inbox = await lanTakeInbox();
  for (const entry of inbox) {
    if (!entry?.from || typeof entry.payload !== "string") continue;
    const stateEntry = Object.entries(peerStates).find(([, s]) => s.deviceId === entry.from);
    const peer = stateEntry?.[1] ?? { trusted: true, ack: {} };
    if (peer.trusted === false) continue;
    try {
      const body = parseExchangeBody(entry.payload);
      const baseAck = adoptPeerAcks(peer.ack ?? {}, body.acks, local);
      const incoming = incidentsFromPayload(body.payload);
      const result = mergeIncidentsV2(local, incoming, baseAck, { deviceId: entry.from, name: peer.name });
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
      if (stateEntry) {
        peerStates[stateEntry[0]] = { ...peer, lastSyncAt: new Date().toISOString(), ack: result.ack };
        local = result.merged.filter((i) => !i.isDemo);
      }
    } catch {
      onLog("a received push could not be merged and was dropped");
    }
  }

  for (const raw of config.peers) {
    const peer = peerStates[raw] ?? { trusted: true, ack: {} };
    if (peer.trusted === false) continue;
    const fingerprint = peer.deviceId;
    if (!fingerprint) { onLog("peer not paired yet: " + raw); continue; }
    const up = await lanPingPeer(raw);
    if (!up) { onLog("peer unreachable: " + raw); continue; }
    peersUp += 1;
    try {
      // Encrypted push+pull in one request; the Rust side enforces trust.
      const reply = await lanFetchSnapshot(raw, fingerprint, exchangeBodyFrom(snapshot, peer.ack ?? {}));
      const body = parseExchangeBody(reply);
      const baseAck = adoptPeerAcks(peer.ack ?? {}, body.acks, local);
      const peerName = deviceNameFromPayload(body.payload) ?? peer.name ?? raw.replace(/^https?:\/\/[^:]+/, "").split(":")[0] ?? "Device";
      const incoming = incidentsFromPayload(body.payload);
      const result = mergeIncidentsV2(local, incoming, baseAck, { deviceId: fingerprint, name: peerName });
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
      peerStates[raw] = { ...peer, deviceId: fingerprint, name: peerName, trusted: true, lastSyncAt: new Date().toISOString(), ack: result.ack };
      local = result.merged.filter((i) => !i.isDemo);
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

/** dev.19: disabling sync rejects all sync/pair endpoints server-side (the
 *  listener itself stays bound; nothing sync-related is exposed). */
export async function lanSetEnabled(enabled: boolean): Promise<void> {
  await invoke("lan_sync_set_enabled", { enabled });
}

export async function lanSetSnapshot(snapshots: Array<[string, string]>): Promise<void> {
  await invoke("lan_sync_set_snapshot", { snapshots });
}

export async function lanPingPeer(url: string): Promise<boolean> {
  try {
    await invoke("lan_sync_ping_peer", { url });
    return true;
  } catch {
    return false;
  }
}

export async function lanFetchSnapshot(url: string, fingerprint: string, snapshot: string): Promise<string> {
  return lanExchange(url, fingerprint, snapshot);
}

export async function lanLocalAddress(port: number): Promise<string> {
  return invoke<string>("lan_sync_local_address", { port });
}

/** One sync round: refresh snapshot, drain inbox, pull+push each peer. */

