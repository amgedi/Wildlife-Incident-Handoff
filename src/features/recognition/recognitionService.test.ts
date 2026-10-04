/** Community Recognition tests (0.3, spec items 84–88): quality-based,
 *  opt-in, NO leaderboards. */
import { describe, it, expect } from "vitest";
import type { Incident } from "../../types/incident";
import {
  DEFAULT_RECOGNITION,
  FORBIDDEN_BADGES,
  RECOGNITION_RULES,
  STEWARDSHIP_INPUTS,
  computeRecognition,
  stewardshipProgress,
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

describe("stewardship progression (0.3.0-dev.3, spec 76–89, 115)", () => {
  const MAX_SCORE = STEWARDSHIP_INPUTS.reduce((n, i) => n + i.cap, 0);

  function saturated(): Incident[] {
    // Accepted, fully documented, located, follow-up'd reports + handoffs.
    return Array.from({ length: 30 }, () =>
      inc({
        summary: "Juvenile rabbit with visible injury, behavior observed for ten minutes before calling.",
        attachments: [{ id: "a1", fileName: "photo.jpg", mimeType: "image/jpeg", byteSize: 10, caption: null, addedAt: "2026-10-04T10:30:00Z", sourceAttribution: null, sensitive: false }],
        handoffs: [{ id: "h1", toOrganization: "Riverside Wildlife Rescue", occurredAt: "2026-10-04T11:00:00Z", fromUserId: null } as never],
        timeline: [
          { eventType: "incident_created", timestamp: "2026-10-04T10:00:00Z", actor: "Maya", summary: "created", eventId: "t1", incidentId: "x", details: null, metadata: null, relatedAttachmentIds: [] },
          { eventType: "observation_added", timestamp: "2026-10-04T10:10:00Z", actor: "Maya", summary: "obs", eventId: "t2", incidentId: "x", details: null, metadata: null, relatedAttachmentIds: [] },
          { eventType: "observation_added", timestamp: "2026-10-04T10:20:00Z", actor: "Maya", summary: "obs", eventId: "t3", incidentId: "x", details: null, metadata: null, relatedAttachmentIds: [] },
          { eventType: "note_added", timestamp: "2026-10-04T10:25:00Z", actor: "Maya", summary: "note", eventId: "t4", incidentId: "x", details: null, metadata: null, relatedAttachmentIds: [] },
        ],
      })
    );
  }

  it("gives ZERO progress for 100 reports that are all unaccepted (junk volume ≠ progress)", () => {
    const junk = Array.from({ length: 100 }, () => inc({ status: "reported", custody: [] }));
    const p = stewardshipProgress(junk, "Maya");
    expect(p.score).toBe(0);
    expect(p.level).toBe(1);
    expect(p.scoreIntoLevel).toBe(0);
    expect(p.earned).toEqual([]);
    expect(p.locked).toHaveLength(RECOGNITION_RULES.length);
  });

  it("every input is quality-gated: unaccepted reports contribute nothing even when detailed and located", () => {
    const pretty = inc({ status: "reported", custody: [], summary: "Very detailed summary well over forty characters long.", attachments: [{ id: "a", fileName: "p.jpg", mimeType: "image/jpeg", byteSize: 1, caption: null, addedAt: "2026-10-04T10:00:00Z", sourceAttribution: null, sensitive: false }] });
    const p = stewardshipProgress([pretty], "Maya");
    expect(p.score).toBe(0);
    expect(p.nextMilestone).toContain("accepted into a response");
  });

  it("score is capped: saturation at max, more volume changes nothing", () => {
    const a = stewardshipProgress(saturated(), "Maya", { tutorialsCompleted: 2 });
    const b = stewardshipProgress([...saturated(), ...saturated()], "Maya", { tutorialsCompleted: 2 });
    expect(a.score).toBe(MAX_SCORE);
    expect(b.score).toBe(MAX_SCORE);
    expect(a.level).toBe(5);
    expect(a.scoreForNextLevel).toBeNull();
    expect(a.nextMilestone).toBeNull();
  });

  it("training input is capped and ignored when absent", () => {
    const one = inc();
    expect(stewardshipProgress([one], "Maya", { tutorialsCompleted: 3 }).score).toBe(
      stewardshipProgress([one], "Maya", { tutorialsCompleted: 50 }).score
    );
    expect(stewardshipProgress([one], "Maya").score).toBe(stewardshipProgress([one], "Maya", { tutorialsCompleted: 0 }).score);
  });

  it("is deterministic: same inputs, same output", () => {
    const data = saturated();
    expect(stewardshipProgress(data, "Maya")).toEqual(stewardshipProgress(data, "Maya"));
    // Fresh computations produce equal results (no hidden state).
    expect(stewardshipProgress(data, "Maya")).toEqual(stewardshipProgress([...data], "Maya"));
  });

  it("level thresholds progress through 1–5 with honest next-level info", () => {
    const none = stewardshipProgress([], "Maya");
    expect(none.level).toBe(1);
    expect(none.scoreForNextLevel).toBe(8);
    expect(none.scoreIntoLevel).toBe(0);

    const mid = stewardshipProgress(saturated(), "Maya", { tutorialsCompleted: 2 });
    expect(mid.level).toBe(5);
  });

  it("no rule description, gate, or milestone mentions speed or volume ranking", () => {
    const forbidden = ["fastest", "most cases", "most reports", "leaderboard", "top responder"];
    const samples = [
      ...RECOGNITION_RULES.map((r) => r.description),
      ...STEWARDSHIP_INPUTS.map((i) => i.gate),
      stewardshipProgress([], "Maya").nextMilestone ?? "",
      stewardshipProgress(saturated(), "Maya", { tutorialsCompleted: 2 }).nextMilestone ?? "",
    ];
    for (const text of samples) {
      const lower = text.toLowerCase();
      for (const f of forbidden) expect(lower).not.toContain(f);
    }
  });
});
