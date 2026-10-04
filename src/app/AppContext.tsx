/**
 * App-wide UI state: settings, toasts, and simple dialogs.
 * Settings are persisted through settingsRepository.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { DEFAULT_SETTINGS, DEFAULT_NOTIFICATION_PREFERENCES, type AppSettings } from "../types/settings";
import { getSetting as getSettingDb, setSetting } from "../storage/repositories";
import {
  listNotifications,
  unreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
  clearNotifications,
  recordNotification,
  isQuietHours,
  type NotificationDraft,
} from "../storage/notificationService";
import type { NotificationRecord } from "../storage/db";
import { changeLanguage } from "../i18n";
import { markGuidanceComplete, recordTourResult, type GuidanceSystemId } from "../features/tutorial/guidance";
import { sendSystemNotification } from "../notifications/delivery";
import {
  DEFAULT_LAN_SYNC_CONFIG,
  runSyncRound,
  lanStart,
  lanStop,
  lanSetEnabled,
  lanNewPairingCode,
  lanLocalAddress,
  lanIdentity,
  lanTakePairRequests,
  lanTrusted,
  lanSyncSupported,
  SYNC_CONFLICTS_KEY,
  type LanSyncConfig,
  type SyncConflict,
} from "../features/sync/lanSync";
import type { TourStepV2, TourResult } from "../features/tutorial/tourStepsTypes";

interface ToastItem {
  id: number;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  leaving?: boolean;
}

interface GuidanceRun {
  systemId: GuidanceSystemId;
  steps: TourStepV2[];
}

/** dev.19: app-wide LAN sync lifecycle state (see LanSyncState). */
export interface LanPairRequest {
  fingerprint: string;
  public_key: string;
  name: string;
  address: string;
}
export interface LanTrustedDevice {
  fingerprint: string;
  fingerprintFormatted: string;
  name: string;
  addedAt: string;
}
export interface LanSyncState {
  log: string[];
  lastSync: string | null;
  address: string | null;
  pairingCode: string;
  identity: { fingerprintFormatted: string; fingerprint: string } | null;
  pairRequests: LanPairRequest[];
  trustedDevices: LanTrustedDevice[];
  conflicts: SyncConflict[];
}

interface AppContextValue {
  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => void;
  showToast: (message: string, options?: { actionLabel?: string; onAction?: () => void }) => void;
  storageReady: boolean;
  /** Currently running guidance system (spotlight tours), if any. */
  guidance: GuidanceRun | null;
  /** Start a named guidance system with explicit steps. Completion is
   *  persisted under that system's own key — never any other. */
  startGuidance: (systemId: GuidanceSystemId, steps: TourStepV2[]) => void;
  /** End the running tour with an honest result (dev.18). Only runs whose
   *  status is "completed" (zero auto-skipped steps) are persisted complete. */
  endGuidance: (result: TourResult) => void;
  /** Notification center state (local notifications only). */
  notifications: NotificationRecord[];
  unreadNotifications: number;
  refreshNotifications: () => Promise<void>;
  notify: (draft: NotificationDraft) => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  clearNotifications: () => Promise<void>;
  /** dev.19: app-wide LAN sync state; sync keeps running outside Settings. */
  lanSync: LanSyncState;
  refreshLanSyncTrusted: () => Promise<void>;
  /** Remove a handled pairing request from the visible list. */
  dismissLanPairRequest: (fingerprint: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}

let toastId = 0;

export function AppProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [storageReady, setStorageReady] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [guidance, setGuidance] = useState<GuidanceRun | null>(null);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [lanSync, setLanSync] = useState<LanSyncState>({
    log: [], lastSync: null, address: null, pairingCode: "", identity: null,
    pairRequests: [], trustedDevices: [], conflicts: [],
  });
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const lanAddLog = useCallback((line: string) => {
    setLanSync((s) => ({ ...s, log: [`${new Date().toLocaleTimeString()} — ${line}`, ...s.log].slice(0, 8) }));
  }, []);
  const refreshLanSyncTrusted = useCallback(async () => {
    if (!lanSyncSupported()) return;
    try {
      const trustedDevices = await lanTrusted();
      setLanSync((s) => ({ ...s, trustedDevices }));
    } catch { /* server not started */ }
  }, []);
  const dismissLanPairRequest = useCallback((fingerprint: string) => {
    setLanSync((s) => ({ ...s, pairRequests: s.pairRequests.filter((p) => p.fingerprint !== fingerprint) }));
  }, []);

