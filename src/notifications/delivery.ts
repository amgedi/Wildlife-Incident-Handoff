/**
 * Notification delivery channels (dev.18) — honest per-platform availability.
 *
 *  - "in-app": always available (toast + bell menu), the historical channel.
 *  - "system": Windows toast via the Tauri notification plugin (desktop app
 *    only). Requires no browser permission; the OS manages it.
 *  - "web": the Web Notifications API (browser/PWA only). Permission is
 *    requested ONLY after the user explicitly clicks enable — never during
 *    startup.
 *
 * Unsupported channels are reported as unavailable rather than shown as
 * placebo toggles (spec §39).
 */
import { isTauri } from "../utils/platformFile";
import type { NotificationPreferences } from "../types/settings";

export type DeliveryChannel = "in-app" | "system" | "web";

export interface ChannelStatus {
  channel: DeliveryChannel;
  available: boolean;
  /** Why it is unavailable, when it is (shown honestly in Settings). */
  reason?: string;
}

export function channelStatuses(): ChannelStatus[] {
  const statuses: ChannelStatus[] = [{ channel: "in-app", available: true }];
  if (isTauri()) {
    statuses.push({ channel: "system", available: true });
    statuses.push({ channel: "web", available: false, reason: "not_available_desktop" });
  } else {
    statuses.push({
      channel: "system",
      available: false,
      reason: "desktop_only",
    });
    statuses.push({
      channel: "web",
      available: typeof window !== "undefined" && "Notification" in window,
      reason: typeof window !== "undefined" && "Notification" in window ? undefined : "unsupported_browser",
    });
  }
  return statuses;
}

export function isChannelEnabled(prefs: NotificationPreferences, channel: DeliveryChannel): boolean {
  if (channel === "in-app") return prefs.inApp !== false;
  if (channel === "system") return prefs.systemDelivery === true;
  return prefs.browser === true;
}

/** Web permission — MUST only be called from an explicit user action. */
export async function requestWebNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}

export function webNotificationPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

/** Fire a system/web notification. Returns false when the channel could not
 *  deliver (never a silent placebo: callers surface the failure). */
export async function sendSystemNotification(title: string, body: string): Promise<boolean> {
  if (isTauri()) {
    try {
      const mod = await import("@tauri-apps/plugin-notification");
      let granted = true;
      if (await mod.isPermissionGranted() === false) {
        granted = (await mod.requestPermission()) === "granted";
      }
      if (!granted) return false;
      mod.sendNotification({ title, body });
      return true;
    } catch {
      return false;
    }
  }
  if (typeof window !== "undefined" && "Notification" in window) {
    try {
      if (Notification.permission !== "granted") return false;
      new Notification(title, { body });
      return true;
    } catch {
      return false;
    }
  }
  return false;
}
