/** 0.3 theme system regressions: new themes complete, materials, mono contrast. */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";

const css = readFileSync("src/styles/tokens.css", "utf-8");
const STATUSES = ["draft","reported","response_requested","responder_assigned","awaiting_pickup","in_transport","transferred","in_care","veterinary_care","monitoring","released","deceased","closed","cancelled"];

const DARK_THEMES = ["forest-night", "midnight-ops", "storm", "aurora"];
const LIGHT_THEMES = ["sand", "arctic"];

describe("0.3 theme expansion", () => {
  it("every new dark theme defines the full token set + per-status colors", () => {
    for (const theme of DARK_THEMES) {
      const start = css.indexOf(`[data-theme="${theme}"] {`);
      expect(start).toBeGreaterThan(0);
      const end = css.indexOf("\n}", start);
      const block = css.slice(start, end);
      for (const token of ["--c-bg", "--c-surface", "--c-surface-alt", "--c-primary", "--c-border", "--c-sidebar-active", "--c-focus"]) {
        expect(block.includes(`${token}:`), `${theme} ${token}`).toBe(true);
      }
      for (const st of STATUSES) {
        expect(block.includes(`--status-${st}-bg:`), `${theme} status ${st}`).toBe(true);
        expect(block.includes(`--status-${st}-fg:`), `${theme} status ${st}`).toBe(true);
        expect(block.includes(`--status-${st}-border:`), `${theme} status ${st}`).toBe(true);
      }
      // ambient layers exist
      expect(css.includes(`[data-theme="${theme}"] body::before`)).toBe(true);
    }
  });

  it("new dark themes keep distinct status identities (no two identical bg/fg/border)", () => {
    for (const theme of DARK_THEMES) {
      const start = css.indexOf(`[data-theme="${theme}"] {`);
      const end = css.indexOf("\n}", start);
      const block = css.slice(start, end);
      const triples = new Set<string>();
      for (const st of STATUSES) {
        const bg = block.match(new RegExp(`--status-${st}-bg: ([^;]+);`))?.[1];
        const fg = block.match(new RegExp(`--status-${st}-fg: ([^;]+);`))?.[1];
        const bo = block.match(new RegExp(`--status-${st}-border: ([^;]+);`))?.[1];
        triples.add(`${bg}|${fg}|${bo}`);
      }
      expect(triples.size, theme).toBeGreaterThanOrEqual(12);
    }
  });

  it("light themes sand and arctic define core tokens", () => {
    for (const theme of LIGHT_THEMES) {
      expect(css.includes(`[data-theme="${theme}"] {`)).toBe(true);
    }
  });

  it("window material system: frosted/glass translucent surfaces, data stays readable, reduced-transparency fallback", () => {
    expect(css.includes('[data-material="frosted"]')).toBe(true);
    expect(css.includes('[data-material="glass"]')).toBe(true);
    expect(css.includes("backdrop-filter: blur(var(--material-blur))")).toBe(true);
    // dense data keeps solid background
    expect(css.includes('[data-material="glass"] .ops-table-wrap')).toBe(true);
    expect(css.match(/\[data-material="glass"\] \.ops-table-wrap[\s\S]{0,200}?backdrop-filter: none/)).toBeTruthy();
    expect(css.includes("prefers-reduced-transparency")).toBe(true);
  });

  it("monochrome dark surfaces are more separated than before (legibility)", () => {
    const start = css.lastIndexOf('[data-theme="mono-dark"] {');
    const end = css.indexOf("\n}", start);
    const block = css.slice(start, end);
    const bg = block.match(/--c-bg: (#\w+)/)?.[1];
    const surface = block.match(/--c-surface: (#\w+)/)?.[1];
    const alt = block.match(/--c-surface-alt: (#\w+)/)?.[1];
    expect(bg).toBe("#000000");
    expect(surface).toBe("#141414");
    expect(alt).toBe("#1f1f1f");
    expect(block.match(/--c-border: (#\w+)/)?.[1]).toBe("#3a3a3a");
  });

  it("monochrome keeps status glyphs (shape, not color) for every status", () => {
    const start = css.indexOf('[data-theme="mono-dark"]');
    const block = css.slice(start, css.indexOf("mono-light"));
    for (const st of STATUSES) {
      expect(block.includes(`.badge[data-status="${st}"]::before`), `glyph ${st}`).toBe(true);
    }
  });
});
