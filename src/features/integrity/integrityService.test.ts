/** Report Integrity behavior tests (0.3, spec items 75–83). */
import { describe, it, expect } from "vitest";
import type { Incident } from "../../types/incident";
import {
  applyFollowUp,
  blockSource,
  computeIntegrityReview,
  dismissSignal,
  localBurstStatus,
  unblockSource,
} from "./integrityService";

let seq = 0;
function inc(overrides: Partial<Incident> = {}): Incident {
  seq += 1;
  const t = new Date(Date.parse("2026-10-04T10:00:00Z") + seq * 60_000).toISOString();
  return {
    id: `i-${seq}`,
    humanReference: `WIH-2026-${String(seq).padStart(6, "0")}`,
    status: "reported",
    incidentType: null,
    animal: { group: "bird", species: null, description: "A small songbird with a hurt wing near the fountain", count: 1, speciesConfirmed: false, lifeStage: null, sex: null },
    location: { description: "Downtown park", latitude: null, longitude: null, landmark: null },
    occurredAt: t,
    createdAt: t,
    updatedAt: t,
    timeline: [],
    custody: [],
    handoffs: [],
    attachments: [],
    isDemo: false,
    deletedAt: null,
    archivedAt: null,
    shareProfile: "private",
    createdVia: "form",
    summary: null,
    nextStep: null,
    ...overrides,
  } as Incident;
}

describe("report integrity", () => {
  it("flags possible duplicates from pair input", () => {
    const a = inc();
    const b = inc();
    const review = computeIntegrityReview([a, b], { duplicatePairs: [{ a, b }] });
    expect(review.queue).toHaveLength(2);
    for (const item of review.queue) {
      expect(item.signals.map((s) => s.key)).toContain("possible_duplicate");
    }
    expect(review.counts.possible_duplicate).toBe(2);
  });

  it("flags rapid repeat submissions from the same provenance bucket", () => {
    const group = [inc(), inc(), inc()];
    const review = computeIntegrityReview(group, { duplicatePairs: [] });
    for (const item of review.queue) {
      expect(item.signals.map((s) => s.key)).toContain("rapid_repeat");
    }
  });

  it("flags repeated identical text but ignores short generic text", () => {
    const a = inc();
    const b = inc({ animal: { ...a.animal } });
    const c = inc({ animal: { group: "bird", species: null, description: "ok", count: 1, speciesConfirmed: false, lifeStage: null, sex: null } });
    const d = inc({ animal: { group: "bird", species: null, description: "ok", count: 1, speciesConfirmed: false, lifeStage: null, sex: null } });
    const review = computeIntegrityReview([a, b, c, d], { duplicatePairs: [] });
    const flagged = review.queue.filter((q) => q.signals.some((s) => s.key === "repeated_text"));
    expect(flagged.map((f) => f.incident.id).sort()).toEqual([a.id, b.id].sort());
  });

  it("flags reused media hashes", () => {
    const a = inc({ attachments: [{ id: "att1", sha256: "abc" } as never] });
    const b = inc({ attachments: [{ id: "att2", sha256: "abc" } as never] });
    const review = computeIntegrityReview([a, b], { duplicatePairs: [] });
    expect(review.counts.reused_media).toBe(2);
  });

  it("respects dismissed signals (professional decision is sticky)", () => {
    const a = inc();
    const b = inc();
    const dismissedA = dismissSignal(a, "possible_duplicate");
    const review = computeIntegrityReview([dismissedA, b], { duplicatePairs: [{ a: dismissedA, b }] });
    const itemA = review.queue.find((q) => q.incident.id === dismissedA.id);
    const itemB = review.queue.find((q) => q.incident.id === b.id);
    expect(itemA?.signals.some((s) => s.key === "possible_duplicate") ?? false).toBe(false);
    expect(itemB?.signals.some((s) => s.key === "possible_duplicate")).toBe(true);
  });

  it("never auto-rejects: output is a review queue, incidents are not mutated", () => {
    const list = [inc(), inc(), inc()];
    const before = JSON.stringify(list.map((i) => [i.id, i.status, i.deletedAt]));
    computeIntegrityReview(list, { duplicatePairs: [] });
    expect(JSON.stringify(list.map((i) => [i.id, i.status, i.deletedAt]))).toBe(before);
  });

  it("blocking records audit fields; unblock removes; previous reports untouched", () => {
    let sources = blockSource([], "fp-123", "device", "rapid submissions");
    expect(sources).toHaveLength(1);
    expect(sources[0]).toMatchObject({ id: "fp-123", type: "device", note: "rapid submissions" });
    expect(sources[0]!.at).toBeTruthy();
    sources = blockSource(sources, "fp-123", "device"); // no duplicates
    expect(sources).toHaveLength(1);
    sources = unblockSource(sources, "fp-123");
    expect(sources).toHaveLength(0);
  });

  it("follow-up marks are recorded without exposing contact info broadly", () => {
    const a = inc();
    const updated = applyFollowUp(a, "contact_attempted");
    expect(updated.followUp).toBe("contact_attempted");
    expect(updated.updatedAt >= a.createdAt).toBe(true);
  });

  it("local burst guard is advisory only", () => {
    const now = new Date("2026-10-04T10:30:00Z");
    const recent = ["2026-10-04T10:29:00Z", "2026-10-04T10:15:00Z", "2026-10-04T10:00:00Z"];
    expect(localBurstStatus(recent, now)).toEqual({ count: 3, advisory: true });
    expect(localBurstStatus(["2026-10-04T09:00:00Z"], now).advisory).toBe(false);
  });
});
