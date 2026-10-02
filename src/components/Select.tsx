/**
 * Accessible listbox-based select, used instead of native <select> for
 * consistent styling. Full keyboard support: arrows, Home/End, typeahead,
 * Enter/Space, Escape. Renders as a form field.
 */
import { useEffect, useId, useRef, useState } from "react";
import { Icons } from "./Icons";

export interface Option {
  value: string;
  label: string;
  hint?: string;
}

interface SelectProps {
  label: string;
  value: string | null;
  options: Option[];
  onChange: (value: string) => void;
  hint?: string;
  optional?: boolean;
  placeholder?: string;
  invalid?: boolean;
  errorText?: string;
}

export function Select({
  label,
  value,
  options,
  onChange,
  hint,
  optional,
  placeholder = "Choose…",
  invalid,
  errorText,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listboxId = useId();
  const buttonId = useId();

  const selected = options.find((o) => o.value === value) ?? null;
  const displayText = selected ? selected.label : placeholder;

  useEffect(() => {
    if (open && selected) {
      const idx = options.findIndex((o) => o.value === value);
      setActiveIndex(Math.max(0, idx));
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    function onDocDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocDown);
    const list = listRef.current;
    const active = list?.children[activeIndex] as HTMLElement | undefined;
    active?.scrollIntoView({ block: "nearest" });
    return () => document.removeEventListener("mousedown", onDocDown);
  }, [open, activeIndex]);

  function commit(index: number) {
    const opt = options[index];
    if (opt) onChange(opt.value);
    setOpen(false);
    rootRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }

  function onButtonKey(e: React.KeyboardEvent) {
    switch (e.key) {
      case "ArrowDown":
      case "Enter":
      case " ":
        e.preventDefault();
        setOpen(true);
        break;
      case "Escape":
        setOpen(false);
        break;
    }
  }

  function onListKey(e: React.KeyboardEvent) {
    const typeahead = () => {
      const ch = e.key.toLowerCase();
      const idx = options.findIndex((o) => o.label.toLowerCase().startsWith(ch));
      if (idx >= 0) setActiveIndex(idx);
    };
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((i) => Math.min(options.length - 1, i + 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((i) => Math.max(0, i - 1));
        break;
      case "Home":
        e.preventDefault();
        setActiveIndex(0);
        break;
      case "End":
        e.preventDefault();
        setActiveIndex(options.length - 1);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        commit(activeIndex);
        break;
      case "Escape":
        e.preventDefault();
        setOpen(false);
        rootRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
        break;
      case "Tab":
        commit(activeIndex);
        break;
      default:
        if (e.key.length === 1) typeahead();
    }
  }

  const describedBy = errorText && invalid ? `${listboxId}-err` : hint ? `${listboxId}-hint` : undefined;

  return (
    <div className="field" ref={rootRef} style={{ position: "relative" }}>
      <label id={buttonId + "-label"} htmlFor={buttonId}>
        {label}{" "}
        {optional && <span className="optional">(optional)</span>}
      </label>
      <button
        id={buttonId}
        type="button"
        className={`input${invalid ? " invalid" : ""}`}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, textAlign: "left" }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-labelledby={`${buttonId}-label ${buttonId}`}
        aria-describedby={describedBy}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onButtonKey}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: selected ? "inherit" : "var(--c-ink-faint)" }}>
          {displayText}
        </span>
        <Icons.chevronDown size={16} style={{ flexShrink: 0 }} />
      </button>
      {open && (
        <ul
          id={listboxId}
          ref={listRef}
          role="listbox"
          aria-labelledby={buttonId}
          tabIndex={-1}
          onKeyDown={onListKey}
          style={{
            position: "absolute", zIndex: 60, margin: "4px 0 0", padding: 4,
            listStyle: "none", background: "var(--c-surface)", color: "var(--c-ink)",
            border: "1px solid var(--c-border-strong)", borderRadius: "var(--radius-sm)",
            boxShadow: "var(--c-shadow-lift)", maxHeight: 280, overflowY: "auto",
            minWidth: Math.max(240, rootRef.current?.offsetWidth ?? 240),
          }}
        >
          {options.map((opt, i) => (
            <li
              key={opt.value}
              role="option"
              aria-selected={opt.value === value}
              onMouseEnter={() => setActiveIndex(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => commit(i)}
              style={{
                padding: "8px 10px", borderRadius: 6, cursor: "pointer",
                background: i === activeIndex ? "var(--c-surface-alt)" : "transparent",
                fontWeight: opt.value === value ? 650 : 400,
              }}
            >
              {opt.label}
              {opt.hint && (
                <div style={{ fontSize: "0.78rem", color: "var(--c-ink-faint)" }}>{opt.hint}</div>
              )}
            </li>
          ))}
        </ul>
      )}
      {hint && !invalid && <p className="hint" id={`${listboxId}-hint`}>{hint}</p>}
      {invalid && errorText && <p className="error-text" id={`${listboxId}-err`}>{errorText}</p>}
    </div>
  );
}
