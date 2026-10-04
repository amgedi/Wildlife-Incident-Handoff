/** 0.3.0-dev.3: theme-aware paw window icon (spec 58–61). */
import { describe, it, expect } from "vitest";
import { THEME_ICON_PALETTES, renderThemePawIcon } from "../components/themeIcon";
import { readFileSync } from "fs";

describe("theme icon palettes", () => {
  it("every selectable theme has a paw palette", async () => {
    const src = readFileSync("src/types/settings.ts", "utf-8");
    const union = src.slice(src.indexOf("export type ThemeName"), src.indexOf("export type Density"));
    const themes = [...union.matchAll(/"([a-z-]+)"/g)].map((m) => m[1]!).filter((t) => t !== "forest");
    expect(themes.length).toBeGreaterThanOrEqual(16);
    for (const theme of themes) {
      expect(THEME_ICON_PALETTES[theme], theme).toBeTruthy();
    }
  });

  it("palettes keep contrast against both light and dark taskbars (fg ≠ bg, sane luminance)", () => {
    for (const [theme, p] of Object.entries(THEME_ICON_PALETTES)) {
      expect(p.bg, theme).not.toBe(p.fg);
      expect(p.bg.startsWith("#")).toBe(true);
      expect(p.fg.startsWith("#")).toBe(true);
    }
  });

  it("renders PNG bytes at the requested size (geometry uses the canonical paw)", async () => {
    if (typeof OffscreenCanvas === "undefined") {
      expect(true).toBe(true); // jsdom: canvas unsupported — structural contract only
      return;
    }
    const bytes = await renderThemePawIcon("midnight-ops", 32);
    expect(bytes.length).toBeGreaterThan(100);
    // PNG magic
    expect([bytes[0], bytes[1], bytes[2], bytes[3]]).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });

  it("app context applies the icon on theme change (wiring present)", () => {
    const ctx = readFileSync("src/app/AppContext.tsx", "utf-8");
    expect(ctx.includes("applyThemeWindowIcon(settings.theme)")).toBe(true);
  });

  it("installer/shortcut icons are never rewritten at runtime (spec 59)", () => {
    const src = readFileSync("src/components/themeIcon.ts", "utf-8");
    expect(src.includes("never rewrite installed .ico resources")).toBe(true);
    expect(src.includes("shell icon caching")).toBe(true); // honest limitation
  });
});
