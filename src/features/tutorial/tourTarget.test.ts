import { describe, it, expect } from "vitest";
import { calloutPosition } from "./tourTarget";
import type { Rect } from "./tourTarget";

const viewport = { width: 1280, height: 800 };
const callout = { width: 320, height: 200 };

describe("spotlight callout positioning", () => {
  it("places the callout to the right when there is room", () => {
    const hole: Rect = { left: 100, top: 100, width: 200, height: 40 };
    const pos = calloutPosition(hole, viewport, callout);
    expect(pos.placement).toBe("right");
    expect(pos.left).toBe(100 + 200 + 16);
  });

  it("flips to the left near the right edge", () => {
    const hole: Rect = { left: 1200, top: 100, width: 60, height: 40 };
    const pos = calloutPosition(hole, viewport, callout);
    expect(pos.placement).toBe("left");
    expect(pos.left).toBeLessThan(hole.left);
  });

  it("falls back to below a wide centered target", () => {
    const hole: Rect = { left: 300, top: 300, width: 900, height: 200 };
    const pos = calloutPosition(hole, viewport, callout);
    expect(pos.placement).toBe("below");
    expect(pos.top).toBe(300 + 200 + 16);
  });

  it("keeps the callout fully on-screen (floating fallback)", () => {
    const hole: Rect = { left: 300, top: 300, width: 1200, height: 700 };
    const pos = calloutPosition(hole, { width: 1280, height: 400 }, callout);
    expect(pos.placement).toBe("floating");
    expect(pos.left).toBeGreaterThanOrEqual(12);
    expect(pos.top).toBeGreaterThanOrEqual(12);
    expect(pos.top + callout.height).toBeLessThanOrEqual(400);
  });

  it("never lets the below-placement overflow the bottom", () => {
    const hole: Rect = { left: 100, top: 650, width: 100, height: 40 };
    const pos = calloutPosition(hole, viewport, callout);
    expect(pos.top + callout.height).toBeLessThanOrEqual(viewport.height);
  });
});
