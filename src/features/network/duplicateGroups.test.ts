/** 0.3.0-dev.4: duplicate grouping (spec 20/64) — A-B, A-C, B-C = one group. */
import { describe, it, expect } from "vitest";
import { groupDuplicateCandidates, groupSignals } from "./duplicateGroups";
import type { Incident } from "../../types/incident";

function inc(id: string, ref: string, iso: string): Incident {
  return {
    id, humanReference: ref, schemaVersion: 1, status: "reported", incidentType: null, urgency: null,
    animal: { group: "bird", species: null, speciesConfirmed: false, count: 1, lifeStage: null, sex: null, description: "Hawk by the road" },
    location: { description: "Highway 8", precision: "approximate", landmark: null, address: null, latitude: 51.05, longitude: -114.07, notes: null },
    occurredAt: iso, createdAt: iso, updatedAt: iso,
    timeline: [], observations: [], hazards: null, actions: [], animalNow: null, animalNowDescription: null,
    contacts: [], custody: [], handoffs: [], attachments: [], tags: [], notes: [],
    archivedAt: null, deletedAt: null, isDemo: false, shareProfile: "private", createdVia: "form",
    summary: null, nextStep: null,
  } as Incident;
}

const A = inc("a", "WIH-2026-000101", "2026-10-04T10:00:00Z");
const B = inc("b", "WIH-2026-000102", "2026-10-04T10:05:00Z");
const C = inc("c", "WIH-2026-000103", "2026-10-04T10:12:00Z");
const D = inc("d", "WIH-2026-000104", "2026-10-04T09:00:00Z");

describe("duplicate grouping", () => {
  it("chain pairs A-B, A-C, B-C collapse into ONE group of three (spec 64)", () => {
    const byId = new Map([[A.id, A], [B.id, B], [C.id, C]]);
    const pairs = [
      { a: A, b: B, distanceKm: 0.1, ageHours: 0.1, sharedWords: 3 },
      { a: A, b: C, distanceKm: 0.2, ageHours: 0.2, sharedWords: 3 },
      { a: B, b: C, distanceKm: 0.15, ageHours: 0.12, sharedWords: 3 },
    ];
    const groups = groupDuplicateCandidates(pairs, byId);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.members.map((m) => m.id).sort()).toEqual(["a", "b", "c"]);
  });

  it("disconnected pairs stay in separate groups; strongest first", () => {
    const byId = new Map([[A.id, A], [B.id, B], [C.id, C], [D.id, D]]);
    const pairs = [
      { a: A, b: B, distanceKm: 0.1, ageHours: 0.1, sharedWords: 3 },
      { a: C, b: D, distanceKm: 1.5, ageHours: 1, sharedWords: 2 },
    ];
    const groups = groupDuplicateCandidates(pairs, byId);
    expect(groups).toHaveLength(2);
    // two-member tight group outranks the looser one
    expect(groups[0]!.members.map((m) => m.id).sort()).toEqual(["a", "b"]);
  });

  it("no permutation spam: one group renders once, not C(n,2) rows", () => {
    const byId = new Map([[A.id, A], [B.id, B], [C.id, C]]);
    const pairs = [
      { a: A, b: B, distanceKm: 0.1, ageHours: 0.1, sharedWords: 3 },
      { a: A, b: C, distanceKm: 0.2, ageHours: 0.2, sharedWords: 3 },
      { a: B, b: C, distanceKm: 0.15, ageHours: 0.12, sharedWords: 3 },
    ];
    const groups = groupDuplicateCandidates(pairs, byId);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.members).toHaveLength(3);
  });

  it("group signals are compact chips from real data", () => {
    const signals = groupSignals([A, B], [{ a: A, b: B, distanceKm: 0.1, ageHours: 0.08, sharedWords: 3 }]);
    expect(signals).toContain("Same area");
    expect(signals).toContain("Within an hour");
    expect(signals).toContain("Similar description");
  });
});
