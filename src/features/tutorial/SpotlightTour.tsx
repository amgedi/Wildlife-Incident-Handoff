/**
 * Spotlight / coach-mark ENGINE — an explicit state machine.
 *
 * Phases: navigating → waiting-for-target → showing → (next) … | failed
 * Invariants (asserted by tests):
 *  - a monotonically increasing GENERATION token guards all async work;
 *    when the user advances, every unresolved operation from the previous
 *    step is invalidated and can never repaint the spotlight;
 *  - stale geometry is NEVER shown while navigating (dim + callout only);
 *  - route readiness = location matches the step route; target readiness =
 *    bounded poll for [data-tour-id]; no fixed sleeps except a
 *    layout-settle double-rAF after scrollIntoView;
 *  - the tutorial callout heading receives focus — never the highlighted
 *    target (no .focus() on targets; keyboard focus is a separate system);
 *  - closing removes the whole overlay (portal unmount).
 *
 * Step configuration lives in guidance.ts; this file only orchestrates.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { TourStepV2 } from "./tourStepsTypes";
import { findTourTarget, calloutPosition, type Rect } from "./tourTarget";

interface RectState {
  hole: Rect;
  radius: number;
}

type Phase =
  | { kind: "navigating" }
  | { kind: "waiting" }
  | { kind: "showing"; rect: RectState }
  | { kind: "failed"; diagnostics: Record<string, string> };

interface SpotlightProps {
  steps: TourStepV2[];
  startIndex?: number;
  onFinish: () => void;
}

const PAD = 8;

export function SpotlightTour({ steps, startIndex = 0, onFinish }: SpotlightProps) {
  const [index, setIndex] = useState(startIndex);
  const [phase, setPhase] = useState<Phase>({ kind: "navigating" });
  const generationRef = useRef(0);
  const calloutHeadingRef = useRef<HTMLHeadingElement>(null);
  const nav = useNavigate();
  const { t } = useTranslation("guidance");
  const step = steps[index];

  const runStep = useCallback(
    (stepIndex: number, gen: number) => {
      const current = steps[stepIndex];
      if (!current) return;
      const begin = async () => {
        setPhase({ kind: "navigating" });

        // Route readiness: navigate if the step declares a route, then wait
        // until the router actually lands there (no guessed timeouts).
        if (current.route && window.location.pathname + window.location.search !== current.route) {
          nav(current.route);
        }
        if (current.route) {
          const routeDeadline = Date.now() + 3000;
          while (Date.now() < routeDeadline) {
            if (generationRef.current !== gen) return; // superseded
            if (window.location.pathname + window.location.search === current.route) break;
            await new Promise((r) => setTimeout(r, 40));
          }
          if (generationRef.current !== gen) return;
        }

        // Phase: waiting-for-target (bounded poll).
        setPhase({ kind: "waiting" });
        const targetDeadline = Date.now() + (current.waitMs ?? 0) + 2000;
        let el: Element | null = null;
        while (Date.now() < targetDeadline) {
          if (generationRef.current !== gen) return;
          el = findTourTarget(current);
          if (el) break;
          await new Promise((r) => setTimeout(r, 50));
        }
        if (generationRef.current !== gen) return;
        if (!el) {
          // dev.17: never dead-end the tour. If a target is missing (workspace
          // state, empty list, anything), skip to the next step instead of
          // showing the failure screen (user decision — the Search/Filters
          // steps were removed for exactly this reason).
          if (stepIndex + 1 < steps.length) {
            setPhase({ kind: "navigating" });
            setIndex(stepIndex + 1);
            return;
          }
          onFinish();
          return;
        }

        // Scroll into view, wait for layout to settle (double rAF), measure once.
        (el as HTMLElement).scrollIntoView?.({ block: "center", behavior: "auto" });
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null))));
        if (generationRef.current !== gen) return;
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) {
          if (stepIndex + 1 < steps.length) {
            setIndex(stepIndex + 1);
            return;
          }
          onFinish();
          return;
        }
        if (generationRef.current !== gen) return;
        setPhase({
          kind: "showing",
          rect: {
            hole: { left: r.left - PAD, top: r.top - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 },
            radius: Math.min(14, parseFloat(getComputedStyle(el).borderRadius) || 10),
          },
        });
      };
      void begin();
    },
    [nav, steps]
  );

  // Start each step; the generation token invalidates everything prior.
  useEffect(() => {
    if (!step) return;
    const gen = ++generationRef.current;
    runStep(index, gen);
    return () => {
      generationRef.current = gen + 1;
    };
  }, [step, index, runStep]);

  // Follow scroll/resize while showing (rAF-throttled re-measure).
  useEffect(() => {
    if (phase.kind !== "showing") return;
    let raf = 0;
    let last = 0;
    const measure = () => {
      if (!step) return;
      const el = findTourTarget(step);
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return;
      setPhase({
        kind: "showing",
        rect: {
          hole: { left: r.left - PAD, top: r.top - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 },
          radius: Math.min(14, parseFloat(getComputedStyle(el).borderRadius) || 10),
        },
      });
    };
    const schedule = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const now = performance.now();
        if (now - last < 32) return;
        last = now;
        measure();
      });
    };
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    return () => {
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [phase.kind, step]); // eslint-disable-line react-hooks/exhaustive-deps

  // Focus the tutorial panel heading — never the highlighted target.
  useEffect(() => {
    calloutHeadingRef.current?.focus();
  }, [index, phase.kind]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onFinish();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onFinish]);

  if (!step) return null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const ready = phase.kind === "showing" ? phase.rect : null;
  const hole = ready?.hole ?? { left: vw / 2 - 120, top: vh / 2 - 60, width: 240, height: 120 };
  const radius = ready?.radius ?? 12;
  const calloutW = Math.min(340, vw - 24);
  const calloutH = 230;
  const r = radius;
  const { left: hx, top: hy, width: hw, height: hh } = hole;
  const holePath =
    `M ${hx + r} ${hy} H ${hx + hw - r} A ${r} ${r} 0 0 1 ${hx + hw} ${hy + r} ` +
    `V ${hy + hh - r} A ${r} ${r} 0 0 1 ${hx + hw - r} ${hy + hh} ` +
    `H ${hx + r} A ${r} ${r} 0 0 1 ${hx} ${hy + hh - r} ` +
    `V ${hy + r} A ${r} ${r} 0 0 1 ${hx + r} ${hy} Z`;

  const busy = phase.kind === "navigating" || phase.kind === "waiting";

  // While navigating/waiting, the callout is CENTERED (AM): never anchored to
  // stale geometry of a target that is not mounted yet.
  const calloutPos = busy
    ? { left: Math.max(12, (vw - calloutW) / 2), top: Math.max(12, vh / 2 - 140) }
    : calloutPosition(hole, { width: vw, height: vh }, { width: calloutW, height: calloutH });

  return createPortal(
    <div className="spotlight-overlay" role="dialog" aria-modal="true" aria-label={`Tutorial: ${step.title}`} data-testid="spotlight-overlay">
      {phase.kind === "showing" && (
        <svg className="spotlight-mask" width="100%" height="100%" data-testid="tour-hole">
          <defs>
            <mask id="wih-spotlight-mask">
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              <path d={holePath} fill="black" />
            </mask>
          </defs>
          <rect x="0" y="0" width="100%" height="100%" fill="rgb(10 16 12 / 0.72)" mask="url(#wih-spotlight-mask)" />
          <rect x={hx} y={hy} width={hw} height={hh} rx={r} fill="none" stroke="var(--tour-ring)" strokeWidth="2" className="spotlight-ring" />
        </svg>
      )}
      {busy && <div className="spotlight-dim" />}

      <div className="spotlight-callout" style={{ left: calloutPos.left, top: calloutPos.top, width: calloutW }} data-testid="tour-callout">
        <p className="spotlight-step-count">{t("stepOf", { current: index + 1, total: steps.length })}</p>
        {phase.kind === "failed" ? (
          <>
            <h3 ref={calloutHeadingRef} tabIndex={-1} className="spotlight-heading">{t("failedTitle")}</h3>
            <p>{t("failedBody")}</p>
            <div className="spotlight-footer">
              <button className="btn btn-quiet btn-sm" onClick={onFinish}>{t("guideExit")}</button>
              <span style={{ flex: 1 }} />
              <button className="btn btn-secondary btn-sm" onClick={() => runStep(index, ++generationRef.current)}>{t("retry", { ns: "common" })}</button>
              {index < steps.length - 1 && (
                <button className="btn btn-primary btn-sm" onClick={() => setIndex((i) => Math.min(steps.length - 1, i + 1))}>{t("skipStep", { ns: "common" })}</button>
              )}
            </div>
          </>
        ) : (
          <>
            <h3 ref={calloutHeadingRef} tabIndex={-1} className="spotlight-heading">{step.titleKey ? t(step.titleKey) : step.title}</h3>
            <p>{step.textKeyR ? t(step.textKeyR) : step.textKey ? t(step.textKey) : step.text}</p>
            {busy && <p className="spotlight-opening" role="status">{t("opening")}</p>}
            {step.action && (
              <div style={{ marginTop: "var(--space-2)" }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    if (step.action!.to) nav(step.action!.to);
                    if (step.action!.advance) setIndex((i) => Math.min(steps.length - 1, i + 1));
                    else onFinish();
                  }}
                >
                  {step.action.labelKey ? t(step.action.labelKey) : step.action.label}
                </button>
              </div>
            )}
            <div className="spotlight-footer">
              <button className="btn btn-quiet btn-sm" onClick={onFinish}>{t("guideExit")}</button>
              <span style={{ flex: 1 }} />
              {index > 0 && (
                <button className="btn btn-secondary btn-sm" onClick={() => setIndex((i) => Math.max(0, i - 1))}>{t("back", { ns: "common" })}</button>
              )}
              {index < steps.length - 1 ? (
                <button className="btn btn-primary btn-sm" onClick={() => setIndex((i) => i + 1)}>{t("next", { ns: "common" })}</button>
              ) : (
                <button className="btn btn-primary btn-sm" onClick={onFinish}>{t("finish", { ns: "common" })}</button>
              )}
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
