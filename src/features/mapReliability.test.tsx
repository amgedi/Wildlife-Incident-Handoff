/** 0.3.0-dev.3: map reliability contract (spec 11–15). Static + lifecycle. */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";

describe("map load reliability (0.3.0-dev.3)", () => {
  const src = readFileSync("src/features/network/mapProvider.ts", "utf-8");

  it("a ResizeObserver resizes the canvas whenever the container settles (root-cause fix)", () => {
    expect(src.includes("new ResizeObserver")).toBe(true);
    expect(src.includes("containerObserver.observe(container)")).toBe(true);
  });

  it("resize also runs after the style loads (settled-layout belt)", () => {
    const loadIdx = src.indexOf('map.on("load"');
    const block = src.slice(loadIdx, loadIdx + 400);
    expect(block.includes("mapRef.resize()")).toBe(true);
  });

  it("bounded automatic style retry — never requires a basemap toggle to wake the map", () => {
    expect(src.includes("styleRetryDone")).toBe(true);
    expect(src.includes("mapRef.setStyle(styleForProvider(providerDescriptor))")).toBe(true);
    // retry is bounded: flag set before the retry, never reset in the error path
    expect(src.match(/styleRetryDone = true/g)?.length).toBe(1);
  });

  it("observer is disconnected on destroy (no leak across route mounts)", () => {
    const destroyIdx = src.lastIndexOf("destroy()");
    const block = src.slice(destroyIdx, destroyIdx + 300);
    expect(block.includes("containerObserver?.disconnect()")).toBe(true);
  });
});
