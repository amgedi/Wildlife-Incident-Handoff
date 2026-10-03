/** 0.2.0-dev.13: LAN sync merge policy (pure logic) + Help Q&A expansion. */
import { describe, it, expect } from "vitest";
import { mergeIncidents, snapshotFrom, incidentsFromPayload } from "./sync/lanSync";
import { makeIncident } from "./export/exportService.test";
import { readFileSync } from "fs";

describe("LAN sync merge (last writer wins on updatedAt)", () => {
  it("adds unknown non-demo records", () => {
    const a = makeIncident({ id: "a" });
    const b = makeIncident({ id: "b" });
    const r = mergeIncidents([a], [b]);
    expect(r.added).toBe(1);
    expect(r.merged.map((i) => i.id).sort()).toEqual(["a", "b"]);
  });

  it("overwrites only when the peer record is newer", () => {
    const local = makeIncident({ id: "x", updatedAt: "2026-10-03T10:00:00Z" });
    const newer = makeIncident({ id: "x", updatedAt: "2026-10-03T11:00:00Z", summary: "newer" });
    const older = makeIncident({ id: "x", updatedAt: "2026-10-03T09:00:00Z", summary: "older" });
    expect(mergeIncidents([local], [newer]).updated).toBe(1);
    expect(mergeIncidents([local], [older]).skipped).toBe(1);
    expect(mergeIncidents([local], [older]).merged[0]!.summary).toBe(local.summary);
  });

  it("never imports demo records", () => {
    const demo = makeIncident({ id: "d", isDemo: true });
    const r = mergeIncidents([], [demo]);
    expect(r.added).toBe(0);
    expect(r.skipped).toBe(1);
  });

  it("snapshot round-trips through the payload parser", () => {
    const incidents = [makeIncident({ id: "rt" })];
    const payload = snapshotFrom(incidents);
    expect(incidentsFromPayload(payload).map((i) => i.id)).toEqual(["rt"]);
    expect(incidentsFromPayload("not json")).toEqual([]);
  });
});

describe("help center Q&A expansion", () => {
  it("ships question-format articles in several categories", () => {
    const src = readFileSync("src/features/help/HelpPage.tsx", "utf-8");
    expect(src).toContain("Do I need an account?");
    expect(src).toContain("What do the marker shapes mean?");
    expect(src).toContain("Why do some metrics say");
    expect(src).toContain("How do I move my reports to a new computer?");
  });
});
