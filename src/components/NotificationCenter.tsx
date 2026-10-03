/** Notification bell + popover panel (local notifications only). */
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useApp } from "../app/AppContext";
import { Icons } from "./Icons";

export function NotificationBell({ withLabel = false }: { withLabel?: boolean } = {}) {
  const {
    notifications, unreadNotifications, refreshNotifications,
    markNotificationRead, markAllNotificationsRead, clearNotifications,
  } = useApp();
  const { t } = useTranslation("settings");
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [panelPos, setPanelPos] = useState<{ left: number; top: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  // Clamp the panel INSIDE the window: sidebar-edge popovers used to clip (user report).
  const placePanel = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const width = Math.min(340, window.innerWidth - 16);
    let left = r.right + 8;
    if (left + width > window.innerWidth - 8) left = window.innerWidth - width - 8;
    if (left < 8) left = 8;
    const top = Math.max(8, Math.min(r.top - 4, window.innerHeight - 120));
    setPanelPos({ left, top });
  };

  useEffect(() => {
    void refreshNotifications();
  }, [refreshNotifications]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onReposition = () => { if (open) placePanel(); };
    window.addEventListener("resize", onReposition);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", onReposition);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} style={{ position: "relative", display: "inline-flex" }}>
      <button
        className={withLabel ? "nav-item nav-bell-item" : "btn btn-quiet btn-sm"}
        aria-label={t("notifBellLabel", { defaultValue: "Notifications", count: unreadNotifications })}
        aria-expanded={open}
        ref={btnRef}
        onClick={() => setOpen((v) => { const next = !v; if (next) placePanel(); return next; })}
        style={{ position: "relative" }}
      >
        <Icons.bell size={18} />
        {withLabel && <span>{t("notifBellLabel", { defaultValue: "Notifications" })}</span>}
        {unreadNotifications > 0 && (
          <span
            aria-hidden="true"
            style={{
              position: "absolute", top: -4, right: -4, minWidth: 16, height: 16, padding: "0 4px",
              borderRadius: 999, background: "var(--c-primary)", color: "var(--c-primary-ink)",
              fontSize: "0.68rem", fontWeight: 700, display: "grid", placeItems: "center",
            }}
          >
            {unreadNotifications > 99 ? "99+" : unreadNotifications}
          </span>
        )}
      </button>
      {open && (
        <div
          className="card notif-panel"
          role="dialog"
          aria-label={t("notifPanelTitle", { defaultValue: "Notifications" })}
          style={{
            position: "fixed",
            left: panelPos ? Math.round(panelPos.left) : undefined,
            top: panelPos ? Math.round(panelPos.top) : undefined,
            width: 340, maxWidth: "calc(100vw - 16px)",
            zIndex: 260, boxShadow: "var(--shadow-lg, 0 12px 32px rgb(0 0 0 / 0.25))", padding: "var(--space-3)",
          }}
        >
          <div className="row between" style={{ marginBottom: 6 }}>
            <strong>{t("notifPanelTitle", { defaultValue: "Notifications" })}</strong>
            <div className="row" style={{ gap: 6 }}>
              <button className="btn btn-quiet btn-sm" onClick={() => void markAllNotificationsRead()}>
                {t("notifMarkAllRead", { defaultValue: "Mark read" })}
              </button>
              <button className="btn btn-quiet btn-sm" onClick={() => void clearNotifications()}>
                {t("notifClear", { defaultValue: "Clear" })}
              </button>
            </div>
          </div>
          {notifications.length === 0 ? (
            <p className="hint" style={{ margin: "var(--space-3) 0" }}>
              {t("notifEmpty", { defaultValue: "No notifications yet. Activity from your records will appear here." })}
            </p>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, maxHeight: 320, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
              {notifications.slice(0, 30).map((n) => (
                <li key={n.id}>
                  <button
                    onClick={() => {
                      void markNotificationRead(n.id);
                      setOpen(false);
                      if (n.incidentId) navigate(`/incidents/${n.incidentId}`);
                    }}
                    style={{
                      display: "block", width: "100%", textAlign: "left", font: "inherit", cursor: "pointer",
                      background: n.read ? "transparent" : "var(--c-primary-faint, rgb(127 255 127 / 0.08))",
                      border: "1px solid var(--c-border)", borderRadius: "var(--radius-sm)",
                      padding: "8px 10px", color: "var(--c-ink)",
                    }}
                  >
                    <span style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <strong style={{ fontSize: "0.88rem" }}>{n.title}</strong>
                      <span style={{ color: "var(--c-ink-faint)", fontSize: "0.75rem", whiteSpace: "nowrap" }}>
                        {new Date(n.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </span>
                    <span style={{ display: "block", fontSize: "0.82rem", color: "var(--c-ink-soft)", overflowWrap: "anywhere" }}>{n.body}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="hint" style={{ marginBottom: 0 }}>
            {t("notifLocalOnly", { defaultValue: "Local notifications from your own records — no server push." })}
          </p>
        </div>
      )}
    </div>
  );
}
