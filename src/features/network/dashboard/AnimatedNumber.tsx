/** Dashboard micro-visuals: smoothly animated numeric counters. */
import { useEffect, useRef, useState } from "react";
import { useApp } from "../../../app/AppContext";

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && (window.matchMedia("(prefers-reduced-motion: reduce)")?.matches ?? false);
}

export function AnimatedNumber({ value, duration = 500 }: { value: number; duration?: number }) {
  const { settings } = useApp();
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef<number | undefined>(undefined);
  const motionOff = settings.motion === "off" || settings.motion === "reduced" || prefersReducedMotion();

  useEffect(() => {
    const from = fromRef.current;
    if (from === value) return;
    if (motionOff) {
      fromRef.current = value;
      setDisplay(value);
      return;
    }
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const current = Math.round(from + (value - from) * eased);
      setDisplay(current);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = value;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      fromRef.current = value;
    };
  }, [value, duration, motionOff]);

  return <span className="kpi-number">{display}</span>;
}
