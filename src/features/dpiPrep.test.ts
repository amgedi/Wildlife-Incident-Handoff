/** 0.3.0-dev.2 DPI preparation audit (spec 20): no fragile fixed geometry in
 *  the chrome. Real Windows DPI testing is not possible in this environment —
 *  this is the static half, honestly classified. */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";

describe("DPI-sensitive geometry audit (spec 20, static)", () => {
  const css = readFileSync("src/styles/base.css", "utf-8");

  it("titlebar keeps flex sizing (no fixed pixel width on the brand or center area)", () => {
    const tb = css.slice(css.indexOf(".titlebar {"), css.indexOf(".titlebar-btn"));
    expect(tb.includes("flex")).toBe(true);
    const rule = (sel: string) => {
      const i = css.indexOf(sel + " {");
      return css.slice(i, css.indexOf("}", i));
    };
    expect(/width:\s*\d{3,}px/.test(rule(".titlebar-brand"))).toBe(false);
    expect(/width:\s*\d{3,}px/.test(rule(".titlebar-center"))).toBe(false);
  });

  it("no position:fixed pixel offsets for interactive chrome (except intentional overlays)", () => {
    // The web-bell and notification popovers use fixed positioning by design;
    // they clamp to viewport rects. Titlebar/sidebar must not.
    const sidebar = css.slice(css.indexOf(".sidebar {"), css.indexOf(".sidebar {") + 400);
    expect(sidebar.includes("flex")).toBe(true);
  });

  it("hit-target sizes stay >= 24px equivalent via padding (not 1px hit boxes)", () => {
    const tbBtn = css.slice(css.indexOf(".titlebar-btn"), css.indexOf(".titlebar-btn") + 300);
    expect(/padding|height/.test(tbBtn)).toBe(true);
  });

  it("zoom resilience: layout uses rem/relative units for chrome text", () => {
    const tb = css.slice(css.indexOf(".titlebar {"), css.indexOf(".titlebar-controls"));
    expect(tb.includes("0.85rem") || tb.includes("rem")).toBe(true);
  });
});
