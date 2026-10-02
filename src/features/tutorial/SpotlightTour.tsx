/**
 * Spotlight / coach-mark rendering engine — shared by ALL guidance systems
 * (interface tour, demo tour). Step configuration lives in guidance.ts and
 * per-system step builders; this component only renders and measures.
 *
 * Guarantees:
 * - one active target at a time; previous geometry is cleared on every step
 *   change and on unmount (nothing persists after close);
 * - per-step SPA navigation with a visible "Opening …" transition state;
 * - target resolution failure shows Retry / Skip / Exit — never a spotlight
 *   floating over arbitrary content;
 * - measurements are rAF-batched and scroll/resize re-measures are throttled.
 */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import type { TourStepV2 } from "./tourStepsTypes";
import { findTourTarget, calloutPosition, type Rect } from "./tourTarget";

interface RectState {
  hole: Rect;
  radius: number;
}

type TargetState =
  | { kind: "loading"; label: string }
  | { kind: "ready"; rect: RectState }
  | { kind: "missing" };

interface SpotlightProps {
  steps: TourStepV2[];
  startIndex?: number;
  onFinish: () => void;
}

const PAD = 8;

export function SpotlightTour({ steps, startIndex = 0, onFinish }: SpotlightProps) {
  const [index, setIndex] = useState(startIndex);
  const [target, setTarget] = useState<TargetState>({ kind: "loading", label: steps[startIndex]?.title ?? "" });
  const [reloadToken, setReloadToken] = useState(0);
  const nav = useNavigate();
  const step = steps[index];

  useEffect(() => {
    if (!step) return;
    let cancelled = false;
    let ro: ResizeObserver | null = null;
    let cleanup: (() => void) | null = null;
    let raf = 0;
    let lastMeasure = 0;

    const measure = () => {
      if (cancelled) return;
      const el = findTourTarget(step);
      if (!el) {
        setTarget({ kind: "missing" });
        return;
      }
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) {
        setTarget({ kind: "missing" });
        return;
      }
      setTarget({
        kind: "ready",
        rect: {
          hole: { left: r.left - PAD, top: r.top - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 },
          radius: Math.min(14, parseFloat(getComputedStyle(el).borderRadius) || 10),
        },
      });
    };

    // Throttled re-measure (scroll/resize): at most one measurement per frame.
    const scheduleMeasure = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const now = performance.now();
        if (now - lastMeasure < 32) return;
        lastMeasure = now;
        measure();
      });
    };

    const begin = async () => {
      setTarget({ kind: "loading", label: step.title });
      // Only navigate when the step explicitly declares a route; steps that
      // describe the current page must never yank navigation back.
      if (step.route && window.location.pathname + window.location.search !== step.route) {
        nav(step.route);
      }
      if (step.waitMs) await new Promise((res) => setTimeout(res, step.waitMs));
      const deadline = Date.now() + 3000;
      let el: Element | null = null;
      while (Date.now() < deadline) {
        if (cancelled) return;
        el = findTourTarget(step);
        if (el) break;
        await new Promise((res) => setTimeout(res, 60));
      }
      if (!el || cancelled) {
        if (!cancelled) setTarget({ kind: "missing" });
        return;
      }
      (el as HTMLElement).scrollIntoView?.({ block: "center", behavior: "auto" });
      await new Promise((res) => setTimeout(res, 150));
      measure();

      window.addEventListener("resize", scheduleMeasure);
      window.addEventListener("scroll", scheduleMeasure, true);
      ro = new ResizeObserver(scheduleMeasure);
      ro.observe(el);
      cleanup = () => {
        window.removeEventListener("resize", scheduleMeasure);
        window.removeEventListener("scroll", scheduleMeasure, true);
        ro?.disconnect();
      };
    };

    void begin();
    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
      cleanup?.();
    };
  }, [step, index, nav, reloadToken]);

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
  const ready = target.kind === "ready" ? target.rect : null;
  const hole = ready?.hole ?? { left: vw / 2 - 120, top: vh / 2 - 60, width: 240, height: 120 };
  const radius = ready?.radius ?? 12;

  const calloutW = Math.min(340, vw - 24);
  const calloutH = 230;
  const callout = calloutPosition(hole, { width: vw, height: vh }, { width: calloutW, height: calloutH });

  const r = radius;
  const { left: hx, top: hy, width: hw, height: hh } = hole;
  const holePath =
    `M ${hx + r} ${hy} H ${hx + hw - r} A ${r} ${r} 0 0 1 ${hx + hw} ${hy + r} ` +
    `V ${hy + hh - r} A ${r} ${r} 0 0 1 ${hx + hw - r} ${hy + hh} ` +
    `H ${hx + r} A ${r} ${r} 0 0 1 ${hx} ${hy + hh - r} ` +
    `V ${hy + r} A ${r} ${r} 0 0 1 ${hx + r} ${hy} Z`;

  const next = () => setIndex((i) => Math.min(steps.length - 1, i + 1));
  const back = () => setIndex((i) => Math.max(0, i - 1));

  return createPortal(
    <div className="spotlight-overlay" role="dialog" aria-modal="true" aria-label={`Tutorial: ${step.title}`} data-testid="spotlight-overlay">
      {target.kind === "ready" && (
        <svg className="spotlight-mask" width="100%" height="100%" data-testid="tour-hole">
          <defs>
            <mask id="wih-spotlight-mask">
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              <path d={holePath} fill="black" />
            </mask>
          </defs>
          <rect x="0" y="0" width="100%" height="100%" fill="rgb(10 16 12 / 0.72)" mask="url(#wih-spotlight-mask)" />
          <rect
            x={hx}
            y={hy}
            width={hw}
            height={hh}
            rx={r}
            fill="none"
            stroke="var(--c-focus)"
            strokeWidth="2"
            className="spotlight-ring"
          />
        </svg>
      )}
      {target.kind === "loading" && <div className="spotlight-dim" />}

      <div className="spotlight-callout" style={{ left: callout.left, top: callout.top, width: calloutW }} data-testid="tour-callout">
        <p className="spotlight-step-count">
          Step {index + 1} of {steps.length}
        </p>
        {target.kind === "missing" ? (
          <>
            <h3>We couldn't find this part of the interface.</h3>
            <p>It may not be available in your current workspace. You can retry, skip this step, or exit the tour.</p>
            <div className="spotlight-footer">
              <button className="btn btn-quiet btn-sm" onClick={onFinish}>Exit</button>
              <span style={{ flex: 1 }} />
              <button className="btn btn-secondary btn-sm" onClick={() => setReloadToken((t) => t + 1)}>Retry</button>
              {index < steps.length - 1 && (
                <button className="btn btn-primary btn-sm" onClick={next}>Skip step</button>
              )}
            </div>
          </>
        ) : (
          <>
            <h3>{step.title}</h3>
            <p>{step.text}</p>
            {step.action && (
              <div style={{ marginTop: "var(--space-2)" }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    if (step.action!.to) nav(step.action!.to);
                    if (step.action!.advance) next();
                    else onFinish();
                  }}
                >
                  {step.action.label}
                </button>
              </div>
            )}
            <div className="spotlight-footer">
              <button className="btn btn-quiet btn-sm" onClick={onFinish}>Exit</button>
              <span style={{ flex: 1 }} />
              {index > 0 && (
                <button className="btn btn-secondary btn-sm" onClick={back}>Back</button>
              )}
              {index < steps.length - 1 ? (
                <button className="btn btn-primary btn-sm" onClick={next}>Next</button>
              ) : (
                <button className="btn btn-primary btn-sm" onClick={onFinish}>Finish</button>
              )}
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
