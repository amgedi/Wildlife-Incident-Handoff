/**
 * Device Center (0.3, spec items 68–74) — surfaces the cryptographic
 * installation identity that LAN Sync already maintains, plus the human-
 * readable device profile.
 *
 * Honesty contract:
 * - Human profile ≠ device identity: a user may have several devices; a
 *   device holds one local profile.
 * - There is no cloud account backend: the app does NOT pretend to recognize
 *   the same person on unrelated devices. Profile transfer between trusted
 *   devices is offered as LAN-scoped functionality only.
 * - Private keys are NEVER shown or exported here — only the public
 *   fingerprint.
 */
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useApp } from "../../app/AppContext";
import { APP_VERSION } from "../../version";
import { lanIdentity, lanRevoke, invokeOptional, type LanIdentity } from "../sync/lanSync";
import { Icons } from "../../components/Icons";
import { Select } from "../../components/Select";

export type DeviceType = "desktop" | "laptop" | "tablet" | "phone" | "browser" | "other";
export const DEVICE_TYPES: DeviceType[] = ["desktop", "laptop", "tablet", "phone", "browser", "other"];

/** Best-effort OS label for the "this device" card (never fingerprinting). */
export function detectOs(): string {
  if (typeof navigator === "undefined") return "Unknown";
  const ua = navigator.userAgent;
  if (ua.includes("Windows")) return "Windows";
  if (ua.includes("Mac OS")) return "macOS";
  if (ua.includes("Android")) return "Android";
  if (ua.includes("iPhone") || ua.includes("iPad")) return "iOS";
  if (ua.includes("Linux")) return "Linux";
  return "Unknown";
}

/** Auto-detect a friendly device type; the user can always override. */
export function detectDeviceType(): DeviceType {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  if (ua.includes("iPhone") || ua.includes("Android") && ua.includes("Mobile")) return "phone";
  if (ua.includes("iPad") || ua.includes("Android") && ua.includes("Tablet")) return "tablet";
  // Desktop app shell vs browser
  if (!(window as unknown as { __TAURI__?: unknown }).__TAURI__) return "browser";
  if (matchMedia("(max-width: 900px)").matches) return "tablet";
  return "desktop";
}

export interface ThisDeviceInfo {
  name: string;
  type: DeviceType;
  os: string;
  appVersion: string;
  fingerprint: string | null;
  lastActive: string;
}

export function collectThisDevice(displayName: string | undefined, typeOverride: DeviceType | undefined, now = new Date()): ThisDeviceInfo {
  return {
    name: (displayName || "").trim() || "This device",
    type: typeOverride ?? detectDeviceType(),
    os: detectOs(),
    appVersion: APP_VERSION,
    fingerprint: null, // filled asynchronously from lanIdentity()
    lastActive: now.toISOString(),
  };
}

