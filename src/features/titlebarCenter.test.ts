/** 0.3.0-dev.3: titlebar search is GEOMETRICALLY centered (spec 49–50). */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";

describe("titlebar centering contract", () => {
  const css = readFileSync("src/styles/base.css", "utf-8");

  it("titlebar is a 1fr/auto/1fr grid so the center sits at 50% of the window", () => {
    const tb = css.slice(css.indexOf(".titlebar {"), css.indexOf("}", css.indexOf(".titlebar {")));
    expect(tb.includes("grid-template-columns: 1fr auto 1fr")).toBe(true);
  });

  it("brand and right group are pinned to their grid columns", () => {
    expect(css.includes(".titlebar-brand { display: flex; align-items: center; gap: 10px; padding-left: 12px; font-size: 0.85rem; font-weight: 600; justify-self: start; min-width: 0; }")).toBe(true);
    expect(css.includes(".titlebar-right { display: flex; align-items: center; justify-self: end; height: 100%; }")).toBe(true);
  });

  it("TitleBar renders exactly three top-level groups (left / center / right)", () => {
    const src = readFileSync("src/components/TitleBar.tsx", "utf-8");
    expect(src.includes('className="titlebar-brand"')).toBe(true);
    expect(src.includes('className="titlebar-center"')).toBe(true);
    expect(src.includes('className="titlebar-right"')).toBe(true);
    // bell and window controls live INSIDE the right group
    const rightIdx = src.indexOf('titlebar-right');
    const controlsIdx = src.indexOf('titlebar-controls');
    expect(controlsIdx).toBeGreaterThan(rightIdx);
  });

  it("no margin-left:auto hacks remain on the bell (they fight the grid)", () => {
    expect(css.includes(".titlebar-bell { display: flex; align-items: center; margin-left: auto")).toBe(false);
  });
});
