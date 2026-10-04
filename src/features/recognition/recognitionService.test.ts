/** Community Recognition tests (0.3, spec items 84–88): quality-based,
 *  opt-in, NO leaderboards. */
import { describe, it, expect } from "vitest";
import type { Incident } from "../../types/incident";
import {
  DEFAULT_RECOGNITION,
  FORBIDDEN_BADGES,
  RECOGNITION_RULES,
  computeRecognition,
} from "./recognitionService";

let seq = 0;
function inc(overrides: Partial<Incident> = {}): Incident {
  seq += 1;
  const t = new Date(Date.parse("2026-10-04T10:00:00Z") + seq * 60_000).toISOString();
  return {
    id: `r-${seq}`,
    humanReference: `WIH-2026-${String(seq).padStart(6, "0")}`,
    status: "responder_assigned",
    incidentType: null,
    animal: { group: "mammal", species: null, description: "Juvenile rabbit", count: 1, speciesConfirmed: false, lifeStage: null, sex: null },
    location: { description: "Trail head", latitude: 52.2, longitude: 0.1, landmark: null },
    occurredAt: t,
    createdAt: t,
    updatedAt: t,
    timeline: [{ id: `t${seq}`, eventType: "incident_created", timestamp: t, actor: "Maya", summary: "created" }],
    custody: [{ id: `c${seq}`, holder: "Jordan", holderRole: "Responder", startedAt: t, endedAt: null, location: null, handoffId: null }],
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

describe("community recognition", () => {
  it("recognition is OFF by default (opt-in)", () => {
    expect(DEFAULT_RECOGNITION.enabled).toBe(false);
    expect(DEFAULT_RECOGNITION.privacy).toBe("private");
  });

  it("no leaderboard-style rule exists; forbidden badges enumerated", () => {
    for (const rule of RECOGNITION_RULES) {
      expect(FORBIDDEN_BADGES.some((f) => rule.badge.includes(f))).toBe(false);
      expect(rule.description.toLowerCase()).not.toContain("fastest");
      expect(rule.description.toLowerCase()).not.toContain("most cases");
    }
  });

  it("awards quality badges only after reports are accepted into response", () => {
    // unaccepted reports must not qualify
    const fresh = inc({ status: "reported", custody: [] });
    expect(computeRecognition([fresh], "Maya")).toEqual([]);
  });

  it("helpful observer requires 2+ accepted reports; detailed reporter needs evidence", () => {
    const a = inc({ summary: "Short" });
    const b = inc();
    // a single accepted report with a usable location earns location_helper
    expect(computeRecognition([a], "Maya")).toEqual(["location_helper"]);
    const badges = computeRecognition([a, b], "Maya");
    expect(badges).toContain("helpful_observer");
    // detailed requires a real summary/observation on an accepted report
    const c = inc({ summary: "Juvenile rabbit with visible injury, behavior observed for ten minutes before calling." });
    expect(computeRecognition([c], "Maya")).toContain("detailed_reporter");
  });

  it("location helper + clear handoff derive from usable location / complete handoff records", () => {
    const a = inc();
    const badges = computeRecognition([a], "Maya");
    expect(badges).toContain("location_helper");
    const h = inc({ handoffs: [{ id: "h1", toOrganization: "Riverside Wildlife Rescue", occurredAt: "2026-10-04T11:00:00Z", fromUserId: null } as never] });
    expect(computeRecognition([h], "Maya")).toContain("clear_handoff");
  });

  it("team contributor requires actual reporting AND responding activity by the same person", () => {
    const a = inc(); // Maya created, Jordan holds custody
    expect(computeRecognition([a], "Maya")).not.toContain("team_contributor");
    expect(computeRecognition([a], "Jordan")).not.toContain("team_contributor");
    const b = inc({ custody: [{ id: "c2", holder: "Maya", holderRole: "Responder", startedAt: "2026-10-04T10:05:00Z", endedAt: null, location: null, handoffId: null }] });
    expect(computeRecognition([b], "Maya")).toContain("team_contributor");
  });

  it("demo and deleted records never count", () => {
    const demo = inc({ isDemo: true });
    const dead = inc({ deletedAt: "2026-10-04T12:00:00Z" });
    expect(computeRecognition([demo, dead], "Maya")).toEqual([]);
  });
});
