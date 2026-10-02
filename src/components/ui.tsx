/** Small shared presentational components. */
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Icons } from "./Icons";
import { STATUS_LABELS_BY_KEY } from "../features/incidents/labels";
import type { IncidentStatus } from "../types/incident";

export function StatusBadge({ status }: { status: IncidentStatus }) {
  const openStates: IncidentStatus[] = ["reported", "response_requested", "responder_assigned", "awaiting_pickup"];
  const urgentStates: IncidentStatus[] = ["in_transport"];
  const doneStates: IncidentStatus[] = ["released", "closed", "cancelled", "deceased"];
  const cls = openStates.includes(status) ? "open" : urgentStates.includes(status) ? "urgent" : doneStates.includes(status) ? "neutral" : "info";
  return <span className={`badge ${cls}`}>{STATUS_LABELS_BY_KEY[status]}</span>;
}

export function UnknownChip({ children = "Unknown" }: { children?: string }) {
  return <span className="unknown-chip">{children}</span>;
}

export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon?: ReactNode;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      {icon && <div className="icon-wrap">{icon}</div>}
      <h3>{title}</h3>
      {hint && <p style={{ maxWidth: "44ch", margin: "0 auto var(--space-4)" }}>{hint}</p>}
      {action}
    </div>
  );
}

/** Contextual "What is this?" help trigger with a popover. */
export function ContextHelp({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div ref={ref} style={{ position: "relative", display: "inline-flex" }}>
      <button
        type="button"
        className="help-trigger"
        aria-label="What is this?"
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        <Icons.help size={16} />
      </button>
      {open && (
        <div className="help-popover" role="note" id={id} style={{ top: "calc(100% + 6px)", left: 0 }}>
          {text}
        </div>
      )}
    </div>
  );
}

export function SectionHeading({ children, help }: { children: ReactNode; help?: string }) {
  return (
    <h2 style={{ display: "flex", alignItems: "center", gap: 6 }}>
      {children}
      {help && <ContextHelp text={help} />}
    </h2>
  );
}

/** A labeled text input with optional hint/error. */
export function TextField({
  label,
  value,
  onChange,
  hint,
  optional,
  multiline,
  rows = 4,
  type = "text",
  invalid,
  errorText,
  placeholder,
  min,
  step,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  optional?: boolean;
  multiline?: boolean;
  rows?: number;
  type?: string;
  invalid?: boolean;
  errorText?: string;
  placeholder?: string;
  min?: number;
  step?: string;
  autoComplete?: string;
}) {
  const id = useId();
  const describedBy = invalid && errorText ? `${id}-err` : hint ? `${id}-hint` : undefined;
  return (
    <div className="field">
      <label htmlFor={id}>
        {label} {optional && <span className="optional">(optional)</span>}
      </label>
      {multiline ? (
        <textarea
          id={id}
          className={`textarea${invalid ? " invalid" : ""}`}
          rows={rows}
          value={value}
          placeholder={placeholder}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          id={id}
          className={`input${invalid ? " invalid" : ""}`}
          type={type}
          value={value}
          placeholder={placeholder}
          min={min}
          step={step}
          autoComplete={autoComplete}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {hint && !invalid && <p className="hint" id={`${id}-hint`}>{hint}</p>}
      {invalid && errorText && <p className="error-text" id={`${id}-err`}>{errorText}</p>}
    </div>
  );
}

/** Segmented control for small exclusive choices. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="field">
      <span style={{ display: "block", fontWeight: 600, fontSize: "0.9rem", marginBottom: 4 }}>{label}</span>
      <div className="segmented" role="group" aria-label={label}>
        {options.map((o) => (
          <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