  useEffect(() => {
    getSettingDb<AppSettings>("app-settings").then((stored) => {
      if (stored) {
        const notificationsPrefs = {
          ...DEFAULT_NOTIFICATION_PREFERENCES,
          ...(stored.notifications ?? {}),
          categories: {
            ...DEFAULT_NOTIFICATION_PREFERENCES.categories,
            ...(stored.notifications?.categories ?? {}),
          },
        };
        const merged: AppSettings = { ...DEFAULT_SETTINGS, ...stored, notifications: notificationsPrefs };
        void changeLanguage(merged.language);
        // dev.19: motion (full) and ambient (on) stay ON by default — the app
        // no longer silently downgrades the ambient background when the OS
        // requests reduced motion. Functional transitions already never delay
        // actions; users can still pick Reduced/Off themselves.
        setSettings(merged);
      }
      setStorageReady(true);
    });
  }, []);

  // Pause ambient background animation while the window is hidden (battery).
  useEffect(() => {
    const onVis = () => document.body.classList.toggle("hidden-pause", document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  // dev.19: app-wide LAN sync lifecycle. The server + sync round loop live
  // here (not in the Settings panel) so sync keeps running wherever the user
  // is in the app; a 3 s watch on the persisted config starts/stops it.
  useEffect(() => {
    if (!lanSyncSupported()) return;
    let cancelled = false;
    let stopFlag = false;
    let running = false;
    const tick = async () => {
      if (cancelled) return;
      const config = ((await getSettingDb<LanSyncConfig>("lan-sync-config")) ?? DEFAULT_LAN_SYNC_CONFIG) as LanSyncConfig;
      const enabled = !!config?.enabled;
      if (enabled && !running) {
        running = true;
        stopFlag = false;
        void (async () => {
          try {
            await lanStart(config.port);
            void lanSetEnabled(true);
            const address = await lanLocalAddress(config.port);
            const identity = await lanIdentity();
            const pairingCode = await lanNewPairingCode();
            setLanSync((s) => ({ ...s, address, pairingCode, identity }));
            lanAddLog("LAN sync server started (encrypted)");
            while (!stopFlag) {
              const current = ((await getSettingDb<LanSyncConfig>("lan-sync-config")) ?? config) as LanSyncConfig;
              if (!current.enabled || cancelled) break;
              const deviceName = settingsRef.current.displayName || settingsRef.current.professionalProfile?.name || "Device";
              const r = await runSyncRound(current, deviceName, lanAddLog);
              if (r.added > 0 || r.updated > 0 || r.peersUp > 0) {
                setLanSync((s) => ({ ...s, lastSync: new Date().toISOString() }));
              }
              const conflicts = ((await getSettingDb<SyncConflict[]>(SYNC_CONFLICTS_KEY)) ?? []).slice(-20);
              const trustedDevices = await lanTrusted();
              const reqs = await lanTakePairRequests().catch(() => []);
              setLanSync((s) => ({
                ...s,
                conflicts,
                trustedDevices,
                pairRequests: reqs.length > 0
                  ? [...s.pairRequests, ...reqs.filter((p) => !s.pairRequests.some((q) => q.fingerprint === p.fingerprint))]
                  : s.pairRequests,
              }));
              await new Promise((res) => setTimeout(res, 5000));
            }
          } catch (e) {
            lanAddLog(`error: ${String(e).slice(0, 90)}`);
          }
          running = false;
        })();
      } else if (!enabled && running) {
        stopFlag = true;
        // dev.19: the listener stays bound, but every sync/pair endpoint now
        // rejects server-side — no fragile shutdown/rebind cycle.
        void lanSetEnabled(false);
      }
    };
    const iv = window.setInterval(tick, 3000);
    void tick();
    return () => {
      cancelled = true;
      stopFlag = true;
      window.clearInterval(iv);
      void lanStop();
    };
  }, [lanAddLog]);

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
    document.documentElement.dataset.density = settings.density;
    document.documentElement.dataset.motion = settings.motion;
    document.documentElement.dataset.ambient = settings.ambient;
  }, [settings.theme, settings.density, settings.motion, settings.ambient]);

  // dev.19: persist outside the state updater — updater functions must stay
  // pure (React may re-invoke or discard them), which previously could drop
  // or double-write settings saves.
  const settingsLoaded = useRef(false);
  useEffect(() => {
    if (!storageReady) return;
    if (!settingsLoaded.current) {
      settingsLoaded.current = true;
      // The initial load must not echo defaults over stored settings before
      // the async read completes; skip persisting once at startup.
      return;
    }
    void setSetting("app-settings", settings);
  }, [settings, storageReady]);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      if (patch.language) void changeLanguage(patch.language);
      return next;
    });
  }, []);

  const showToast = useCallback(
    (message: string, options?: { actionLabel?: string; onAction?: () => void }) => {
      const id = ++toastId;
      setToasts((prev) => [...prev, { id, message, ...options }]);
      setTimeout(() => {
        setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
        setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 300);
      }, 4500);
    },
    []
  );

  const startGuidance = useCallback((systemId: GuidanceSystemId, steps: TourStepV2[]) => {
    setGuidance({ systemId, steps });
  }, []);
  const endGuidance = useCallback((result: TourResult) => {
    setGuidance((current) => {
      if (current) {
        // dev.18: record every run honestly; persist completion only for
        // clean runs (every official target resolved, zero auto-skips).
        recordTourResult({ ...result, systemId: current.systemId });
        if (result.status === "completed") void markGuidanceComplete(current.systemId);
      }
      return null;
    });
  }, []);

  const refreshNotifications = useCallback(async () => {
    const [all, unread] = await Promise.all([listNotifications(), unreadNotificationCount()]);
    setNotifications(all);
    setUnreadNotifications(unread);
  }, []);

  useEffect(() => {
    if (storageReady) void refreshNotifications();
  }, [storageReady, refreshNotifications]);

  /** Record a notification for the center; raise an in-app toast when allowed
   *  by the user's preferences (delivery beyond in-app does not exist yet). */
  const notify = useCallback(
    async (draft: NotificationDraft) => {
      const prefs = settings.notifications;
      if (prefs && prefs.categories[draft.category] === false) return;
      const quiet = prefs?.quietHoursEnabled && isQuietHours(prefs.quietHoursStart, prefs.quietHoursEnd);
      await recordNotification(draft);
      await refreshNotifications();
      if (prefs?.inApp && !quiet) {
        showToast(`${draft.title} — ${draft.body}`);
      }
      // dev.18: opt-in native delivery (desktop toast / browser notification).
      // Quiet hours also silence system delivery; failures are silent here
      // because the in-app copy was still delivered.
      if (prefs?.systemDelivery && !quiet) {
        void sendSystemNotification(draft.title, draft.body);
      }
    },
    [settings.notifications, refreshNotifications, showToast]
  );

  const doMarkRead = useCallback(
    async (id: string) => {
      await markNotificationRead(id);
      await refreshNotifications();
    },
    [refreshNotifications]
  );

  const doMarkAllRead = useCallback(async () => {
    await markAllNotificationsRead();
    await refreshNotifications();
  }, [refreshNotifications]);

  const doClearNotifications = useCallback(async () => {
    await clearNotifications();
    await refreshNotifications();
  }, [refreshNotifications]);

  const value = useMemo(
    () => ({
      settings, updateSettings, showToast, storageReady, guidance, startGuidance, endGuidance,
      notifications, unreadNotifications, refreshNotifications, notify,
      markNotificationRead: doMarkRead, markAllNotificationsRead: doMarkAllRead, clearNotifications: doClearNotifications,
      lanSync, refreshLanSyncTrusted, dismissLanPairRequest,
    }),
    [settings, updateSettings, showToast, storageReady, guidance, startGuidance, endGuidance,
      notifications, unreadNotifications, refreshNotifications, notify, doMarkRead, doMarkAllRead, doClearNotifications,
      lanSync, refreshLanSyncTrusted, dismissLanPairRequest]
  );

  return (
    <AppContext.Provider value={value}>
      {children}
      <div className="toast-region" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast${t.leaving ? " leaving" : ""}`}>
            <span>{t.message}</span>
            {t.actionLabel && (
              <button
                onClick={() => {
                  t.onAction?.();
                  setToasts((prev) => prev.filter((x) => x.id !== t.id));
                }}
              >
                {t.actionLabel}
              </button>
            )}
          </div>
        ))}
      </div>
    </AppContext.Provider>
  );
}

/** Simple hook that keeps a debounced save status for autosave indicators. */
export function useSaveStatus() {
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const timer = useRef<number | undefined>(undefined);
  const markSaving = useCallback(() => {
    setStatus("saving");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setStatus("saved"), 600);
  }, []);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return { status, markSaving };
}
