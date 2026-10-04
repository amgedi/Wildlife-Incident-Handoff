/** 0.2.0-dev.15 — data-integrity pass: ack-based sync merge, tombstones,
 *  conflicts, timeline union, state invariants, migration fixtures. */
import { describe, it, expect } from "vitest";
import { mergeIncidentsV2, incidentsFromPayload, snapshotFrom, deviceNameFromPayload, acceptPeerWithUnion } from "./sync/lanSync";
import { makeIncident } from "./export/exportService.test";
import { changeStatus, archiveIncident, moveToTrash, restoreFromTrash } from "../storage/incidentService";
import { getIncident, putIncident } from "../storage/repositories";
import type { Incident } from "../types/incident";

const PEER = { deviceId: "peer-1", name: "Field Tablet" };

function withUpdate(inc: Incident, updatedAt: string, patch: Partial<Incident> = {}): Incident {
  return { ...inc, ...patch, updatedAt };
}

describe("sync merge v2 — ack-based three-way", () => {
  it("adds unknown records with provenance", () => {
    const a = makeIncident({ id: "a" });
    const r = mergeIncidentsV2([], [a], {}, PEER, "2026-10-03T12:00:00Z");
    expect(r.added).toBe(1);
    expect(r.merged[0]!.syncSource?.deviceId).toBe("peer-1");
    expect(r.ack["a"]).toBeTruthy();
  });

  it("accepts peer-only changes since the ack", () => {
    const a = makeIncident({ id: "a", updatedAt: "2026-10-03T10:00:00Z", summary: "base" });
    const peer = withUpdate(a, "2026-10-03T11:00:00Z", { summary: "peer edit" });
    const r = mergeIncidentsV2([a], [peer], { a: "2026-10-03T10:00:00Z" }, PEER);
    expect(r.updated).toBe(1);
    expect(r.merged[0]!.summary).toBe("peer edit");
  });

  it("keeps local-only changes since the ack (never overwritten)", () => {
    const a = makeIncident({ id: "a", updatedAt: "2026-10-03T10:00:00Z", summary: "base" });
    const local = withUpdate(a, "2026-10-03T11:00:00Z", { summary: "local edit" });
    const peer = withUpdate(a, "2026-10-03T10:00:00Z"); // peer unchanged vs ack
    const r = mergeIncidentsV2([local], [peer], { a: "2026-10-03T10:00:00Z" }, PEER);
    expect(r.skipped).toBe(1);
    expect(r.merged[0]!.summary).toBe("local edit");
  });

  it("raises a CONFLICT when both sides changed (regardless of clock)", () => {
    const a = makeIncident({ id: "a", updatedAt: "2026-10-03T10:00:00Z", summary: "base", location: makeIncident().location });
    const local = withUpdate(a, "2026-10-03T11:00:00Z", { summary: "dispatch says A" });
    // Peer's clock is BEHIND but it changed since the ack — wall clock must not decide.
    const peer = withUpdate(a, "2026-10-03T09:30:00Z", { summary: "tablet says B" });
    const r = mergeIncidentsV2([local], [peer], { a: "2026-10-03T10:00:00Z" }, PEER);
    expect(r.conflicts).toHaveLength(1);
    expect(r.merged[0]!.summary).toBe("dispatch says A"); // local kept untouched
    expect(r.ack["a"]).toBe("2026-10-03T10:00:00Z"); // ack unchanged until resolved
  });

  it("conflict carries both full records for human resolution", () => {
    const a = makeIncident({ id: "a", updatedAt: "2026-10-03T10:00:00Z" });
    const local = withUpdate(a, "2026-10-03T11:00:00Z");
    const peer = withUpdate(a, "2026-10-03T11:30:00Z");
    const r = mergeIncidentsV2([local], [peer], { a: "2026-10-03T10:00:00Z" }, PEER);
    expect(r.conflicts[0]!.local.id).toBe("a");
    expect(r.conflicts[0]!.incoming.updatedAt).toBe("2026-10-03T11:30:00Z");
  });

  it("propagates peer deletions as tombstones when we have not changed the record", () => {
    const a = makeIncident({ id: "a", updatedAt: "2026-10-03T10:00:00Z" });
    const deleted = withUpdate(a, "2026-10-03T12:00:00Z", { deletedAt: "2026-10-03T12:00:00Z" });
    const r = mergeIncidentsV2([a], [deleted], { a: "2026-10-03T10:00:00Z" }, PEER);
    expect(r.tombstoned).toBe(1);
    expect(r.merged[0]!.deletedAt).toBe("2026-10-03T12:00:00Z");
  });

  it("never resurrects a record we deleted locally since the ack", () => {
    const a = makeIncident({ id: "a", updatedAt: "2026-10-03T10:00:00Z" });
    const localDeleted = withUpdate(a, "2026-10-03T11:00:00Z", { deletedAt: "2026-10-03T11:00:00Z" });
    const peerStale = withUpdate(a, "2026-10-03T10:00:00Z"); // stale active copy
    const r = mergeIncidentsV2([localDeleted], [peerStale], { a: "2026-10-03T10:00:00Z" }, PEER);
    expect(r.skipped).toBe(1);
    expect(r.merged[0]!.deletedAt).toBe("2026-10-03T11:00:00Z");
  });

  it("both deleted since ack stays deleted, no conflict", () => {
    const a = makeIncident({ id: "a", updatedAt: "2026-10-03T10:00:00Z" });
    const localDeleted = withUpdate(a, "2026-10-03T11:00:00Z", { deletedAt: "2026-10-03T11:00:00Z" });
    const peerDeleted = withUpdate(a, "2026-10-03T12:00:00Z", { deletedAt: "2026-10-03T12:00:00Z" });
    const r = mergeIncidentsV2([localDeleted], [peerDeleted], { a: "2026-10-03T10:00:00Z" }, PEER);
    expect(r.conflicts).toHaveLength(0);
    expect(r.merged[0]!.deletedAt).toBe("2026-10-03T11:00:00Z");
  });

  it("accepting a peer record preserves local-only timeline events (append-only union)", () => {
    const base = makeIncident({ id: "a", updatedAt: "2026-10-03T10:00:00Z" });
    const localEvent = { eventId: "evt-local", incidentId: "a", eventType: "note_added" as const, timestamp: "2026-10-03T10:30:00Z", actor: null, summary: "Local note added", details: null, metadata: null, relatedAttachmentIds: [] };
    const local = { ...base, updatedAt: "2026-10-03T10:45:00Z", timeline: [...base.timeline, localEvent] };
    const peer = withUpdate(base, "2026-10-03T11:00:00Z", { summary: "peer edited summary" });
    const accepted = acceptPeerWithUnion(local, peer, PEER);
    expect(accepted.summary).toBe("peer edited summary"); // peer's field change taken
    expect(accepted.timeline.some((e) => e.eventId === "evt-local")).toBe(true); // local event preserved
    expect(accepted.syncSource?.deviceId).toBe("peer-1");
  });

  it("demo records never sync", () => {
    const demo = makeIncident({ id: "d", isDemo: true });
    const r = mergeIncidentsV2([], [demo], {}, PEER);
    expect(r.skipped).toBe(1);
  });
});

