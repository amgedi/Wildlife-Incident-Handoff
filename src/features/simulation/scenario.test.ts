/**
 * Tests for the seeded simulated work environment (0.3, spec items 31–43).
 * Determinism is the core contract: same role + intensity + seed must
 * produce an equivalent world, every time.
 */
import { describe, expect, it } from "vitest";
import type { Incident } from "../../types/incident";
import {
  CANONICAL_STATUSES,
  INTENSITY_COUNTS,
  REGION_CENTER,
  REGION_SPAN,
  advanceScenario,
  generateScenario,
} from "./scenario";
import { buildDemoIncidents } from "../tutorial/demoData";

const BASE = "2026-03-15T14:00:00.000Z";

function make(role: "rehabilitator" | "field_responder" | "dispatcher" | "transport" | "general", intensity: "quiet" | "normal" | "busy" | "surge", seed = 42) {
  return generateScenario({ role, intensity, seed, now: BASE });
}

function signature(incidents: Incident[]) {
  // Times are relative to the scenario clock (defaults to now), so wall-clock
  // fields are excluded from the identity signature; ordering is checked.
  return incidents.map((i) => ({
    id: i.id,
    ref: i.humanReference,
    status: i.status,
    lat: i.location.latitude,
    lon: i.location.longitude,
  }));
}

describe("generateScenario determinism", () => {
  it("same role+intensity+seed produces deeply equivalent ids/refs/statuses/coords", () => {
    const a = make("dispatcher", "busy", 7);
    const b = make("dispatcher", "busy", 7);
    expect(signature(a.incidents)).toEqual(signature(b.incidents));
    expect(a.incidents).toEqual(b.incidents);
    expect(a.serviceArea).toEqual(b.serviceArea);
    expect(a.activity).toEqual(b.activity);
    expect(a.baseNow).toBe(b.baseNow);
  });

  it("different seeds produce different worlds", () => {
    const a = make("dispatcher", "normal", 1);
    const b = make("dispatcher", "normal", 2);
    expect(signature(a.incidents)).not.toEqual(signature(b.incidents));
  });

  it("advanceScenario is deterministic and equals regeneration with now+minutes", () => {
    const base = make("rehabilitator", "normal", 9);
    const advanced1 = advanceScenario(base, 15);
    const advanced2 = advanceScenario(base, 15);
    expect(advanced1.incidents).toEqual(advanced2.incidents);
    const regenerated = generateScenario({
      role: base.role,
      intensity: base.intensity,
      seed: base.seed,
      now: new Date(Date.parse(BASE) + 15 * 60_000).toISOString(),
    });
    expect(advanced1.incidents).toEqual(regenerated.incidents);
    expect(Date.parse(advanced1.baseNow)).toBe(Date.parse(BASE) + 15 * 60_000);
  });
});

describe("intensity counts", () => {
  for (const [intensity, [min, max]] of Object.entries(INTENSITY_COUNTS)) {
    it(`${intensity} produces between ${min} and ${max} incidents`, () => {
      const s = make("general", intensity as "quiet" | "normal" | "busy" | "surge", 123);
      expect(s.incidents.length).toBeGreaterThanOrEqual(min);
      expect(s.incidents.length).toBeLessThanOrEqual(max);
    });
  }
});

describe("region and location realism", () => {
  it("coordinates stay inside the fictional region", () => {
    const s = make("general", "surge", 55);
    for (const inc of s.incidents) {
      expect(inc.location.latitude).not.toBeNull();
      expect(inc.location.longitude).not.toBeNull();
      expect(Math.abs(inc.location.latitude! - REGION_CENTER.lat)).toBeLessThanOrEqual(REGION_SPAN / 2 + 0.01);
      expect(Math.abs(inc.location.longitude! - REGION_CENTER.lon)).toBeLessThanOrEqual(REGION_SPAN / 2 + 0.01);
      const acc = inc.location.accuracyMeters ?? -1;
      expect(acc).toBeGreaterThanOrEqual(5);
      expect(acc).toBeLessThanOrEqual(50);
    }
  });

  it("precision is mostly approximate with some exact and a couple sensitive", () => {
    const s = make("general", "busy", 77);
    const counts = { approximate: 0, exact: 0, sensitive: 0 };
    for (const inc of s.incidents) {
      const p = inc.location.precision!;
      counts[p] = (counts[p] ?? 0) + 1;
    }
    expect(counts.approximate).toBeGreaterThan(counts.exact);
    expect(counts.exact).toBeGreaterThan(0);
    expect(counts.sensitive).toBeGreaterThan(0);
    expect(counts.sensitive).toBeLessThanOrEqual(3);
  });
});

