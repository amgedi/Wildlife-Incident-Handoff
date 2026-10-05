/** Launcher application store: prefs, identity, view routing. */
import { createContext, useContext } from "react";
import type { Identity, Prefs } from "../services/tauri";

export type ViewId = "home" | "updates" | "diagnostics" | "settings" | "about" | "developer";

export interface LauncherState {
  view: ViewId;
  setView: (v: ViewId) => void;
  identity: Identity | null;
  refreshIdentity: () => Promise<void>;
  prefs: Prefs | null;
  updatePrefs: (patch: Partial<Prefs>) => Promise<void>;
  updateAvailable: string | null; // latest version when an app update exists
}

export const LauncherContext = createContext<LauncherState | null>(null);

export function useLauncher(): LauncherState {
  const ctx = useContext(LauncherContext);
  if (!ctx) throw new Error("LauncherContext missing");
  return ctx;
}

export const DEFAULT_PREFS: Prefs = {
  theme: "forest-night",
  motion: "full",
  material: "frosted",
  channel: "tester",
  autoCheckUpdates: true,
  devToolsVisible: true,
};

export const VIEW_META: Record<ViewId, { label: string }> = {
  home: { label: "Home" },
  updates: { label: "Updates" },
  diagnostics: { label: "Diagnostics" },
  settings: { label: "Settings" },
  about: { label: "About" },
  developer: { label: "Developer Tools" },
};
