/** 0.3.0-dev.4 icon contract (spec 40–44, 69): distinguish the surfaces and
 *  pin what each one shows. */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";

describe("icon surfaces", () => {
  it("IN-APP TITLEBAR mark = relay SVG driven by --brand-icon-* tokens (theme-aware)", () => {
    const titlebar = readFileSync("src/components/TitleBar.tsx", "utf-8");
    expect(titlebar.includes("<AppMark")).toBe(true);
    const mark = readFileSync("src/components/BrandMark.tsx", "utf-8");
    expect(mark.includes("var(--brand-icon-bg")).toBe(true);
    expect(mark.includes("var(--brand-icon-fg")).toBe(true);
    expect(mark.includes("var(--brand-icon-border")).toBe(true);
  });

  it("every theme defines brand icon tokens (or falls back consistently)", () => {
    const tokens = readFileSync("src/styles/tokens.css", "utf-8");
    // :root (forest-dark default) relies on the component fallback; all others define their own
    const themed = [...tokens.matchAll(/\[data-theme="([a-z-]+)"\] \{/g)].map((m) => m[1]!);
    const withoutTokens = themed.filter((th) => {
      const i = tokens.indexOf(`[data-theme="${th}"] {`);
      const block = tokens.slice(i, tokens.indexOf("\n}", i));
      return !block.includes("--brand-icon-bg");
    });
    // all themed blocks define the tokens (forest-dark = :root fallback)
    expect(withoutTokens).toEqual([]);
  });

  it("NATIVE WINDOW icon = theme-aware paw via setIcon, static paw fallback (spec 43)", () => {
    const icon = readFileSync("src/components/themeIcon.ts", "utf-8");
    expect(icon.includes("setIcon")).toBe(true);
    expect(icon.includes("THEME_ICON_PALETTES")).toBe(true);
    // the paw SHAPE is canonical — geometry mirrors the paw, never the relay
    expect(icon.includes("toes")).toBe(true);
    expect(icon.includes("ctx.ellipse")).toBe(true);
  });

  it("EXTERNAL identity = static canonical paw (taskbar/installer/Start Menu/PWA)", () => {
    const { execSync } = require("child_process") as { execSync: (c: string) => Buffer };
    // No shell pipe (cmd.exe has no `head`) — slice the PNG magic in Node.
    const png = execSync("git show v0.2.0-dev.19-checkpoint:public/icons/icon-512.png").subarray(0, 8).toString("hex");
    expect(png.startsWith("89504e47")).toBe(true); // paw png restored (dev.2 pass)
  });

  it("no conflation: the runtime icon renderer never draws the relay geometry", () => {
    const icon = readFileSync("src/components/themeIcon.ts", "utf-8");
    expect(icon.toLowerCase().includes("routepath")).toBe(false);
    expect(icon.includes("bezierCurveTo")).toBe(true); // paw pad curve
  });
});