describe("sync payload helpers", () => {
  it("round-trips snapshot with device name", () => {
    const incidents = [makeIncident({ id: "rt" })];
    const payload = snapshotFrom(incidents, "Dispatch Laptop");
    expect(deviceNameFromPayload(payload)).toBe("Dispatch Laptop");
    expect(incidentsFromPayload(payload).map((i) => i.id)).toEqual(["rt"]);
    expect(incidentsFromPayload("garbage")).toEqual([]);
  });
});

// ---------- incident state invariants (P43) ----------

describe("incident state invariants", () => {
  it("status change appends an event and never rewrites history", async () => {
    const inc = makeIncident({ id: "inv-1", timeline: [{ eventId: "e1", incidentId: "inv-1", eventType: "incident_created", timestamp: "2026-10-03T09:00:00Z", actor: null, summary: "Incident created", details: null, metadata: null, relatedAttachmentIds: [] }] });
    const before = JSON.stringify(inc.timeline.map((e) => e.eventId));
    const updated = await changeStatus(inc, "responder_assigned", "Tester");
    expect(updated.status).toBe("responder_assigned");
    expect(updated.timeline.length).toBe(2);
    expect(JSON.stringify(updated.timeline.slice(0, 1).map((e) => e.eventId))).toBe(before); // original intact
    expect(updated.timeline[1]!.metadata).toEqual({ from: inc.status, to: "responder_assigned" });
  });

  it("archive appends an event; unarchive appends another; history only grows", async () => {
    const inc = makeIncident({ id: "inv-2" });
    const archived = await archiveIncident(inc);
    expect(archived.archivedAt).toBeTruthy();
    expect(archived.timeline.length).toBe(inc.timeline.length + 1);
    const restored = await restoreFromTrash(await archiveIncident(archived));
    expect(restored.timeline.length).toBeGreaterThanOrEqual(archived.timeline.length);
  });

  it("trash preserves recoverability (record kept, deletedAt set; restore clears it)", async () => {
    const inc = makeIncident({ id: "inv-3", summary: "precious" });
    const trashed = await moveToTrash(inc);
    expect(trashed.deletedAt).toBeTruthy();
    expect(trashed.summary).toBe("precious"); // data not destroyed
    const restored = await restoreFromTrash(trashed);
    expect(restored.deletedAt).toBeNull();
  });
});

