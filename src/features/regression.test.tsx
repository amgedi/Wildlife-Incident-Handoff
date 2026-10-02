
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
    const statuses = ["draft","response","assigned","pickup","transport","transferred","care","vet","monitoring","released","deceased","closed","cancelled","reported"];
    for (const st of statuses) {
      expect(css.includes(`--st-${st}:`)).toBe(true);
    }
    // every status maps to a token (spot-check the two renamed ones)
    expect(css.includes("--st-response:")).toBe(true); // response_requested
    expect(css.includes("--st-pickup:")).toBe(true);   // awaiting_pickup
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
  it("BrandMark renders exactly the same geometry as BearPawMark", async () => {
    const { render } = await import("@testing-library/react");
    const mod = await import("../components/BrandMark");
    const a = render(mod.BrandMark({ size: 24 } as never)).container.innerHTML;
    const b = render(mod.BearPawMark({ size: 24 } as never)).container.innerHTML;
    expect(a).toBe(b);
  });

  it("hero watermark uses the canonical component (no separate paw paths)", () => {
    const src = readFileSync("src/features/home/HomePage.tsx", "utf-8");
    expect(src.includes("BearPawMark")).toBe(true);
    expect(src.includes("hero-art")).toBe(true);
  });
});
