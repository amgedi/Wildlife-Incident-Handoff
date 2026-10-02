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
import { isTauri } from "../utils/platformFile";
import { BearPawMark } from "./BrandMark";

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
        <BearPawMark size={20} />
        <span data-tauri-drag-region>Wildlife Incident Handoff</span>
      </div>
      <div className="titlebar-controls">
        <button
          className="titlebar-btn"
          aria-label="Minimize"
          onClick={() => void api.minimize()}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M0 5h10" stroke="currentColor" strokeWidth="1" /></svg>
        </button>
        <button
          className="titlebar-btn"
          aria-label={maximized ? "Restore" : "Maximize"}
          onClick={() => void api.toggleMaximize().then(() => api.isMaximized().then(setMaximized))}
        >
          {maximized ? (
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 0v8h8M0 2h8v8" fill="none" stroke="currentColor" strokeWidth="1" /></svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><rect x="0.5" y="0.5" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="1" /></svg>
          )}
        </button>
        <button className="titlebar-btn titlebar-close" aria-label="Close" onClick={() => void api.close()}>
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M0 0l10 10M10 0L0 10" stroke="currentColor" strokeWidth="1" /></svg>
        </button>
      </div>
    </div>
  );
}
