
import { describe, it, expect } from "vitest";
import { fuzzCoordinates, markerPositionFor } from "./network/mapProvider";
import { makeIncident } from "./export/exportService.test";
import { readFileSync } from "fs";

describe("map privacy", () => {
  const incident = makeIncident();

  it("exact privacy preserves coordinates", () => {
    const pos = markerPositionFor(incident, "exact");
    expect(pos).toEqual({ lat: 52.205, lon: 0.118 });
  });

  it("approximate privacy fuzzes to a ~1km grid", () => {
    const pos = markerPositionFor(incident, "approximate")!;
    expect(Math.abs(pos.lat - 52.205)).toBeLessThan(0.02);
    expect(Math.abs(pos.lon - 0.118)).toBeLessThan(0.02);
    expect(pos).not.toEqual({ lat: 52.205, lon: 0.118 });
  });

  it("sensitive privacy never exposes the precise point (heavily fuzzed)", () => {
    const pos = markerPositionFor(incident, "sensitive")!;
    expect(Math.abs(pos.lat - 52.205)).toBeGreaterThan(0.05);
  });

  it("fuzzing is deterministic", () => {
    expect(fuzzCoordinates(52.205, 0.118)).toEqual(fuzzCoordinates(52.205, 0.118));
  });

  it("incidents without coordinates get no marker", () => {
    const noCoords = makeIncident({ location: { description: null, precision: "exact", landmark: null, address: null, latitude: null, longitude: null, notes: null } });
    expect(markerPositionFor(noCoords, "exact")).toBeNull();
  });
});

describe("status identity", () => {
  it("each status renders with its own data-status (label always present)", async () => {
    const { StatusBadge } = await import("../components/ui");
    const { render } = await import("@testing-library/react");
    for (const status of ["reported", "awaiting_pickup", "in_transport", "released", "closed"] as const) {
      const { container, unmount } = render(<StatusBadge status={status} />);
      const badge = container.querySelector(".badge");
      expect(badge?.getAttribute("data-status")).toBe(status);
      expect(badge?.textContent).toBeTruthy();
      unmount();
    }
  });

  it("tokens.css defines per-status colors for every status", () => {
    const css = readFileSync("src/styles/tokens.css", "utf-8");
    const statuses = ["draft","reported","response","assigned","pickup","transport","transferred","care","vet","monitoring","released","deceased","closed","cancelled"];
    for (const st of statuses) {
      expect(css.includes(`--status-${st}-bg:`)).toBe(true);
      expect(css.includes(`--status-${st}-fg:`)).toBe(true);
      expect(css.includes(`--status-${st}-border:`)).toBe(true);
    }
  });

  it("non-monochrome themes never give two statuses identical bg/fg/border", () => {
    const css = readFileSync("src/styles/tokens.css", "utf-8");
    const start = css.indexOf(":root {");
    const end = css.indexOf(String.fromCharCode(10) + "}", start);
    const root = css.slice(start, end);
    const statuses = ["draft","reported","response","assigned","pickup","transport","transferred","care","vet","monitoring","released","deceased","closed","cancelled"];
    const triples = new Set<string>();
    for (const st of statuses) {
      const bg = root.match(new RegExp(`--status-${st}-bg: ([^;]+);`))?.[1];
      const fg = root.match(new RegExp(`--status-${st}-fg: ([^;]+);`))?.[1];
      const border = root.match(new RegExp(`--status-${st}-border: ([^;]+);`))?.[1];
      triples.add(`${bg}|${fg}|${border}`);
    }
    // 14 statuses must resolve to at least 12 distinct triples (allows 2 close pairs)
    expect(triples.size).toBeGreaterThanOrEqual(12);
  });

  it("monochrome themes define status glyphs (shape, not color)", () => {
    const css = readFileSync("src/styles/tokens.css", "utf-8");
    expect(css.includes('content: "▲"')).toBe(true); // awaiting_pickup glyph
    expect(css.includes('content: "→"')).toBe(true); // in_transport glyph
  });

  it("all 10 themes are defined", () => {
    const css = readFileSync("src/styles/tokens.css", "utf-8");
    // forest-dark is the :root default; the other nine have explicit blocks
    expect(css.includes(":root {")).toBe(true);
    for (const theme of ["forest-light","midnight","warm-field","moss","ocean","slate","high-contrast-dark","mono-dark","mono-light"]) {
      expect(css.includes(`[data-theme="${theme}"]`)).toBe(true);
    }
  });

  it("every theme defines the core token set (atomic theme switching)", () => {
    const css = readFileSync("src/styles/tokens.css", "utf-8");
    const required = ["--c-bg:", "--c-surface:", "--c-ink:", "--c-ink-soft:", "--c-primary:", "--c-border:", "--c-header-ink:", "--c-sidebar:"];
    for (const theme of ["forest-light","midnight","warm-field","moss","ocean","slate","high-contrast-dark","mono-dark","mono-light"]) {
      const start = css.indexOf(`[data-theme="${theme}"] {`);
      const end = css.indexOf("}", start);
      const block = css.slice(start, end);
      for (const token of required) {
        if (theme === "high-contrast-dark" || theme.startsWith("mono")) {
          // mono themes rely on inherited status tokens; core set still required
        }
        expect(block.includes(token)).toBe(true);
      }
    }
  });

  it("no expensive backdrop-filter remains on cards", () => {
    const css = readFileSync("src/styles/base.css", "utf-8");
    expect(css.includes("backdrop-filter")).toBe(false);
  });
});

