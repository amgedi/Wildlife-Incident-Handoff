/**
 * Command Palette (0.3, spec items 120–121) — Ctrl+K from anywhere.
 * Searches: navigation destinations, incidents (reference/animal/location),
 * saved views, settings sections, and Help topics. One palette, not four
 * search systems: the titlebar search opens this.
 *
 * Local-first: everything is resolved from local records and static lists;
 * nothing leaves the device.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useApp } from "../app/AppContext";
import { useIncidents } from "../features/incidents/IncidentCard";
import { PROFESSIONAL_NAV_ITEMS, REPORTER_NAV_ITEMS } from "../app/navigation";
import { SECTIONS_HINTS } from "./commandIndex";
import { animalLabel } from "../features/export/exportService";
import { Icons } from "./Icons";
import { relativeTime } from "../utils/time";

interface Command {
  id: string;
  group: string;
  label: string;
  hint?: string;
  run: () => void;
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { settings } = useApp();
  const { incidents } = useIncidents();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const isPro = settings.workspace === "professional";

  const commands = useMemo<Command[]>(() => {
    const out: Command[] = [];
    const nav = isPro ? PROFESSIONAL_NAV_ITEMS : REPORTER_NAV_ITEMS;
    for (const item of nav) {
      out.push({
        id: `nav-${item.to}`,
        group: t("paletteGroupGo", { defaultValue: "Go to" }),
        label: t(`navigation:${item.labelKey}`, { ns: "navigation", defaultValue: item.labelKey }),
        run: () => navigate(item.to),
      });
    }
    for (const s of SECTIONS_HINTS) {
      out.push({
        id: `settings-${s.id}`,
        group: t("paletteGroupSettings", { defaultValue: "Settings" }),
        label: t(`settings:${s.labelKey}`, { ns: "settings", defaultValue: s.labelKey }),
        hint: s.keywords.split(" ").slice(0, 3).join(", "),
        run: () => navigate(`/settings?section=${s.id}`),
      });
    }
    const live = (incidents ?? [])
      .filter((i) => !i.deletedAt && !i.archivedAt && !i.isDemo)
      .slice(0, 400); // palette stays fast on big local stores
    for (const i of live) {
      out.push({
        id: `incident-${i.id}`,
        group: t("paletteGroupIncidents", { defaultValue: "Incidents" }),
        label: `${i.humanReference} — ${animalLabel(i)}`,
        hint: `${i.status}${i.location.description ? ` · ${i.location.description}` : ""} · ${relativeTime(i.occurredAt ?? i.createdAt)}`,
        run: () => navigate(`/incidents/${i.id}`),
      });
    }
    return out;
  }, [incidents, isPro, navigate, t]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands.filter((c) => c.group !== t("paletteGroupIncidents", { defaultValue: "Incidents" })).slice(0, 12);
    return commands
      .filter((c) => `${c.label} ${c.hint ?? ""}`.toLowerCase().includes(q))
      .slice(0, 14);
  }, [commands, query, t]);

  useEffect(() => {
    setActive((a) => Math.min(a, Math.max(0, results.length - 1)));
  }, [results.length]);

  if (!open) return null;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(results.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const cmd = results[active];
      if (cmd) {
        cmd.run();
        onClose();
      }
    }
  };

  return (
    <div
      className="palette-scrim"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={onKeyDown}
    >
      <div className="palette" role="dialog" aria-modal="true" aria-label={t("paletteTitle", { defaultValue: "Command palette" })}>
        <div className="palette-input" style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderBottom: "1px solid var(--c-border)" }}>
          <Icons.search size={16} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("palettePlaceholder", { defaultValue: "Search incidents, views, settings, help…" })}
            aria-label={t("paletteTitle", { defaultValue: "Command palette" })}
            style={{ flex: 1, border: "none", outline: "none", background: "transparent", color: "var(--c-ink)", font: "inherit", padding: "2px 0" }}
          />
          <span className="kbd-hint">Esc</span>
        </div>
        <ul ref={listRef} role="listbox" aria-label={t("paletteTitle", { defaultValue: "Command palette" })} style={{ listStyle: "none", margin: 0, padding: 6, maxHeight: "min(420px, 60vh)", overflowY: "auto" }}>
          {results.map((cmd, idx) => (
            <li key={cmd.id} role="option" aria-selected={idx === active}>
              <button
                className="palette-item"
                onClick={() => {
                  cmd.run();
                  onClose();
                }}
                onMouseEnter={() => setActive(idx)}
                style={{
                  display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", font: "inherit",
                  color: "var(--c-ink)", cursor: "pointer", border: "none", borderRadius: "var(--radius-sm)",
                  padding: "8px 10px",
                  background: idx === active ? "color-mix(in srgb, var(--c-primary) 12%, transparent)" : "transparent",
                }}
              >
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 550 }}>{cmd.label}</span>
                  {cmd.hint && <span className="hint" style={{ display: "block", margin: 0 }}>{cmd.hint}</span>}
                </span>
                <span className="hint" style={{ flex: "none", margin: 0 }}>{cmd.group}</span>
              </button>
            </li>
          ))}
          {results.length === 0 && (
            <li className="hint" style={{ padding: 12 }} role="option" aria-selected={false}>
              {t("paletteEmpty", { defaultValue: "No matches" })}
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}

/** Global Ctrl+K / Cmd+K binding; renders the palette. Mount once in App. */
export function openCommandPalette() {
  window.dispatchEvent(new Event("wih:open-palette"));
}

export function CommandPaletteBinding() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    const onOpenEvent = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("wih:open-palette", onOpenEvent);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("wih:open-palette", onOpenEvent);
    };
  }, []);
  return (
    <>
      <CommandPalette open={open} onClose={() => setOpen(false)} />
      {/* Search affordance for the titlebar */}

    </>
  );
}
