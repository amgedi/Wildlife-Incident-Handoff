import { describe, it, expect } from "vitest";
import { formatHumanReference, nextSequenceFromRefs, uuid } from "./id";

describe("id utilities", () => {
  it("formats human references as WIH-YYYY-NNNNNN", () => {
    expect(formatHumanReference(2026, 14)).toBe("WIH-2026-000014");
    expect(formatHumanReference(2026, 1234567)).toBe("WIH-2026-1234567"); // never truncates
  });

  it("derives the next sequence from existing references", () => {
    expect(nextSequenceFromRefs([])).toBe(1);
    expect(nextSequenceFromRefs(["WIH-2026-000001", "WIH-2026-000014"])).toBe(15);
    expect(nextSequenceFromRefs(["garbage", "WIH-2025-000009"])).toBe(10);
  });

  it("produces unique uuids", () => {
    const ids = new Set(Array.from({ length: 100 }, () => uuid()));
    expect(ids.size).toBe(100);
  });
});
