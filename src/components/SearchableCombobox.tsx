/**
 * SearchableCombobox — one reusable accessible combobox with optional
 * two-level hierarchy (group → options), used for animal group, incident
 * type, status filters and other lists beyond ~8 options.
 *
 * Keyboard: ArrowUp/Down, Home/End, Enter/Space select, Escape closes,
 * type-to-filter. aria-combobox/activedescendant semantics. Touch friendly.
 */
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";

export interface ComboOption {
  value: string;
  label: string;
  group?: string;
  hint?: string;
}

export function SearchableCombobox({
  label,
  value,
  options,
  onChange,
  optional,
  hint,
  placeholder = "Search or choose…",
  allowFreeText,
  onFreeText,
}: {
  label: string;
  value: string | null;
  options: ComboOption[];
  onChange: (value: string) => void;
  optional?: boolean;
  hint?: string;
  placeholder?: string;
  allowFreeText?: boolean;
  onFreeText?: (text: string) => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = options.find((o) => o.value === value);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q) || (o.group ?? "").toLowerCase().includes(q));
  }, [options, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, { opt: ComboOption; flat: number }[]>();
    filtered.forEach((opt, flat) => {
      const g = opt.group ?? "";
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push({ opt, flat });
    });
    return map;
  }, [filtered]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (!rootRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useLayoutEffect(() => {
    const el = listRef.current?.children[active] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function commit(opt: ComboOption) {
    onChange(opt.value);
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
  }

  function onKey(e: React.KeyboardEvent) {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) { setOpen(true); return; }
    if (!open) return;
    switch (e.key) {
      case "ArrowDown": e.preventDefault(); setActive((a) => Math.min(filtered.length - 1, a + 1)); break;
      case "ArrowUp": e.preventDefault(); setActive((a) => Math.max(0, a - 1)); break;
      case "Home": e.preventDefault(); setActive(0); break;
      case "End": e.preventDefault(); setActive(Math.max(0, filtered.length - 1)); break;
      case "Enter": {
        e.preventDefault();
        const opt = filtered[active];
        if (opt) commit(opt);
        else if (allowFreeText && query.trim()) { onFreeText?.(query.trim()); setOpen(false); setQuery(""); }
        break;
      }
      case "Escape": setOpen(false); setQuery(""); break;
    }
  }

  const display = selected ? selected.label : value && allowFreeText ? value : "";

  return (
    <div className="field" ref={rootRef} style={{ position: "relative" }}>
      <label htmlFor={id}>{label} {optional && <span className="optional">(optional)</span>}</label>
      <input
        id={id}
        ref={inputRef}
        type="text"
        role="combobox"
        className="input"
        autoComplete="off"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        aria-activedescendant={open && filtered[active] ? `${id}-opt-${active}` : undefined}
        placeholder={display || placeholder}
        value={open ? query : ""}
        onFocus={() => { setOpen(true); setActive(Math.max(0, filtered.findIndex((o) => o.value === value))); }}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); setActive(0); }}
        onKeyDown={onKey}
      />
      {open && (
        <ul id={`${id}-list`} ref={listRef} role="listbox" className="combo-list">
          {filtered.length === 0 && allowFreeText && query.trim() && (
            <li className="combo-opt" role="option" aria-selected={false} onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onFreeText?.(query.trim()); setOpen(false); setQuery(""); }}>
              Use “{query.trim()}” as entered
            </li>
          )}
          {filtered.length === 0 && !allowFreeText && <li className="combo-opt">No matches</li>}
          {[...grouped.entries()].map(([group, items]) => (
            <div key={group || "_"} role="presentation">
              {group && <li className="combo-group" role="presentation">{group}</li>}
              {items.map(({ opt, flat }) => (
                <li
                  key={opt.value}
                  id={`${id}-opt-${flat}`}
                  role="option"
                  aria-selected={opt.value === value}
                  className={`combo-opt${flat === active ? " active" : ""}`}
                  onMouseEnter={() => setActive(flat)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => commit(opt)}
                >
                  {opt.label}
                  {opt.hint && <div className="combo-hint">{opt.hint}</div>}
                </li>
              ))}
            </div>
          ))}
        </ul>
      )}
      {hint && !open && <p className="hint">{hint}</p>}
    </div>
  );
}
