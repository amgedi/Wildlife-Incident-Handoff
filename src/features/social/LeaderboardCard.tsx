/**
 * Reporter leaderboard card (0.2.0-dev.14) — local milestone levels plus
 * friendly counts from LAN-sync peers when available. No global ranking:
 * nothing here leaves the devices involved.
 */
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useApp } from "../../app/AppContext";
import { useIncidents } from "../incidents/IncidentCard";
import { computeLeaderboard, levelFor, nextMilestone, MILESTONES } from "./leaderboard";
import { DEFAULT_LAN_SYNC_CONFIG, deviceNameFromPayload, ensureDeviceIdentity, incidentsFromPayload, lanFetchSnapshot, lanSyncSupported, type LanSyncConfig } from "../sync/lanSync";
import { getSetting } from "../../storage/repositories";
import { Icons } from "../../components/Icons";

const LAN_SYNC_CONFIG_KEY = "lan-sync-config";

export function LeaderboardCard() {
  const { settings } = useApp();
  const { t } = useTranslation();
  const { incidents } = useIncidents();
  const [peerCounts, setPeerCounts] = useState<Array<{ name: string; count: number }>>([]);

  const myCount = (incidents ?? []).filter((i) => !i.isDemo && !i.deletedAt).length;
  const myName = settings.displayName || settings.savedReporterContact?.name || t("social:you", { defaultValue: "You" });

  // LAN peers (desktop only, sync enabled): pull counts from configured peers.
  useEffect(() => {
    if (!lanSyncSupported()) return;
    let cancelled = false;
    const load = async () => {
      try {
        const config = (await getSetting<LanSyncConfig>(LAN_SYNC_CONFIG_KEY)) ?? DEFAULT_LAN_SYNC_CONFIG;
        if (!config.enabled || config.peers.length === 0) return;
        const found: Array<{ name: string; count: number }> = [];
        for (const peer of config.peers) {
          try {
            const { deviceId } = await ensureDeviceIdentity();
            const payload = await lanFetchSnapshot(peer, deviceId);
            if (cancelled) return;
            found.push({
              name: deviceNameFromPayload(payload) ?? peer.replace(/^https?:\/\//, "").split(":")[0] ?? "Device",
              count: incidentsFromPayload(payload).filter((i) => !i.isDemo).length,
            });
          } catch {
            /* peer offline — skip */
          }
        }
        if (!cancelled && found.length > 0) setPeerCounts(found);
      } catch {
        /* sync unavailable */
      }
    };
    void load();
    const id = window.setInterval(load, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const entries = computeLeaderboard({ name: myName, count: myCount }, peerCounts);
  const level = levelFor(myCount);
  const next = nextMilestone(myCount);
  const prev = [...MILESTONES].reverse().find((m) => m.threshold <= myCount) ?? MILESTONES[0]!;
  const progress = next ? Math.min(100, Math.round(((myCount - prev.threshold) / (next.threshold - prev.threshold)) * 100)) : 100;

  return (
    <div className="card" aria-label={t("social:leaderboard", { defaultValue: "Reporter leaderboard" })}>
      <h3 style={{ marginTop: 0, display: "flex", alignItems: "center", gap: 8 }}>
        <Icons.award size={16} /> {t("social:leaderboard", { defaultValue: "Reporter leaderboard" })}
      </h3>
      <p className="hint" style={{ marginTop: 0 }}>
        {t("social:leaderboardBlurb", {
          defaultValue: "A friendly local motivator: your report milestones, plus counts from devices you sync with on the same network. Nothing is ranked globally and nothing leaves the devices involved.",
        })}
      </p>
      <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6 }}>
        {entries.map((e) => (
          <li
            key={e.name + (e.isYou ? "-you" : "")}
            className="row between"
            style={{
              gap: 8, padding: "7px 10px", borderRadius: "var(--radius-sm)",
              background: e.isYou ? "color-mix(in srgb, var(--c-primary) 12%, transparent)" : "var(--c-surface-alt)",
              border: e.isYou ? "1px solid color-mix(in srgb, var(--c-primary) 40%, transparent)" : "1px solid var(--c-border)",
            }}
          >
            <span className="row" style={{ gap: 10, minWidth: 0 }}>
              <strong style={{ width: 26, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>{e.rank === 1 ? "🥇" : e.rank === 2 ? "🥈" : e.rank === 3 ? "🥉" : e.rank}</strong>
              <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {e.name}{e.isYou ? ` (${t("social:you", { defaultValue: "you" })})` : ""}
              </span>
            </span>
            <span className="row" style={{ gap: 8 }}>
              <span className="badge" data-status={e.count > 0 ? "in_care" : "closed"}>{e.level.name}</span>
              <strong style={{ fontVariantNumeric: "tabular-nums" }}>{e.count}</strong>
            </span>
          </li>
        ))}
      </ol>
      <div style={{ marginTop: "var(--space-3)" }}>
        <div className="row between" style={{ fontSize: "0.82rem", color: "var(--c-ink-soft)", marginBottom: 4 }}>
          <span>{level.name}</span>
          {next && (
            <span>
              {next.threshold - myCount} {t("social:toNext", { defaultValue: "reports to {{level}}", level: next.name, interpolation: { escapeValue: false } })}
            </span>
          )}
        </div>
        <div style={{ height: 8, borderRadius: 999, background: "var(--c-surface-raised, rgb(127 127 127 / 0.15))", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${progress}%`, borderRadius: 999, background: "var(--c-primary)", transition: "width 400ms var(--ease)" }} />
        </div>
      </div>
    </div>
  );
}
