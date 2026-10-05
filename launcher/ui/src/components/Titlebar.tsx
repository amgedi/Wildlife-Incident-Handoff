/** Custom integrated titlebar with window controls. */
import { useEffect, useState } from "react";

interface Win {
  minimize(): void;
  toggleMaximize(): void;
  close(): void;
  isMaximized(): Promise<boolean>;
  startDragging(): void;
}

function currentWindow(): Win | null {
  const t = (window as unknown as { __TAURI__?: { window: { getCurrentWindow(): Win } } }).__TAURI__;
  return t ? t.window.getCurrentWindow() : null;
}

export function Titlebar({ context, updatePending }: { context: string; updatePending: boolean }) {
  const [maximized, setMaximized] = useState(false);
  useEffect(() => {
    const win = currentWindow();
    if (!win) return;
    void win.isMaximized().then(setMaximized).catch(() => undefined);
    const id = window.setInterval(() => { void win.isMaximized().then(setMaximized).catch(() => undefined); }, 1200);
    return () => window.clearInterval(id);
  }, []);

  const win = currentWindow();
  return (
    <div
      className="titlebar"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      onMouseDown={(e) => {
        if ((e.target as HTMLElement).closest(".tb-btn")) return;
        if (e.button === 0) win?.startDragging();
      }}
      onDoubleClick={(e) => { if (!(e.target as HTMLElement).closest(".tb-btn")) win?.toggleMaximize(); }}
    >
      <img className="app-mark" src="./emblem-32.png" alt="" draggable={false} />
      <span className="title">Wildlife Incident Handoff</span>
      <span className="context">{context}</span>
      <div className="tb-actions" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
        {updatePending && <span className="tb-update-dot" title="Update available" />}
        <button className="tb-btn" aria-label="Minimize" onClick={() => win?.minimize()}>
          <svg viewBox="0 0 10 10"><path d="M0 5h10" stroke="currentColor" strokeWidth="1.2" /></svg>
        </button>
        <button className="tb-btn" aria-label={maximized ? "Restore" : "Maximize"} onClick={() => win?.toggleMaximize()}>
          {maximized ? (
            <svg viewBox="0 0 10 10">
              <rect x="0.5" y="2.5" width="7" height="7" rx="1" fill="none" stroke="currentColor" strokeWidth="1.1" />
              <path d="M2.8 1.5h6v6" fill="none" stroke="currentColor" strokeWidth="1.1" />
            </svg>
          ) : (
            <svg viewBox="0 0 10 10"><rect x="0.6" y="0.6" width="8.8" height="8.8" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.2" /></svg>
          )}
        </button>
        <button className="tb-btn close" aria-label="Close" onClick={() => win?.close()}>
          <svg viewBox="0 0 10 10"><path d="M0.5 0.5l9 9M9.5 0.5l-9 9" stroke="currentColor" strokeWidth="1.2" /></svg>
        </button>
      </div>
    </div>
  );
}