// ---------- migration fixtures (P42): old/malformed records must survive ----------

describe("migration fixtures — old and malformed records", () => {
  it("pre-structured-events record (string-only metadata) opens and merges", () => {
    const legacy = makeIncident({ id: "legacy-1" });
    // Simulate an early v0.2 record: missing optional additive fields.
    const stripped: Incident = JSON.parse(JSON.stringify(legacy));
    delete (stripped as Partial<Incident>).shareProfile;
    delete (stripped as Partial<Incident>).pinnedAt;
    expect(stripped.timeline.length).toBeGreaterThan(0);
    const r = mergeIncidentsV2([], [stripped], {}, PEER);
    expect(r.added).toBe(1);
  });

  it("record missing optional fields merges without throwing", () => {
    const sparse = {
      id: "sparse-1",
      humanReference: "WIH-2026-000999",
      schemaVersion: 1,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
      status: "reported",
      incidentType: null,
      occurredAt: null,
      urgency: "condition_unclear",
      summary: "Minimal legacy record",
      nextStep: null,
      animal: { group: null, species: null, speciesConfirmed: false, count: null, lifeStage: null, sex: null, description: "Unknown animal" },
      location: { description: null, precision: null, landmark: null, address: null, latitude: null, longitude: null, notes: null },
      observations: [],
      hazards: { hazards: [], notes: null, recordedAt: "2026-01-01T00:00:00Z" },
      actions: [],
      animalNow: "unknown",
      animalNowDescription: null,
      contacts: [],
      custody: [],
      handoffs: [],
      attachments: [],
      timeline: [],
      notes: [],
      tags: [],
      archivedAt: null,
      deletedAt: null,
      isDemo: false,
    } as unknown as Incident;
    const r = mergeIncidentsV2([], [sparse], {}, PEER);
    expect(r.added).toBe(1);
  });

  it("malformed payloads are dropped, not crashed on", () => {
    expect(incidentsFromPayload("{not json")).toEqual([]);
    expect(incidentsFromPayload('{"incidents": "nope"}')).toEqual([]);
  });

  it("round-trips through IndexedDB unchanged (old records unchanged rule)", async () => {
    const legacy = makeIncident({ id: "legacy-rt", summary: "Old record" });
    await putIncident(legacy);
    const loaded = await getIncident(legacy.id);
    expect(loaded?.summary).toBe("Old record");
    expect(loaded?.timeline.length).toBe(legacy.timeline.length);
  });
});

describe("dev.18 clock-skew safety", () => {
  const ACK = { a: "2026-10-03T10:00:00Z" };

  it("a peer with a wildly FUTURE clock cannot silently overwrite a local-only edit", () => {
    const a = makeIncident({ id: "a", updatedAt: "2026-10-03T10:00:00Z", summary: "base" });
    const local = withUpdate(a, "2026-10-03T11:00:00Z", { summary: "local edit" });
    const futurePeer = withUpdate(a, "2027-01-01T00:00:00Z", { summary: "future peer edit" });
    const r = mergeIncidentsV2([local], [futurePeer], ACK, PEER);
    // both changed since the ack → explicit conflict; the future timestamp
    // must NOT decide the winner
    expect(r.conflicts).toHaveLength(1);
    expect(r.merged[0]!.summary).toBe("local edit");
  });

  it("a peer with a badly BEHIND clock cannot erase a local edit via LWW", () => {
    const a = makeIncident({ id: "a", updatedAt: "2026-10-03T10:00:00Z", summary: "base" });
    const local = withUpdate(a, "2026-10-03T11:00:00Z", { summary: "local edit" });
    const pastPeer = withUpdate(a, "1999-12-31T23:59:59Z", { summary: "stale peer edit" });
    const r = mergeIncidentsV2([local], [pastPeer], ACK, PEER);
    expect(r.conflicts).toHaveLength(1);
    expect(r.merged[0]!.summary).toBe("local edit");
  });

  it("metadata needed for skew forensics is preserved (createdAt, provenance)", () => {
    const a = makeIncident({ id: "a", createdAt: "2026-10-01T08:00:00Z", updatedAt: "2026-10-03T10:00:00Z" });
    const r = mergeIncidentsV2([], [a], {}, PEER);
    expect(r.merged[0]!.createdAt).toBe("2026-10-01T08:00:00Z");
    expect(r.merged[0]!.syncSource?.deviceId).toBe("peer-1");
    expect(r.merged[0]!.syncSource?.at).toBeTruthy();
  });
});
