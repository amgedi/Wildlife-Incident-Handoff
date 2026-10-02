/**
 * DateTimeField — modern date/time entry with three layers:
 *  1. quick relative chips (Now, 5/15/30 min ago, 1 hour ago, Yesterday)
 *  2. a polished calendar + time popover (locale-aware, 12/24h follows locale)
 *  3. manual/native datetime-local fallback ("Enter manually")
 *
 * Storage contract: the value is always a full ISO-8601 instant; quick
 * chips and the calendar produce unambiguous local times converted with
 * the standard local-input conversion (never re-interpreted).
 */
import { useEffect, useId, useRef, useState } from "react";
import { isoToLocalInput, localInputToIso, nowIso, parseIso } from "../utils/time";

function startOfDay(d: Date) {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

function quickChips(): { label: string; iso: () => string }[] {
  const mins = (m: number) => () => new Date(Date.now() - m * 60_000).toISOString();
  return [
    { label: "Now", iso: () => nowIso() },
    { label: "5 minutes ago", iso: mins(5) },
    { label: "15 minutes ago", iso: mins(15) },
    { label: "30 minutes ago", iso: mins(30) },
    { label: "1 hour ago", iso: mins(60) },
  ];
}

export function DateTimeField({
  label,
  value,
  onChange,
  optional,
  hint,
}: {
  label: string;
  value: string;
  onChange: (iso: string) => void;
  optional?: boolean;
  hint?: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"chips" | "manual">("chips");
  const [viewMonth, setViewMonth] = useState(() => startOfDay(parseIso(value) ?? new Date()));
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (!popRef.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const d = parseIso(value);
  const timeValue = value ? isoToLocalInput(value).slice(11) : "";
  const timeStepLabel = new Date().toLocaleTimeString(undefined, { hour: "2-digit" }).match(/AM|PM/i) ? "12-hour" : "24-hour";

  const monthDays: (Date | null)[] = [];
  const first = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
  for (let i = 0; i < first.getDay(); i++) monthDays.push(null);
  const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
  for (let day = 1; day <= daysInMonth; day++) monthDays.push(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day));

  const pickedDay = d ? startOfDay(d).getTime() : null;

  function pickDay(day: Date) {
    const base = parseIso(value) ?? new Date();
    day.setHours(base.getHours(), base.getMinutes(), 0, 0);
    onChange(day.toISOString());
  }
  function pickTime(hhmm: string) {
    const base = d ?? new Date();
    const [h, m] = hhmm.split(":").map(Number);
    base.setHours(h ?? 0, m ?? 0, 0, 0);
    onChange(base.toISOString());
  }

  return (
    <div className="field" ref={popRef} style={{ position: "relative" }}>
      <label htmlFor={id}>{label} {optional && <span className="optional">(optional)</span>}</label>
      <div className="dt-row">
        <button
          id={id}
          type="button"
          className="input dt-trigger"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-haspopup="dialog"
        >
          <span>{d ? d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "Choose date & time"}</span>
          <span aria-hidden="true" style={{ color: "var(--c-ink-faint)" }}>📅</span>
        </button>
      </div>

      {mode === "chips" && !open && (
        <div className="chip-row" style={{ marginTop: 8 }}>
          {quickChips().map((c) => (
            <button key={c.label} type="button" className="chip" onClick={() => onChange(c.iso())}>{c.label}</button>
          ))}
          <button type="button" className="chip" onClick={() => onChange(new Date(new Date().setHours(0, 0, 0, 0)).toISOString())}>Earlier today</button>
          <button type="button" className="chip" onClick={() => { const y = new Date(); y.setDate(y.getDate() - 1); onChange(y.toISOString()); }}>Yesterday</button>
          <button type="button" className="chip" onClick={() => setMode("manual")}>Enter manually</button>
        </div>
      )}

      {mode === "manual" && (
        <div style={{ marginTop: 8 }}>
          <input
            type="datetime-local"
            className="input"
            style={{ maxWidth: 280 }}
            value={isoToLocalInput(value)}
            onChange={(e) => {
              const iso = localInputToIso(e.target.value);
              if (iso) onChange(iso);
            }}
            aria-label={`${label} (manual entry)`}
          />
          <button type="button" className="btn btn-quiet btn-sm" style={{ display: "block", marginTop: 4 }} onClick={() => setMode("chips")}>
            Use quick options instead
          </button>
        </div>
      )}

      {open && (
        <div className="dt-popover" role="dialog" aria-label={`${label} — pick date and time`}>
          <div className="row between" style={{ marginBottom: 8 }}>
            <button type="button" className="btn btn-quiet btn-sm" aria-label="Previous month"
              onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))}>‹</button>
            <strong>{viewMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</strong>
            <button type="button" className="btn btn-quiet btn-sm" aria-label="Next month"
              onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))}>›</button>
          </div>
          <div className="dt-grid" role="grid">
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((w) => (
              <span key={w} className="dt-wd" aria-hidden="true">{w}</span>
            ))}
            {monthDays.map((day, i) =>
              day ? (
                <button
                  key={i}
                  type="button"
                  className={`dt-day${pickedDay === startOfDay(day).getTime() ? " selected" : ""}`}
                  onClick={() => pickDay(new Date(day))}
                >
                  {day.getDate()}
                </button>
              ) : (
                <span key={i} />
              )
            )}
          </div>
          <div className="row" style={{ marginTop: 10, gap: 8 }}>
            <label htmlFor={`${id}-time`} className="sr-only">Time</label>
            <input
              id={`${id}-time`}
              type="time"
              className="input"
              style={{ maxWidth: 140 }}
              value={timeValue}
              onChange={(e) => pickTime(e.target.value)}
            />
            <span className="hint" style={{ margin: 0 }}>{timeStepLabel} (follows your locale)</span>
          </div>
          <div className="row" style={{ marginTop: 10, gap: 8 }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => { onChange(nowIso()); setOpen(false); }}>Now</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => { const t = new Date(); t.setHours(9, 0, 0, 0); onChange(t.toISOString()); }}>Today</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => { onChange(""); setOpen(false); }}>Clear</button>
            <span style={{ flex: 1 }} />
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setOpen(false)}>Confirm</button>
          </div>
        </div>
      )}
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}
