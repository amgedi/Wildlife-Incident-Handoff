/** 0.3.0-dev.3 material system V4 (spec 62–66, 75) + ambient coverage (67–74). */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";

const tokens = readFileSync("src/styles/tokens.css", "utf-8");

describe("material V4 recipe", () => {
  it("frosted and glass define the full layered recipe (blur+saturation, tint, highlight, grain, edge, depth shadows)", () => {
    for (const mat of ["frosted", "glass"]) {
      const start = tokens.indexOf(`[data-material="${mat}"] {`);
      const block = tokens.slice(start, tokens.indexOf("}", start));
      expect(block.includes("saturate("), mat).toBe(true);
      expect(block.includes("--material-tint"), mat).toBe(true);
      expect(block.includes("--material-highlight"), mat).toBe(true);
      expect(block.includes("--material-grain"), mat).toBe(true);
      expect(block.includes("--material-edge"), mat).toBe(true);
    }
    expect(tokens.includes("--material-shadow-lift")).toBe(true);
  });

  it("three depth levels exist: base surface, elevated panel, floating", () => {
    for (const v of ["--material-surface", "--material-panel", "--material-floating"]) {
      expect(tokens.includes(v)).toBe(true);
    }
    // elevated + floating get stronger shadow
    expect(tokens.includes(".rflow-drawer,\n[data-material=\"frosted\"] .combo-pop")).toBe(true);
    expect(tokens.includes('[data-material="frosted"] .palette')).toBe(true);
  });

  it("dense data (tables) keeps solid background in every material (spec 66/34)", () => {
    expect(/\[data-material="glass"\] \.ops-table-wrap[\s\S]{0,200}?backdrop-filter: none/.test(tokens)).toBe(true);
  });

  it("reduced-transparency neutralizes the whole recipe, not just blur", () => {
    const m = tokens.match(/prefers-reduced-transparency[\s\S]{0,900}/)![0];
    expect(m.includes("--material-grain: none")).toBe(true);
    expect(m.includes("--material-highlight: transparent")).toBe(true);
  });

  it("theme transitions respect motion preferences (spec 75)", () => {
    expect(tokens.includes('[data-motion="full"] .card')).toBe(true);
    expect(tokens.includes('[data-motion="off"] .card,\n[data-motion="off"] .ops-panel,\n[data-motion="off"] .sidebar,\n[data-motion="off"] .titlebar {\n  transition: none;\n}')).toBe(true);
  });
});

describe("ambient coverage (spec 67–74)", () => {
  it("every expressive theme defines its own ambient layers", () => {
    // forest-dark is the :root default (unprefixed selector)
    expect(tokens.includes("body::before {")).toBe(true);
    const expressive = ["forest-light", "midnight", "warm-field", "moss", "ocean", "slate", "forest-night", "midnight-ops", "storm", "aurora", "sand", "arctic"];
    for (const theme of expressive) {
      expect(tokens.includes(`[data-theme="${theme}"] body::before`), theme).toBe(true);
      expect(tokens.includes(`[data-theme="${theme}"] body::after`), theme).toBe(true);
    }
  });

  it("ambient animation is slow and GPU-friendly (no flashing)", () => {
    expect(tokens.includes("wih-ambient-a 90s")).toBe(true);
    expect(tokens.includes("wih-ambient-b 110s")).toBe(true);
  });

  it("monochrome explicitly removes ambient decoration (content: none)", () => {
    expect(tokens.includes('content: none; /* no ambient decoration on monochrome themes */')).toBe(true);
  });
});
