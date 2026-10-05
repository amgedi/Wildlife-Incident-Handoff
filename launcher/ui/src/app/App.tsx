/** Launcher app shell: ambient canvas + titlebar + nav rail + view workspace. */
import { useCallback, useEffect, useMemo, useState } from "react";
import { DEFAULT_PREFS, LauncherContext, VIEW_META, type LauncherState, type ViewId } from "./store";
import { Titlebar } from "../components/Titlebar";
import { NavRail } from "../components/NavRail";
import { Home } from "../views/Home";
import { Updates } from "../views/Updates";
import { Diagnostics } from "../views/Diagnostics";
import { Settings } from "../views/Settings";
import { About } from "../views/About";
import { Developer } from "../views/Developer";
import { api, type Prefs } from "../services/tauri";
import { DEFAULT_THEME } from "../themes";

export function App() {
  const [view, setView] = useState<ViewId>("home");
  const [identity, setIdentity] = useState<LauncherState["identity"]>(null);
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState<string | null>(null);

  const refreshIdentity = useCallback(async () => {
    try { setIdentity(await api.identity()); } catch { setIdentity(null); }
  }, []);

  // Boot: prefs (theme) first — the pre-React inline script already pinned the
  // background; this aligns tokens + persists.
  useEffect(() => {
    void (async () => {
      let p: Prefs;
      try { p = await api.prefs(); } catch { p = { ...DEFAULT_PREFS, theme: document.documentElement.dataset.theme ?? DEFAULT_THEME }; }
      applyTheme(p.theme, p.motion);
      setPrefs(p);
      await refreshIdentity();
      // Quiet auto update check shortly after startup — never blocks launch.
      if (p.autoCheckUpdates) {
        window.setTimeout(() => {
          void api.releaseCheck(p.channel).then((r) => {
            if (r.status === "available" && r.latestVersion) setUpdateAvailable(r.latestVersion);
          }).catch(() => undefined);
        }, 2500);
      }
    })();
  }, [refreshIdentity]);

  const updatePrefs = useCallback(async (patch: Partial<Prefs>) => {
    setPrefs((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      if (patch.theme) applyTheme(next.theme, next.motion);
      void api.setPrefs(next).catch(() => undefined);
      return next;
    });
  }, []);

  const state = useMemo<LauncherState>(() => ({
    view, setView, identity, refreshIdentity, prefs, updatePrefs, updateAvailable,
  }), [view, identity, refreshIdentity, prefs, updatePrefs, updateAvailable]);

  const context = VIEW_META[view].label;
  return (
    <LauncherContext.Provider value={state}>
      <div className="shell">
        <div className="ambient" aria-hidden="true" />
        <Titlebar context={context} updatePending={updateAvailable != null} />
        <div className="body">
          <NavRail launcherVersion="0.3.0-rc.2" />
          <main className="workspace" key={view}>
            {view === "home" && <Home />}
            {view === "updates" && <Updates />}
            {view === "diagnostics" && <Diagnostics />}
            {view === "settings" && <Settings />}
            {view === "about" && <About />}
            {view === "developer" && <Developer />}
          </main>
        </div>
      </div>
    </LauncherContext.Provider>
  );
}

function applyTheme(theme: string, motion: string) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.motion = motion;
}
