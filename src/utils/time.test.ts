import { describe, it, expect } from "vitest";
import { isIsoDateString, isoToLocalInput, localInputToIso, relativeTime } from "./time";

describe("time utilities", () => {
  it("recognizes valid ISO strings", () => {
    expect(isIsoDateString("2026-10-01T12:00:00.000Z")).toBe(true);
    expect(isIsoDateString("not-a-date")).toBe(false);
    expect(isIsoDateString(42)).toBe(false);
  });

  it("round-trips datetime-local inputs", () => {
    const iso = "2026-03-05T14:30:00Z";
    const local = isoToLocalInput(iso);
    const back = localInputToIso(local);
    expect(back).not.toBeNull();
    // Same instant, expressed locally.
    expect(isoToLocalInput(back!)).toBe(local);
  });

  it("renders relative times", () => {
    const now = new Date();
    const minutesAgo = new Date(now.getTime() - 18 * 60 * 1000).toISOString();
    expect(relativeTime(minutesAgo)).toContain("18 minutes ago");
    expect(relativeTime(now.toISOString())).toBe("just now");
  });
});
