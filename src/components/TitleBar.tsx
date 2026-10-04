/**
 * Desktop (Tauri) title bar.
 *
 * Decision (documented in src-tauri/README.md): the desktop build uses an
 * integrated title bar so the window chrome matches the application theme.
 * Native behavior is preserved: the whole bar is a drag region (native
 * dragging + Windows snapping), double-click maximizes (handled by Tauri on
 * drag regions), and the three buttons use the native window APIs.
 * Only rendered inside the Tauri shell; web/PWA keeps browser chrome.
 */
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { isTauri } from "../utils/platformFile";
import { AppMark } from "./BrandMark";
import { NotificationBell } from "./NotificationCenter";

interface WindowApi {
  minimize: () => Promise<void>;
  toggleMaximize: () => Promise<void>;
  close: () => Promise<void>;
  isMaximized: () => Promise<boolean>;
}

function getWindowApi(): WindowApi | null {
  const t = (window as unknown as { __TAURI__?: { window?: { getCurrentWindow?: () => WindowApi } } }).__TAURI__;
  return t?.window?.getCurrentWindow?.() ?? null;
}

export function TitleBar() {
  const [maximized, setMaximized] = useState(false);
  const { t } = useTranslation("titlebar");
  const api = getWindowApi();

  useEffect(() => {
    if (!api?.isMaximized) return;
    api.isMaximized().then(setMaximized).catch(() => undefined);
  }, [api]);

  if (!isTauri() || !api) return null;

  return (
    <div
      data-tauri-drag-region
      className="titlebar"
      role="banner"
      aria-label="Window title bar"
    >
      <div className="titlebar-brand" data-tauri-drag-region>
        <AppMark size={20} />
        <span data-tauri-drag-region>Wildlife Incident Handoff</span>
      </div>
      {/* 0.3 titlebar command area: global search launcher (opens the palette). */}
      <div className="titlebar-center" data-tauri-drag-region={false}>
        <button
          className="btn btn-quiet btn-sm"
          data-testid="titlebar-search"
          aria-label="Search (Ctrl+K)"
          title="Search (Ctrl+K)"
          onClick={() => window.dispatchEvent(new Event("wih:open-palette"))}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          Search
        </button>
      </div>
      <div className="titlebar-bell" data-tauri-drag-region={false}>
        <NotificationBell />
      </div>
      <div className="titlebar-controls">
        <button
          className="titlebar-btn"
          aria-label={t("minimize")}
          onClick={() => void api.minimize()}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M0 5h10" stroke="currentColor" strokeWidth="1" /></svg>
        </button>
        <button
          className="titlebar-btn"
          aria-label={maximized ? t("restore") : t("maximize")}
          onClick={() => void api.toggleMaximize().then(() => api.isMaximized().then(setMaximized))}
        >
          {maximized ? (
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 0v8h8M0 2h8v8" fill="none" stroke="currentColor" strokeWidth="1" /></svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><rect x="0.5" y="0.5" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="1" /></svg>
          )}
        </button>
        <button className="titlebar-btn titlebar-close" aria-label={t("closeWindow")} onClick={() => void api.close()}>
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M0 0l10 10M10 0L0 10" stroke="currentColor" strokeWidth="1" /></svg>
        </button>
      </div>
    </div>
  );
}
