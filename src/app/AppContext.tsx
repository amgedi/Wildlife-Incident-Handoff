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
import { getSetting, setSetting } from "../storage/repositories";
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
import { markGuidanceComplete, type GuidanceSystemId } from "../features/tutorial/guidance";
import type { TourStepV2 } from "../features/tutorial/tourStepsTypes";

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
  endGuidance: (markComplete: boolean) => void;
  /** Notification center state (local notifications only). */
  notifications: NotificationRecord[];
  unreadNotifications: number;
  refreshNotifications: () => Promise<void>;
  notify: (draft: NotificationDraft) => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  clearNotifications: () => Promise<void>;
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

  useEffect(() => {
    getSetting<AppSettings>("app-settings").then((stored) => {
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
        // dev.14: animations stay ON by default (motion: "full") even when the
        // OS requests reduced motion — only the decorative AMBIENT background
        // is toned down automatically. Users can still pick Reduced/Off; the
        // settings hint documents the OS preference handling.
        if (stored.motion === DEFAULT_SETTINGS.motion && stored.ambient === DEFAULT_SETTINGS.ambient && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          merged.ambient = "reduced";
        }
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

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
    document.documentElement.dataset.density = settings.density;
    document.documentElement.dataset.motion = settings.motion;
    document.documentElement.dataset.ambient = settings.ambient;
  }, [settings.theme, settings.density, settings.motion]);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      void setSetting("app-settings", next);
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
  const endGuidance = useCallback((markComplete: boolean) => {
    setGuidance((current) => {
      if (current && markComplete) void markGuidanceComplete(current.systemId);
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
    }),
    [settings, updateSettings, showToast, storageReady, guidance, startGuidance, endGuidance,
      notifications, unreadNotifications, refreshNotifications, notify, doMarkRead, doMarkAllRead, doClearNotifications]
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
