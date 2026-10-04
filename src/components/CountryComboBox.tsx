/**
 * CountryComboBox (0.3, spec 67) — modern searchable country picker.
 * Replaces the browser-like dropdown: type-to-filter, full keyboard support
 * (arrows + Enter + Escape), ARIA combobox/listbox semantics, themed
 * completely by the design system (no native select).
 */
import { useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Icons } from "./Icons";
import { COUNTRY_LIST } from "../features/country/countryProfile";

export function CountryComboBox({
  value,
  onChange,
  label,
  allowClear = true,
}: {
  value: string;
  onChange: (code: string) => void;
  label: string;
  allowClear?: boolean;
}) {
  const { t } = useTranslation("settings");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const inputId = useId();
  const listId = useId();

  const selected = COUNTRY_LIST.find((c) => c.code === value) ?? null;

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRY_LIST;
    return COUNTRY_LIST.filter((c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase() === q);
  }, [query]);

  const openList = () => {
    setQuery("");
    setActiveIdx(Math.max(0, COUNTRY_LIST.findIndex((c) => c.code === value)));
    setOpen(true);
  };
  const pick = (code: string) => {
    onChange(code);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        e.preventDefault();
        openList();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = results[activeIdx];
      if (item) pick(item.code);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} style={{ position: "relative", minWidth: 240 }}>
      <label htmlFor={inputId} className="hint" style={{ display: "block", marginBottom: 4, color: "var(--c-ink-soft)", fontSize: "0.82rem" }}>
        {label}
      </label>
      <button
        type="button"
        id={inputId}
        className="combo-trigger"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-haspopup="listbox"
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, width: "100%",
          font: "inherit", color: "var(--c-ink)", cursor: "pointer",
          padding: "8px var(--space-3)", borderRadius: "var(--radius-md)",
          border: "1px solid var(--c-border-strong)", background: "var(--c-surface)",
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
          {selected ? selected.name : t("countryNotSet", { defaultValue: "Not set" })}
        </span>
        <Icons.chevronDown size={14} />
      </button>
      {open && (
        <div
          className="combo-pop"
          style={{
            position: "absolute", zIndex: 30, top: "calc(100% + 4px)", left: 0, right: 0,
            background: "var(--c-surface)", border: "1px solid var(--c-border-strong)", borderRadius: "var(--radius-md)",
            boxShadow: "var(--c-shadow-lift)", overflow: "hidden",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderBottom: "1px solid var(--c-border)" }}>
            <Icons.search size={14} />
            <input
              autoFocus
              value={query}
              onChange={(e) => { setQuery(e.target.value); setActiveIdx(0); }}
              onKeyDown={onKeyDown}
              placeholder={t("countrySearch", { defaultValue: "Search country or region" })}
              aria-label={t("countrySearch", { defaultValue: "Search country or region" })}
              style={{ flex: 1, border: "none", outline: "none", background: "transparent", color: "var(--c-ink)", font: "inherit", padding: "4px 0" }}
            />
          </div>
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label={label}
            style={{ listStyle: "none", margin: 0, padding: 4, maxHeight: 260, overflowY: "auto" }}
          >
            {allowClear && query.trim() === "" && (
              <li role="option" aria-selected={value === ""}>
                <button
                  type="button"
                  onClick={() => pick("")}
                  onMouseEnter={() => setActiveIdx(0)}
                  style={optionStyle(value === "", activeIdx === 0)}
                >
                  <em style={{ opacity: 0.75 }}>{t("countryNotSet", { defaultValue: "Not set" })}</em>
                </button>
              </li>
            )}
            {results.map((c, idx) => {
              const offset = allowClear && query.trim() === "" ? 1 : 0;
              const isActive = idx + offset === activeIdx;
              return (
                <li key={c.code} role="option" aria-selected={value === c.code}>
                  <button
                    type="button"
                    onClick={() => pick(c.code)}
                    onMouseEnter={() => setActiveIdx(idx + offset)}
                    style={optionStyle(value === c.code, isActive)}
                  >
                    <span style={{ flex: 1, textAlign: "left" }}>{c.name}</span>
                    <span style={{ color: "var(--c-ink-faint)", fontSize: "0.78rem" }}>{c.code}</span>
                  </button>
                </li>
              );
            })}
            {results.length === 0 && (
              <li style={{ padding: "10px", color: "var(--c-ink-faint)" }} role="option" aria-selected={false}>
                {t("countryNoMatch", { defaultValue: "No match" })}
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

function optionStyle(selected: boolean, active: boolean): React.CSSProperties {
  return {
    display: "flex", alignItems: "center", gap: 8, width: "100%",
    font: "inherit", fontSize: "0.9rem", color: "var(--c-ink)", cursor: "pointer",
    padding: "7px 10px", borderRadius: "var(--radius-sm)", border: "none",
    background: selected
      ? "color-mix(in srgb, var(--c-primary) 18%, transparent)"
      : active
        ? "color-mix(in srgb, var(--c-primary) 8%, transparent)"
        : "transparent",
    fontWeight: selected ? 600 : 400,
  };
}
