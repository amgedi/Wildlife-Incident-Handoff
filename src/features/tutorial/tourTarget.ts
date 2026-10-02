/** Target resolution and geometry helpers for the spotlight tour. */

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface TourTargetSpec {
  tourId: string;
  /** CSS selector fallback if the data-tour-id element isn't present. */
  selectorFallback?: string;
}

/**
 * Find the element a tour step refers to. Prefers data-tour-id; falls back
 * to an explicit selector; never guesses.
 */
export function findTourTarget(spec: TourTargetSpec): Element | null {
  const byId = document.querySelector(`[data-tour-id="${spec.tourId}"]`);
  if (byId) return byId;
  if (spec.selectorFallback) {
    return document.querySelector(spec.selectorFallback);
  }
  return null;
}

/** Pure geometry helper (unit-tested): keep the callout fully on-screen. */
export function calloutPosition(
  hole: Rect,
  viewport: { width: number; height: number },
  callout: { width: number; height: number },
  gap = 16
): { left: number; top: number; placement: "right" | "left" | "below" | "floating" } {
  const { left, top, width, height } = hole;
  const preferRight = left + width + gap + callout.width <= viewport.width - 12;
  const preferLeft = left - gap - callout.width >= 12;
  const preferBelow = top + height + gap + callout.height <= viewport.height - 12;

  if (preferRight || preferLeft) {
    const cx = preferRight ? left + width + gap : left - callout.width - gap;
    let cy = top;
    if (cy + callout.height > viewport.height - 12) cy = viewport.height - callout.height - 12;
    if (cy < 12) cy = 12;
    return { left: Math.max(12, cx), top: cy, placement: preferRight ? "right" : "left" };
  }
  if (preferBelow) {
    let cx = left + width / 2 - callout.width / 2;
    cx = Math.max(12, Math.min(cx, viewport.width - callout.width - 12));
    return { left: cx, top: top + height + gap, placement: "below" };
  }
  return { left: 12, top: 12, placement: "floating" };
}