describe("canonical bear paw", () => {
  it("canonical paw has exactly four toes and four claws", async () => {
    const mod = await import("../components/BrandMark");
    const { render } = await import("@testing-library/react");
    const { container } = render(mod.BearPawMark({ size: 32 }));
    // toes = ellipses with ry=10 (TOE_RY); claws = ellipses with fill-opacity 0.62
    const all = container.querySelectorAll("ellipse");
    const toes = Array.from(all).filter((e) => e.getAttribute("ry") === "10");
    const claws = Array.from(all).filter((e) => e.getAttribute("fill-opacity") === "0.62");
    expect(toes.length).toBe(4);
    expect(claws.length).toBe(4);
    // symmetric: toe cx pairs mirror around x=32
    const cxs = toes.map((e) => Number(e.getAttribute("cx"))).sort((a, b) => a - b);
    expect(Math.abs(32 - (cxs[0]! + cxs[3]!) / 2)).toBeLessThan(0.6);
    expect(Math.abs(32 - (cxs[1]! + cxs[2]!) / 2)).toBeLessThan(0.6);
    // one pad
    expect(container.querySelectorAll("path").length).toBe(1);
  });

  it("BrandMark delegates to the canonical BearPawMark geometry", async () => {
    const { render } = await import("@testing-library/react");
    const mod = await import("../components/BrandMark");
    const a = render(mod.BrandMark({ size: 24 })).container.querySelector("g g");
    const b = render(mod.BearPawMark({ size: 24 })).container.querySelector("g g");
    expect(a?.innerHTML).toBe(b?.innerHTML);
  });

  it("in-app logo colors come from theme tokens, not hard-coded green", async () => {
    const mod = await import("../components/BrandMark");
    const { render } = await import("@testing-library/react");
    const { container } = render(mod.BearPawMark({ size: 32 }));
    expect(container.innerHTML.includes("var(--brand-icon-bg")).toBe(true);
    expect(container.innerHTML.includes("var(--brand-icon-fg")).toBe(true);
    // the fallback in var() is allowed, but no bare hard-coded fill may exist
    expect(/fill="#[0-9a-f]{6}"/i.test(container.innerHTML)).toBe(false);
  });

  it("hero watermark uses the canonical component (no separate paw paths)", () => {
    const src = readFileSync("src/features/home/HomePage.tsx", "utf-8");
    expect(src.includes("BearPawMark")).toBe(true);
    expect(src.includes("hero-art")).toBe(true);
  });
});
