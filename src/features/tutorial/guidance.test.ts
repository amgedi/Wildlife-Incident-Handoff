import { describe, it, expect } from "vitest";
import {
  GUIDANCE_STORAGE_KEYS,
  GUIDANCE_VERSION,
  isGuidanceComplete,
  markGuidanceComplete,
  buildInterfaceTourSteps,
  buildDemoTourSteps,
} from "./guidance";
import { REPORTER_NAV_ITEMS, PROFESSIONAL_NAV_ITEMS, FOOTER_NAV_ITEMS } from "../../app/navigation";
import type { TourStepV2 } from "./tourStepsTypes";

describe("guidance systems are architecturally separate", () => {
  it("has a distinct persistence key per system", () => {
    const keys = Object.values(GUIDANCE_STORAGE_KEYS);
    expect(new Set(keys).size).toBe(keys.length);
    expect(GUIDANCE_STORAGE_KEYS["interface-tour"]).not.toBe(GUIDANCE_STORAGE_KEYS["guided-first-incident"]);
    expect(GUIDANCE_STORAGE_KEYS["interface-tour"]).not.toBe(GUIDANCE_STORAGE_KEYS["demo-incident-tour"]);
  });

  it("completing one system does not complete another", async () => {
    await markGuidanceComplete("interface-tour");
    expect(await isGuidanceComplete("interface-tour")).toBe(true);
    expect(await isGuidanceComplete("guided-first-incident")).toBe(false);
    expect(await isGuidanceComplete("demo-incident-tour")).toBe(false);
    await markGuidanceComplete("demo-incident-tour");
    expect(await isGuidanceComplete("interface-tour")).toBe(true);
    expect(await isGuidanceComplete("demo-incident-tour")).toBe(true);
    expect(await isGuidanceComplete("guided-first-incident")).toBe(false);
  });

  it("interface tour steps each declare id, target and (where needed) an explicit route", async () => {
    for (const workspace of ["reporter", "professional"] as const) {
      const steps: TourStepV2[] = await buildInterfaceTourSteps(workspace);
      expect(steps.length).toBeGreaterThanOrEqual(10);
      const ids = steps.map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length); // unique ids
      for (const s of steps) {
        expect(s.tourId).toBeTruthy();
        expect(s.titleKey || s.title).toBeTruthy();
        expect(s.textKey || s.textKeyR || s.textKeyP || s.text).toBeTruthy();
      }
    }
  });

  it("interface tour is workspace-aware and never shows professional tools to reporters", async () => {
    const reporterSteps = await buildInterfaceTourSteps("reporter");
    const proSteps = await buildInterfaceTourSteps("professional");
    const reporterText = reporterSteps.map((s) => s.id).join(",");
    expect(reporterText).not.toContain("interface-people");
    expect(proSteps.some((s) => s.id === "interface-people")).toBe(true);
    expect(reporterSteps.some((s) => s.id === "interface-status")).toBe(true);
  });

  it("demo tour is a different, short explanation", () => {
    const demo = buildDemoTourSteps();
    expect(demo).toHaveLength(3);
    const ids = demo.map((s) => s.id);
    expect(ids).toContain("demo-what");
    expect(ids.every((id) => id.startsWith("demo-"))).toBe(true);
  });

  it("guided-first-incident has its own key and version marker", () => {
    expect(GUIDANCE_STORAGE_KEYS["guided-first-incident"]).toBe("guidance-guided-incident-version");
    expect(GUIDANCE_VERSION).toBe(1);
  });
});

describe("workspace navigation separation", () => {
  it("reporter nav contains no professional destinations", () => {
    const paths = REPORTER_NAV_ITEMS.map((i) => i.to);
    expect(paths).not.toContain("/network");
    expect(paths).toContain("/incidents");
    expect(paths).toContain("/incidents/new");
  });

  it("low-frequency destinations live in the footer nav for both workspaces", () => {
    const footer = FOOTER_NAV_ITEMS.map((i) => i.to);
    expect(footer).toEqual(["/help", "/settings", "/profile"]);
    expect(REPORTER_NAV_ITEMS.map((i) => i.to)).not.toContain("/help");
    expect(PROFESSIONAL_NAV_ITEMS.map((i) => i.to)).not.toContain("/settings");
  });

  it("professional nav adds the response network", () => {
    const paths = PROFESSIONAL_NAV_ITEMS.map((i) => i.to);
    expect(paths).toContain("/network");
  });

  it("both workspaces use distinct tour ids on nav items", () => {
    const reporterIds = REPORTER_NAV_ITEMS.map((i) => i.tourId);
    const proIds = PROFESSIONAL_NAV_ITEMS.map((i) => i.tourId);
    expect(new Set(reporterIds).size).toBe(reporterIds.length);
    expect(new Set(proIds).size).toBe(proIds.length);
  });
});
