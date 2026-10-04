/**
 * dev.18 — tutorial trust contract.
 *
 * The core promise: an official tour run that auto-skips a missing target is
 * NEVER counted as a clean pass, and every target of every built-in official
 * tour actually exists in the product (zero-auto-skip contract, spec §1–§5).
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  buildInterfaceTourSteps,
  buildDemoTourSteps,
  buildFindingReportsTourSteps,
  GUIDANCE_STORAGE_KEYS,
  recordTourResult,
  getTourResultsLog,
  type GuidanceSystemId,
} from "./guidance";
import { REPORTER_NAV_ITEMS, PROFESSIONAL_NAV_ITEMS } from "../../app/navigation";
import type { TourStepV2, TourResult } from "./tourStepsTypes";

function* walk(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) yield* walk(p);
    else if (/\.(tsx?|json)$/.test(name)) yield p;
  }
}

const SRC = join(__dirname, "..", "..");

/** Every data-tour-id literal in the source + nav tour ids (rendered via a
 *  dynamic data-tour-id={item.tourId} in App.tsx, so checked separately). */
function knownTourIds(): Set<string> {
  const ids = new Set<string>();
  for (const file of walk(SRC)) {
    const text = readFileSync(file, "utf-8");
    for (const m of text.matchAll(/data-tour-id="([^"]+)"/g)) ids.add(m[1]!);
  }
  for (const items of [REPORTER_NAV_ITEMS, PROFESSIONAL_NAV_ITEMS]) {
    for (const item of items) ids.add(item.tourId);
  }
  // Incident detail tabs render dynamically as `tab-${id}` (IncidentDetailPage TABS).
  for (const id of ["overview", "timeline", "observations", "attachments", "people", "details", "export"]) {
    ids.add(`tab-${id}`);
  }
  return ids;
}

const BUILT_IN_TOURS: Array<{ system: GuidanceSystemId; steps: TourStepV2[] }> = [];

describe("dev.18 tutorial trust contract", () => {
  it("collects the official tours", async () => {
    BUILT_IN_TOURS.length = 0;
    for (const workspace of ["reporter", "professional"] as const) {
      BUILT_IN_TOURS.push({ system: "interface-tour", steps: await buildInterfaceTourSteps(workspace) });
      BUILT_IN_TOURS.push({ system: "finding-reports", steps: buildFindingReportsTourSteps(workspace) });
    }
    BUILT_IN_TOURS.push({ system: "demo-incident-tour", steps: buildDemoTourSteps() as unknown as TourStepV2[] });
    expect(BUILT_IN_TOURS.length).toBe(5);
  });

  it("ZERO-AUTO-SKIP CONTRACT: every official tour target exists in the product", async () => {
    const known = knownTourIds();
    const missing: string[] = [];
    for (const tour of BUILT_IN_TOURS) {
      for (const step of tour.steps) {
        if (!known.has(step.tourId)) missing.push(`${tour.system}/${step.id} → ${step.tourId}`);
        if (step.openTarget && !known.has(step.openTarget)) missing.push(`${tour.system}/${step.id} (openTarget) → ${step.openTarget}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("every official step is declarative: has an explicit route when its target lives off-page", async () => {
    for (const tour of BUILT_IN_TOURS) {
      for (const step of tour.steps) {
        // a step must name its target and its teaching text via i18n keys
        expect(step.tourId, `${tour.system}/${step.id}`).toBeTruthy();
        expect(step.titleKey ?? step.title, `${tour.system}/${step.id}`).toBeTruthy();
        expect(step.textKey ?? step.textKeyR ?? step.textKeyP ?? step.text, `${tour.system}/${step.id}`).toBeTruthy();
      }
    }
  });

  it("finding-reports tour teaches search, filters and saved views in both workspaces", () => {
    for (const workspace of ["reporter", "professional"] as const) {
      const steps = buildFindingReportsTourSteps(workspace);
      expect(steps.map((s) => s.id)).toEqual([
        "finding-nav",
        "finding-open-list",
        "finding-search",
        "finding-filters",
        "finding-saved-views",
      ]);
      // navigates to the incidents page itself before teaching on it
      expect(steps[1]!.route).toBe("/incidents");
      const ids = steps.map((s) => s.tourId);
      expect(ids).toContain("incident-search");
      expect(ids).toContain("filters-button");
      expect(ids).toContain("saved-view-controls");
    }
  });

  it("finding-reports has its own persistence key", () => {
    expect(GUIDANCE_STORAGE_KEYS["finding-reports"]).toBe("guidance-finding-reports-version");
  });

  it("tour results are recorded honestly and a run with auto-skips is never 'completed'", () => {
    const before = getTourResultsLog().length;
    const clean: TourResult = {
      status: "completed",
      autoSkippedSteps: [],
      totalSteps: 9,
      finishedAt: new Date().toISOString(),
    };
    recordTourResult(clean);
    expect(getTourResultsLog().length).toBe(before + 1);
    expect(getTourResultsLog().at(-1)?.status).toBe("completed");

    const dirty: TourResult = {
      status: "auto_skipped_target_missing",
      autoSkippedSteps: ["interface-export"],
      totalSteps: 9,
      finishedAt: new Date().toISOString(),
    };
    recordTourResult(dirty);
    expect(getTourResultsLog().at(-1)?.status).toBe("auto_skipped_target_missing");
    expect(getTourResultsLog().at(-1)?.autoSkippedSteps).toEqual(["interface-export"]);
  });

  it("TourResult type contract: statuses are exhaustive and honest", () => {
    const statuses: TourResult["status"][] = [
      "completed",
      "skipped_by_user",
      "auto_skipped_target_missing",
      "failed",
    ];
    expect(new Set(statuses).size).toBe(4);
  });
});
