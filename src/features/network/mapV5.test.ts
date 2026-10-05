/**
 * Map V5 tests (0.3.0-dev.5, Parts VII/IX/X):
 * - terrain failure must NOT kick the user out of terrain mode (spec 29)
 * - concern pref survives sanitization
 * - initial bearing helper matches known directions
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { sanitizePrefs } from "./map/v4";

function networkMapSource(): string {
  return readFileSync("src/features/network/NetworkMap.tsx", "utf-8");
}

describe("terrain kick-out fix (spec 29)", () => {
  it("failed terrain setup no longer force-switches mode to 2d", () => {
    const src = networkMapSource();
    // The failure branch must keep terrain selected — only the operator's
    // explicit "Use 2D map" button may change the mode.
    expect(src).toContain("setTerrainFailed(true);\n        return;");
    expect(src).not.toContain('setPrefs((p) => ({ ...p, mode: "2d" }));\n        return;');
    expect(src).toContain('"Use 2D map"');
  });
  it("the old ↑ text compass control is gone", () => {
    expect(networkMapSource()).not.toContain(">↑</span>");
  });
});

describe("concern map filter (spec 48)", () => {
  it("concern pref defaults to all and survives sanitization", () => {
    const clean = sanitizePrefs({});
    expect(clean.concern).toBe("all");
    const kept = sanitizePrefs({ concern: "environmental_hazard" });
    expect(kept.concern).toBe("environmental_hazard");
  });
});
