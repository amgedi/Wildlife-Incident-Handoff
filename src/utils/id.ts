/** Human-reference counters and unique IDs. */

export function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Fallback for non-secure contexts.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function randomId(): string {
  return uuid().slice(0, 8);
}

/** e.g. WIH-2026-000014 */
export function formatHumanReference(year: number, seq: number): string {
  return `WIH-${year}-${String(seq).padStart(6, "0")}`;
}

export function nextSequenceFromRefs(refs: string[]): number {
  let max = 0;
  for (const ref of refs) {
    const match = /^WIH-\d{4}-(\d{6,})$/.exec(ref);
    if (match) {
      const n = Number.parseInt(match[1] ?? "0", 10);
      if (Number.isFinite(n) && n > max) max = n;
    }
  }
  return max + 1;
}
