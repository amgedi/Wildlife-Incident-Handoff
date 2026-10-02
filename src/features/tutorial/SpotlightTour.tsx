/**
 * Spotlight / coach-mark tour. Highlights real UI elements marked with
 * data-tour-id attributes and shows a floating callout.
 * Supports Next / Back / Skip / Exit / Restart and remembers completion.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface TourStep {
  tourId: string;
  title: string;
  text: string;
}

interface Rect { left: number; top: number; width: number; height: number }

interface SpotlightProps {
  steps: TourStep[];
  onFinish: () => void;
}

export function SpotlightTour({ steps, onFinish }: SpotlightProps) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const calloutRef = useRef<HTMLDivElement>(null);
  const step = steps[index];

  useLayoutEffect(() => {
    if (!step) return;
    const measure = () => {
      const el = document.querySelector(`[data-tour-id="${step.tourId}"]`);
      if (!el) {
        setRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setRect({ left: r.left, top: r.top, width: r.width, height: r.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    const targets = document.querySelectorAll("[data-tour-id]");
    targets.forEach((t) => ro.observe(t));
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [step]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onFinish();
      if (e.key === "ArrowRight") setIndex((i) => Math.min(steps.length - 1, i + 1));
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [steps.length, onFinish]);

  if (!step) return null;

  const pad = 8;
  const hole = rect
    ? { left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }
    : { left: window.innerWidth / 2 - 100, top: window.innerHeight / 2 - 50, width: 200, height: 100 };

  // Callout placement: below if space, otherwise above.
  const calloutW = 320;
  const calloutH = 190;
  let calloutLeft = Math.min(Math.max(12, hole.left), window.innerWidth - calloutW - 12);
  let calloutTop = hole.top + hole.height + 12;
  if (calloutTop + calloutH > window.innerHeight - 12) {
    calloutTop = Math.max(12, hole.top - calloutH - 12);
  }
  calloutLeft = Math.max(12, Math.min(calloutLeft, window.innerWidth - calloutW - 12));

  return createPortal(
    <div className="spotlight-overlay" role="dialog" aria-modal="true" aria-label="Product tour">
      <div className="spotlight-hole" style={hole} data-testid="tour-hole" />
      <div
        ref={calloutRef}
        className="spotlight-callout"
        style={{ left: calloutLeft, top: calloutTop, width: calloutW }}
      >
        <h3>
          {step.title}{" "}
          <span style={{ color: "var(--c-ink-faint)", fontWeight: 400, fontSize: "0.8em" }}>
            ({index + 1} of {steps.length})
          </span>
        </h3>
        <p>{step.text}</p>
        <div className="row">
          <button className="btn btn-quiet btn-sm" onClick={onFinish}>Exit</button>
          <span style={{ flex: 1 }} />
          {index > 0 && (
            <button className="btn btn-secondary btn-sm" onClick={() => setIndex((i) => i - 1)}>Back</button>
          )}
          {index < steps.length - 1 ? (
            <button className="btn btn-primary btn-sm" onClick={() => setIndex((i) => i + 1)}>Next</button>
          ) : (
            <button className="btn btn-primary btn-sm" onClick={onFinish}>Finish</button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
