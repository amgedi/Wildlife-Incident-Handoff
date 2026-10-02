/**
 * Desktop shell regression tests (spec §20).
 * These assert structure + CSS contract. The REAL EXE geometry is verified
 * by scripts/shell-verify.mjs (see completion report).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";

const css = readFileSync("src/styles/base.css", "utf-8");

function ruleFor(selector: string): string {
  const idx = css.indexOf(selector);
  if (idx === -1) return "";
  const start = css.indexOf("{", idx);
  const end = css.indexOf("}", start);
  return css.slice(start + 1, end);
}

describe("desktop shell structure", () => {
  it("App renders TitleBar above .app-body (not inside the horizontal row)", async () => {
    const src = readFileSync("src/App.tsx", "utf-8");
    const shellStart = src.indexOf('className="app-shell"');
    const titlebarPos = src.indexOf("<TitleBar />", shellStart);
    const bodyPos = src.indexOf('className="app-body"', shellStart);
    expect(titlebarPos).toBeGreaterThan(-1);
    expect(bodyPos).toBeGreaterThan(titlebarPos);
  });

  it(".app-shell is a column with fixed viewport height and no window overflow", () => {
    const rule = ruleFor(".app-shell");
    expect(rule).toContain("flex-direction: column");
    expect(rule).toContain("height: 100dvh");
    expect(rule).toContain("overflow: hidden");
    expect(rule).not.toContain("100vw");
  });

  it(".app-body is a flex row that fills remaining space with min sizes", () => {
    const rule = ruleFor(".app-body");
    expect(rule).toContain("flex: 1 1 auto");
    expect(rule).toContain("min-width: 0");
    expect(rule).toContain("min-height: 0");
    expect(rule).toContain("display: flex");
  });

  it(".titlebar is a fixed-height full-width row (never a flexible sibling)", () => {
    const rule = ruleFor(".titlebar");
    expect(rule).toContain("flex: 0 0 38px");
    expect(rule).toContain("width: 100%");
  });

  it(".sidebar is a fixed-width flex item starting at the left, without 100vh", () => {
    const rule = ruleFor(".sidebar");
    expect(rule).toContain("flex: 0 0 232px");
    expect(rule).not.toContain("100vh");
    expect(rule).not.toContain("position: sticky");
  });

  it(".main-area takes remaining width with min-width 0 and owns vertical scrolling", () => {
    const rule = ruleFor(".main-area");
    expect(rule).toContain("flex: 1 1 auto");
    expect(rule).toContain("min-width: 0");
    expect(rule).toContain("overflow-y: auto");
  });

  it("TitleBar renders only inside Tauri (web never gets desktop chrome)", async () => {
    const src = readFileSync("src/components/TitleBar.tsx", "utf-8");
    expect(src.includes("if (!isTauri() || !api) return null;")).toBe(true);
  });

  it("window controls use normal right-aligned layout (no absolute positioning)", () => {
    const src = readFileSync("src/components/TitleBar.tsx", "utf-8");
    expect(src.includes("titlebar-controls")).toBe(true);
    expect(src.includes("position: absolute")).toBe(false);
    expect(src.includes(".focus()")).toBe(false);
  });
});