export function DeviceCenter() {
  const { t } = useTranslation("settings");
  const { settings, updateSettings, lanSync, refreshLanSyncTrusted } = useApp();
  const [directIdentity, setDirectIdentity] = useState<LanIdentity | null>(null);
  const [identityError, setIdentityError] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async (): Promise<LanIdentity> => {
      try {
        return await lanIdentity();
      } catch {
        // Identity may not be loaded yet (sync never started this session):
        // ask the backend to load/create it WITHOUT starting the server.
        return invokeOptional<LanIdentity>("lan_sync_ensure_identity");
      }
    };
    load()
      .then((id) => { if (alive) setDirectIdentity(id); })
      .catch(() => { if (alive) setIdentityError(true); });
    return () => { alive = false; };
  }, []);
  // Prefer the identity the app context already loaded (LAN server lifecycle);
  // fall back to a direct query for when sync is disabled.
  const identity = lanSync.identity ?? directIdentity;

  const deviceType = (settings.deviceType as DeviceType | undefined) ?? detectDeviceType();
  const deviceName = (settings.deviceFriendlyName || "").trim();
  const trusted = lanSync.trustedDevices ?? [];

  const revoke = async (fingerprint: string) => {
    await lanRevoke(fingerprint);
    await refreshLanSyncTrusted();
  };

  return (
    <div className="stack" data-tour-id="device-center">
      <div className="card" data-testid="device-this-device">
        <h3 style={{ marginTop: 0, display: "flex", alignItems: "center", gap: 8 }}>
          <Icons.monitor size={16} /> {t("devicesThisDevice", { defaultValue: "This device" })}
        </h3>
        <dl className="kv">
          <dt>{t("devicesFriendlyName", { defaultValue: "Friendly name" })}</dt>
          <dd>
            <input
              value={deviceName}
              placeholder={t("devicesNamePlaceholder", { defaultValue: "e.g. Field Laptop, Office Desktop, Ranger Tablet" })}
              onChange={(e) => updateSettings({ deviceFriendlyName: e.target.value })}
              aria-label={t("devicesFriendlyName", { defaultValue: "Friendly name" })}
              style={{ font: "inherit", color: "var(--c-ink)", background: "var(--c-surface)", border: "1px solid var(--c-border-strong)", borderRadius: "var(--radius-sm)", padding: "4px 8px", maxWidth: 260 }}
            />
          </dd>
          <dt>{t("devicesType", { defaultValue: "Device type" })}</dt>
          <dd>
            <Select
              label=""
              value={deviceType}
              optional
              options={DEVICE_TYPES.map((tp) => ({ value: tp, label: t(`devicesType_${tp}`, { defaultValue: tp.charAt(0).toUpperCase() + tp.slice(1) }) }))}
              onChange={(v) => updateSettings({ deviceType: v as DeviceType })}
            />
          </dd>
          <dt>{t("devicesOs", { defaultValue: "Operating system" })}</dt>
          <dd>{detectOs()}</dd>
          <dt>{t("devicesAppVersion", { defaultValue: "App version" })}</dt>
          <dd>{APP_VERSION}</dd>
          <dt>{t("devicesIdentity", { defaultValue: "Identity fingerprint" })}</dt>
          <dd>
            {identity ? (
              <code style={{ fontSize: "0.8rem" }}>{identity.fingerprintFormatted}</code>
            ) : identityError ? (
              <span className="hint">{t("devicesIdentityUnavailable", { defaultValue: "Available in the desktop app (LAN sync identity)" })}</span>
            ) : (
              "…"
            )}
          </dd>
          <dt>{t("devicesLastActive", { defaultValue: "Last active" })}</dt>
          <dd>{new Date().toLocaleString()}</dd>
        </dl>
        <p className="hint" style={{ marginBottom: 0 }}>
          {t("devicesPrivacyNote", {
            defaultValue: "This is a public fingerprint of this installation's cryptographic identity. Private keys are never shown or exported. Your human profile is separate: it stays local, and a device can hold only this device's local profile.",
          })}
        </p>
      </div>

      <div className="card" data-testid="device-trusted">
        <h3 style={{ marginTop: 0, display: "flex", alignItems: "center", gap: 8 }}>
          <Icons.handoff size={16} /> {t("devicesTrustedTitle", { defaultValue: "LAN trusted devices" })}
        </h3>
        {trusted.length === 0 ? (
          <p className="hint" style={{ margin: 0 }}>{t("devicesTrustedEmpty", { defaultValue: "No trusted devices yet. Pair over LAN from the Sync section." })}</p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {trusted.map((d) => (
              <li key={d.fingerprint} className="row between" style={{ borderTop: "1px solid var(--c-border)", padding: "8px 0", gap: 8, flexWrap: "wrap" }}>
                <span>
                  <strong>{d.name}</strong>
                  <span className="hint" style={{ display: "block", margin: 0 }}><code style={{ fontSize: "0.76rem" }}>{d.fingerprintFormatted}</code></span>
                  <span className="hint" style={{ display: "block", margin: 0 }}>{t("devicesAddedAt", { defaultValue: "Added" })} {new Date(d.addedAt).toLocaleDateString()}</span>
                </span>
                <button className="btn btn-danger btn-sm" onClick={() => void revoke(d.fingerprint)}>
                  {t("devicesRevoke", { defaultValue: "Revoke" })}
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="hint" style={{ marginBottom: 0 }}>
          {t("devicesHonestyNote", {
            defaultValue: "There is no cloud account: the app cannot recognize you on unrelated devices. Devices recognize each other only through explicit LAN pairing, and you can revoke trust here at any time.",
          })}
        </p>
      </div>
    </div>
  );
}
