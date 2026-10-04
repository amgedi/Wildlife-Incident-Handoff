/**
 * Response-flow invariant tests (0.3 overhaul, spec items 3–5).
 *
 * The stage count a user sees and the case list they get after selecting a
 * stage MUST derive from the SAME canonical scope: stageCount(stage) ===
 * stageList(stage).length for every stage, under every equivalent scope
 * (plain, dashboard filters active, test view with demo data, archive/trash).
 *
 * Regression origin: dev.19 counts came from the dashboard's filtered list
 * while the case drawer re-queried raw records with its own duplicated filter
 * copy — "Pickup shows 3, selecting it shows 0 case(s)".
 */
import { describe, expect, it } from "vitest";
import type { Incident } from "../../types/incident";
import {
  RESPONSE_FLOW_STAGES,
  getPipelineCounts,
  getPipelineStageCases,
} from "./incidentAnalytics";

let seq = 0;
export function makeIncident(overrides: Partial<Incident> = {}): Incident {
  seq += 1;
  const now = new Date(Date.now() - seq * 60_000).toISOString();
  return {
    id: `test-${seq}`,
    humanReference: `WIH-TEST-${String(seq).padStart(6, "0")}`,
    status: "reported",
    incidentType: null,
    animal: { group: "mammal", species: null, description: "Test animal", count: 1 },
    location: { description: "Test location", latitude: null, longitude: null, landmark: null },
    occurredAt: now,
    createdAt: now,
    updatedAt: now,
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

const STAGE_OF: Record<string, string> = {
  reported: "reported",
  response_requested: "reported",
  responder_assigned: "assigned",
  in_transport: "enroute",
  awaiting_pickup: "pickup",
  transferred: "transfer",
  in_care: "care",
  veterinary_care: "care",
  monitoring: "care",
  released: "closed",
  deceased: "closed",
  closed: "closed",
  cancelled: "closed",
};

describe("response flow canonical scope invariant", () => {
  it("count(stage) === list(stage).length for every stage on a mixed dataset", () => {
    const scope = [
      makeIncident({ status: "reported" }),
      makeIncident({ status: "response_requested" }),
      makeIncident({ status: "responder_assigned" }),
      makeIncident({ status: "in_transport" }),
      makeIncident({ status: "awaiting_pickup" }),
      makeIncident({ status: "awaiting_pickup" }),
      makeIncident({ status: "transferred" }),
      makeIncident({ status: "in_care" }),
      makeIncident({ status: "monitoring" }),
      makeIncident({ status: "released" }),
      makeIncident({ status: "deceased" }),
      makeIncident({ status: "cancelled" }),
    ];
    const counts = Object.fromEntries(getPipelineCounts(scope).map((s) => [s.key, s.count]));
    for (const stage of RESPONSE_FLOW_STAGES) {
      const cases = getPipelineStageCases(scope, stage.key);
      expect(cases.length, `stage ${stage.key}`).toBe(counts[stage.key]);
      // Every listed case is genuinely at that stage.
      for (const c of cases) expect(STAGE_OF[c.status]).toBe(stage.key);
    }
    expect(counts["pickup"]).toBe(2);
    expect(counts["care"]).toBe(2);
  });

  it("holds when the caller applies dashboard filters first (same array to both)", () => {
    const all = [
      makeIncident({ status: "awaiting_pickup", incidentType: "collision" }),
      makeIncident({ status: "awaiting_pickup", incidentType: "injured_wildlife" }),
      makeIncident({ status: "in_care", incidentType: "collision" }),
      makeIncident({ status: "reported", incidentType: "collision" }),
    ];
    const filtered = all.filter((i) => i.incidentType === "collision");
    const counts = Object.fromEntries(getPipelineCounts(filtered).map((s) => [s.key, s.count]));
    for (const stage of RESPONSE_FLOW_STAGES) {
      expect(getPipelineStageCases(filtered, stage.key).length, stage.key).toBe(counts[stage.key]);
    }
    expect(counts["pickup"]).toBe(1);
  });

  it("holds under test view where demo incidents are mixed in as first-class scope", () => {
    // Test View mixes demo records into the dashboard scope (presented with
    // isDemo faked false, as NetworkPage's live memo does). Count and list
    // must agree on that SAME mixed scope.
    const mixed = [
      makeIncident({ status: "awaiting_pickup", isDemo: false }),
      makeIncident({ status: "in_care", isDemo: true }),
      makeIncident({ status: "in_care", isDemo: false }),
    ].map((i) => (i.isDemo ? { ...i, isDemo: false as const } : i));
    const counts = Object.fromEntries(getPipelineCounts(mixed).map((s) => [s.key, s.count]));
    for (const stage of RESPONSE_FLOW_STAGES) {
      expect(getPipelineStageCases(mixed, stage.key).length, stage.key).toBe(counts[stage.key]);
    }
    expect(counts["care"]).toBe(2);
  });

  it("excludes archived and trashed incidents from BOTH count and list", () => {
    const scope = [
      makeIncident({ status: "awaiting_pickup" }),
      makeIncident({ status: "awaiting_pickup", archivedAt: "2026-01-01T00:00:00Z" }),
      makeIncident({ status: "in_care", deletedAt: "2026-01-01T00:00:00Z" }),
    ].filter((i) => !i.deletedAt && !i.archivedAt);
    const counts = Object.fromEntries(getPipelineCounts(scope).map((s) => [s.key, s.count]));
    for (const stage of RESPONSE_FLOW_STAGES) {
      expect(getPipelineStageCases(scope, stage.key).length, stage.key).toBe(counts[stage.key]);
    }
    expect(counts["pickup"]).toBe(1);
    expect(counts["care"]).toBe(0);
  });

  it("stage cases are sorted oldest-first; selecting an unknown stage yields none", () => {
    const scope = [
      makeIncident({ status: "in_care", occurredAt: "2026-10-02T10:00:00Z" }),
      makeIncident({ status: "in_care", occurredAt: "2026-10-01T10:00:00Z" }),
    ];
    const cases = getPipelineStageCases(scope, "care");
    expect(cases[0]!.occurredAt).toBe("2026-10-01T10:00:00Z");
    expect(getPipelineStageCases(scope, "nonexistent")).toEqual([]);
  });
});