describe("spec 36 variety", () => {
  it("contains a duplicate pair with matching description/place and a similarity flag", () => {
    const s = make("dispatcher", "busy", 42);
    const flagged = s.incidents.filter((i) => i.integritySignals?.some((sig) => sig.key === "similar_to_recent_report"));
    expect(flagged).toHaveLength(1);
    const dup = flagged[0]!;
    const tagDuplicates = s.incidents.filter((i) => i.tags.includes("duplicate pair"));
    expect(tagDuplicates).toHaveLength(2);
    const twin = tagDuplicates.find((i) => i.id !== dup.id)!;
    expect(twin.summary).toBe(dup.summary);
    expect(twin.location.description).toBe(dup.location.description);
    expect(Math.abs(Date.parse(dup.createdAt) - Date.parse(twin.createdAt))).toBeLessThanOrEqual(3 * 60_000);
  });

  it("has an old unassigned report older than 2 hours for dispatcher at busy", () => {
    const s = make("dispatcher", "busy", 42);
    const old = s.incidents.find(
      (i) => i.status === "reported" && Date.parse(s.baseNow) - Date.parse(i.createdAt) > 2 * 60 * 60_000,
    );
    expect(old).toBeDefined();
    const ageHours = (Date.parse(s.baseNow) - Date.parse(old!.createdAt)) / 3_600_000;
    expect(ageHours).toBeGreaterThan(2);
    expect(ageHours).toBeLessThan(72);
  });

  it("has a handoff-pending case (handoff with no completedAt)", () => {
    const s = make("dispatcher", "busy", 42);
    const pending = s.incidents.filter((i) => i.handoffs.some((h) => h.completedAt === null));
    expect(pending.length).toBeGreaterThanOrEqual(1);
  });

  it("has closed/released cases, fresh reports, unknown species and missing-media cases", () => {
    const s = make("general", "busy", 42);
    expect(s.incidents.some((i) => ["released", "closed"].includes(i.status))).toBe(true);
    expect(s.incidents.some((i) => Date.parse(s.baseNow) - Date.parse(i.createdAt) <= 15 * 60_000)).toBe(true);
    expect(s.incidents.some((i) => i.animal.species === null)).toBe(true); // unknown species
    expect(s.incidents.some((i) => i.attachments.length === 0)).toBe(true); // missing media
    expect(s.incidents.some((i) => i.attachments.length > 0)).toBe(true); // records with media
    const withObs = s.incidents.filter((i) => i.observations.length > 0).length;
    expect(withObs).toBeGreaterThan(s.incidents.length / 2); // complete-ish records exist
  });
});

describe("whole world", () => {
  it("assignments use the fictional roster with holderRole Demo, handoffs go to fictional orgs", () => {
    const s = make("transport", "busy", 5);
    const custody = s.incidents.flatMap((i) => i.custody);
    expect(custody.length).toBeGreaterThan(0);
    const holderEntries = custody.filter((c) => c.holderRole === "Demo");
    expect(holderEntries.length).toBeGreaterThan(0);
    const orgs = s.incidents.flatMap((i) => i.handoffs.map((h) => h.toOrganization ?? ""));
    expect(orgs.some((o) => o.includes("(demo)"))).toBe(true);
  });

  it("timelines are consistent: created event first, timestamps monotonic, status matches", () => {
    const s = make("rehabilitator", "normal", 3);
    for (const inc of s.incidents) {
      expect(inc.timeline.length).toBeGreaterThanOrEqual(1);
      const created = inc.timeline[0]!;
      expect(created.eventType).toBe("incident_created");
      const times = inc.timeline.map((e) => Date.parse(e.timestamp));
      for (let i = 1; i < times.length; i++) {
        expect(times[i]!).toBeGreaterThanOrEqual(times[i - 1]!);
      }
      for (const e of inc.timeline) {
        expect(e.incidentId).toBe(inc.id);
        expect(e.actor === null || e.actor.length > 0).toBe(true);
      }
    }
  });

  it("includes observations, private notes, service area and activity events", () => {
    const s = make("field_responder", "normal", 11);
    expect(s.incidents.some((i) => i.notes.some((n) => n.kind === "private" && n.text.includes("fictional")))).toBe(true);
    expect(s.serviceArea.centerLat).toBeTypeOf("number");
    expect(s.serviceArea.radiusKm).toBeGreaterThan(0);
    expect(s.activity.length).toBe(s.incidents.length);
    expect(s.activity.every((a) => a.text.includes("fictional"))).toBe(true);
  });
});

describe("safety (spec 42)", () => {
  it("every record isDemo true, provenance demo, and unmistakably fictional", () => {
    for (const intensity of ["quiet", "normal", "busy", "surge"] as const) {
      const s = make("general", intensity, 2026);
      for (const inc of s.incidents) {
        expect(inc.isDemo).toBe(true);
        expect(inc.provenance).toBe("demo");
        expect(/fictional|demo/i.test(inc.summary ?? "")).toBe(true);
        for (const h of inc.handoffs) expect(h.toOrganization ?? "").toMatch(/\(demo\)/);
      }
    }
  });
});

describe("statuses and roles", () => {
  it("no status outside the canonical set", () => {
    for (const role of ["rehabilitator", "field_responder", "dispatcher", "transport", "general"] as const) {
      const s = make(role, "surge", 31);
      for (const inc of s.incidents) expect(CANONICAL_STATUSES).toContain(inc.status);
    }
  });

  it("rehabilitator world has more in-care/transferred cases than dispatcher world", () => {
    const rehab = make("rehabilitator", "surge", 8).incidents;
    const dispatch = make("dispatcher", "surge", 8).incidents;
    const careCount = (list: Incident[]) => list.filter((i) => ["in_care", "veterinary_care", "monitoring", "transferred"].includes(i.status)).length;
    expect(careCount(rehab)).toBeGreaterThan(careCount(dispatch));
  });
});

describe("demoData compatibility wrapper", () => {
  it("buildDemoIncidents still returns stable, clearly-demo incidents", () => {
    const a = buildDemoIncidents();
    const b = buildDemoIncidents();
    expect(signature(a)).toEqual(signature(b));
    expect(a.length).toBeGreaterThanOrEqual(INTENSITY_COUNTS.quiet[0]);
    expect(a.every((i) => i.isDemo && i.provenance === "demo")).toBe(true);
  });
});
