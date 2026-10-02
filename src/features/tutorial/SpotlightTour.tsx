/**
 * Spotlight / coach-mark tour v2.
 *
 * A real spotlight: a full-viewport SVG mask (evenodd path) cuts a rounded
 * hole around the target element measured with getBoundingClientRect(); the
 * rest of the interface is dimmed through the mask. Steps can declare a
 * route (and incident tab) — the tour navigates, waits for the target to
 * exist, scrolls it into view, and only then measures and shows the cutout.
 * Recalculates on resize and scroll.
 */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import type { TourStepV2 } from "./tourSteps";
import { findTourTarget, calloutPosition, type Rect } from "./tourTarget";

interface RectState {
  hole: Rect;      // target bounds + padding
  radius: number;
}

interface SpotlightProps {
  steps: TourStepV2[];
  startIndex?: number;
  onFinish: () => void;
}

const PAD = 8;

function useTargetRect(step: TourStepV2 | undefined, index: number): RectState | null {
  const [state, setState] = useState<RectState | null>(null);
  const nav = useNavigate();
  const currentStepRef = useRef<string>("");
  currentStepRef.current = step ? `${index}:${step.tourId}:${step.route ?? ""}` : "";

  useEffect(() => {
    if (!step) return;
    let cancelled = false;
    let ro: ResizeObserver | null = null;
    let cleanup: (() => void) | null = null;

    const measure = () => {
      if (cancelled) return;
      const el = findTourTarget(step);
      if (!el) {
        setState(null);
        return;
      }
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) {
        setState(null);
        return;
      }
      setState({
        hole: { left: r.left - PAD, top: r.top - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 },
        radius: Math.min(14, parseFloat(getComputedStyle(el).borderRadius) || 10),
      });
    };

    const begin = async () => {
      // 1. Navigate to the step's route if we're not there.
      if (step.route && window.location.pathname !== step.route) {
        nav(step.route);
      }
      if (step.waitMs) await new Promise((res) => setTimeout(res, step.waitMs));
      // 2. Wait for the target to appear (route transitions are async).
      const deadline = Date.now() + 2500;
      let el: Element | null = null;
      while (Date.now() < deadline) {
        if (cancelled) return;
        el = findTourTarget(step);
        if (el) break;
        await new Promise((res) => setTimeout(res, 60));
      }
      if (!el || cancelled) {
        setState(null);
        return;
      }
      // 3. Scroll into view, then measure after the scroll settles.
      (el as HTMLElement).scrollIntoView?.({ block: "center", behavior: "auto" });
      await new Promise((res) => setTimeout(res, 180));
      measure();

      // 4. Keep measuring: resize, scroll, element resize.
      window.addEventListener("resize", measure);
      window.addEventListener("scroll", measure, true);
      ro = new ResizeObserver(measure);
      ro.observe(el);
      cleanup = () => {
        window.removeEventListener("resize", measure);
        window.removeEventListener("scroll", measure, true);
        ro?.disconnect();
      };
    };

    void begin();
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [step, index, nav]);

  return state;
}

export function SpotlightTour({ steps, startIndex = 0, onFinish }: SpotlightProps) {
  const [index, setIndex] = useState(startIndex);
  const step = steps[index];
  const rect = useTargetRect(step, index);
  const calloutRef = useRef<HTMLDivElement>(null);

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

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const hole = rect?.hole ?? { left: vw / 2 - 120, top: vh / 2 - 60, width: 240, height: 120 };
  const radius = rect?.radius ?? 12;

  // Callout placement via the shared geometry helper.
  const calloutW = 320;
  const calloutH = 200;
  const callout = calloutPosition(hole, { width: vw, height: vh }, { width: calloutW, height: calloutH });
  const calloutLeft = callout.left;
  const calloutTop = callout.top;

  // SVG mask: full-viewport dark rect with a rounded-rect hole (evenodd).
  const r = radius;
  const { left: hx, top: hy, width: hw, height: hh } = hole;
  const holePath =
    `M ${hx + r} ${hy} H ${hx + hw - r} A ${r} ${r} 0 0 1 ${hx + hw} ${hy + r} ` +
    `V ${hy + hh - r} A ${r} ${r} 0 0 1 ${hx + hw - r} ${hy + hh} ` +
    `H ${hx + r} A ${r} ${r} 0 0 1 ${hx} ${hy + hh - r} ` +
    `V ${hy + r} A ${r} ${r} 0 0 1 ${hx + r} ${hy} Z`;

  return createPortal(
    <div className="spotlight-overlay" role="dialog" aria-modal="true" aria-label="Product tour">
      <svg className="spotlight-mask" width="100%" height="100%" data-testid="tour-hole">
        <defs>
          <mask id="wih-spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            <path d={holePath} fill="black" />
          </mask>
        </defs>
        <rect x="0" y="0" width="100%" height="100%" fill="rgb(10 16 12 / 0.72)" mask="url(#wih-spotlight-mask)" />
        {/* soft ring around the cutout */}
        <rect
          x={hx}
          y={hy}
          width={hw}
          height={hh}
          rx={r}
          fill="none"
          stroke="var(--c-accent)"
          strokeWidth="2"
          className="spotlight-ring"
        />
      </svg>
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
          {step.action && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => {
                step.action!.run();
                if (step.action!.advance) setIndex((i) => Math.min(steps.length - 1, i + 1));
                else onFinish();
              }}
            >
              {step.action.label}
            </button>
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
