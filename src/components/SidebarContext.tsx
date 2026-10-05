/**
 * Sidebar contextual sections (0.3.0-dev.3, spec 52–56, 98): pinned views,
 * recent incidents, and a compact status block — filling the sidebar's dead
 * vertical space with useful, user-controlled content (never junk nav).
 * Sections are optional; preferences persist locally ("sidebar-prefs").
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useApp } from "../app/AppContext";
import { getSetting, getAllIncidents } from "../storage/repositories";
import { animalLabel } from "../features/export/exportService";
import { relativeTime } from "../utils/time";
import { StatusBadge } from "./ui";

export interface SidebarPrefs {
  showPinned: boolean;
  showRecent: boolean;
  showStatus: boolean;
}

export const DEFAULT_SIDEBAR_PREFS: SidebarPrefs = { showPinned: true, showRecent: true, showStatus: true };

export interface SavedView {
  id: string;
  name: string;
  filters: Record<string, string>;
}

const BUILTIN_PINNED: Array<{ id: string; label: string; to: string }> = [
  { id: "pinned-unassigned", label: "Unassigned", to: "/incidents?category=awaiting" },
  { id: "pinned-waiting", label: "Waiting >2h", to: "/incidents?category=active" },
  { id: "pinned-handoffs", label: "Handoffs", to: "/incidents?category=active" },
];

export async function loadSidebarPrefs(): Promise<SidebarPrefs> {
  const saved = await getSetting<Partial<SidebarPrefs>>("sidebar-prefs");
  return { ...DEFAULT_SIDEBAR_PREFS, ...(saved ?? {}) };
}

export function SidebarContextSections({ onlyPro = true }: { onlyPro?: boolean }) {
  const { t } = useTranslation(["professional", "navigation"]);
  const { settings, lanSync } = useApp();
  const [prefs, setPrefs] = useState<SidebarPrefs>(DEFAULT_SIDEBAR_PREFS);
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [recent, setRecent] = useState<Array<{ id: string; ref: string; label: string; time: string; status: string }>>([]);
  const isPro = settings.workspace === "professional";

  useEffect(() => {
    let alive = true;
    void loadSidebarPrefs().then((p) => { if (alive) setPrefs(p); });
    void getSetting<SavedView[]>("incident-saved-views").then((v) => {
      if (alive && Array.isArray(v)) setSavedViews(v.slice(0, 3));
    });
    void getAllIncidents().then((all) => {
      if (!alive) return;
      const live = (all ?? [])
        .filter((i) => !i.deletedAt && !i.archivedAt && !i.isDemo)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, 3)
        .map((i) => ({
          id: i.id,
          ref: i.humanReference,
          label: animalLabel(i),
          time: relativeTime(i.updatedAt),
          status: i.status,
        }));
      setRecent(live);
    });
    return () => { alive = false; };
  }, []);

  if (onlyPro && !isPro) return null;
  const nothingToShow = !prefs.showPinned && !prefs.showRecent && !prefs.showStatus;
  if (nothingToShow) return null;

  const pinned = prefs.showPinned
    ? [...savedViews.map((v) => ({ id: `sv-${v.id}`, label: v.name, to: `/incidents?view=${encodeURIComponent(v.id)}` })), ...BUILTIN_PINNED].slice(0, 5)
    : [];

  return (
    <div className="sidebar-context" data-testid="sidebar-context">
      {pinned.length > 0 && (
        <nav aria-label={t("sidebarPinned", { defaultValue: "Pinned views" })} className="sidebar-section">
          <p className="sidebar-section-label">{t("sidebarPinned", { defaultValue: "Pinned" })}</p>
          {pinned.map((p) => (
            <Link key={p.id} to={p.to} className="sidebar-context-item">
              {p.label}
            </Link>
          ))}
        </nav>
      )}
      {prefs.showRecent && recent.length > 0 && (
        <nav aria-label={t("sidebarRecent", { defaultValue: "Recent incidents" })} className="sidebar-section">
          <p className="sidebar-section-label">{t("sidebarRecent", { defaultValue: "Recent" })}</p>
          {recent.map((r) => (
            <Link key={r.id} to={`/incidents/${r.id}`} className="sidebar-context-item">
              <span className="sidebar-context-ref">{r.ref}</span>
              <span className="sidebar-context-sub">{r.label} · {r.time}</span>
            </Link>
          ))}
        </nav>
      )}
      {/* 0.3.0-dev.6 (spec 56): "Local only" removed from the sidebar —
          local-only is the normal state and does not deserve prominent space.
          Connection state lives in Settings → Devices/Sync; the sidebar only
          surfaces it when the user opted into LAN sync (action needed). */}
      {prefs.showStatus && lanSync.address != null && !lanSync.lastSync && (
        <div className="sidebar-status" aria-label={t("sidebarStatus", { defaultValue: "Status" })}>
          <span className="sidebar-status-item">
            <span className="sidebar-status-dot" aria-hidden="true" />
            {t("sidebarLanWaiting", { defaultValue: "LAN sync — waiting for a paired device" })}
          </span>
        </div>
      )}
    </div>
  );
}

// StatusBadge re-exported for potential table reuse; keeps tree-shaking simple.
export { StatusBadge };
