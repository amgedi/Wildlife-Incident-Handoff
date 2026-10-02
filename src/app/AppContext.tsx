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
import { DEFAULT_SETTINGS, type AppSettings } from "../types/settings";
import { getSetting, setSetting } from "../storage/repositories";
import { setLocale } from "../i18n";

interface ToastItem {
  id: number;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  leaving?: boolean;
}

interface AppContextValue {
  settings: AppSettings;
  updateSettings: (patch: Partial<AppSettings>) => void;
  showToast: (message: string, options?: { actionLabel?: string; onAction?: () => void }) => void;
  storageReady: boolean;
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

  useEffect(() => {
    getSetting<AppSettings>("app-settings").then((stored) => {
      if (stored) {
        const merged = { ...DEFAULT_SETTINGS, ...stored };
        // Respect OS reduced-motion until the user makes an explicit choice.
        if (stored.motion === DEFAULT_SETTINGS.motion && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          merged.motion = "reduced";
        }
        setSettings(merged);
        setLocale(merged.language);
      }
      setStorageReady(true);
    });
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
    document.documentElement.dataset.density = settings.density;
    document.documentElement.dataset.motion = settings.motion;
  }, [settings.theme, settings.density, settings.motion]);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      void setSetting("app-settings", next);
      if (patch.language) setLocale(patch.language);
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

  const value = useMemo(
    () => ({ settings, updateSettings, showToast, storageReady }),
    [settings, updateSettings, showToast, storageReady]
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
