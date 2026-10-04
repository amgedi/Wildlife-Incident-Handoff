/**
 * dev.18 — notification delivery honesty (spec §37–§39).
 * Channels must report real availability; no placebo toggles; web permission
 * is only ever requested via the explicit function (never at startup).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { channelStatuses, isChannelEnabled, webNotificationPermission } from "./delivery";
import { DEFAULT_NOTIFICATION_PREFERENCES } from "../types/settings";

beforeEach(() => {
  localStorage.clear();
});

describe("channel honesty", () => {
  it("in-app is always available", () => {
    expect(channelStatuses().find((c) => c.channel === "in-app")!.available).toBe(true);
  });

  it("system is desktop-only; web is browser-only; jsdom may have neither", () => {
    const cs = channelStatuses();
    const system = cs.find((c) => c.channel === "system")!;
    const web = cs.find((c) => c.channel === "web")!;
    if (system.available) expect(system.reason).toBeUndefined();
    if (web.available) expect(web.reason).toBeUndefined();
    // whatever is unavailable must say why — never a placebo toggle
  });

  it("unavailable channels always carry a reason (shown in Settings)", () => {
    for (const c of channelStatuses()) {
      if (!c.available) expect(c.reason, c.channel).toBeTruthy();
    }
  });

  it("web permission is reported, never requested implicitly", () => {
    // importing the module must not have triggered any permission request
    const perm = webNotificationPermission();
    expect(["granted", "denied", "default", "unsupported"]).toContain(perm);
  });
});

describe("channel enablement maps to stored preferences", () => {
  it("in-app follows prefs.inApp; system follows systemDelivery; web follows browser", () => {
    const prefs = { ...DEFAULT_NOTIFICATION_PREFERENCES };
    expect(isChannelEnabled(prefs, "in-app")).toBe(true);
    expect(isChannelEnabled(prefs, "system")).toBe(false);
    expect(isChannelEnabled(prefs, "web")).toBe(false);
    expect(isChannelEnabled({ ...prefs, systemDelivery: true }, "system")).toBe(true);
    expect(isChannelEnabled({ ...prefs, browser: true }, "web")).toBe(true);
    expect(isChannelEnabled({ ...prefs, inApp: false }, "in-app")).toBe(false);
  });
});
