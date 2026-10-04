/**
 * Needs Attention v3 — a responsive operations queue band, not stacked cards.
 *
 * Contract (0.3 spec items 13–17):
 * - Priority is derived from deterministic operational states only
 *   (unassigned / oldest waiting / handoff pending / missing location /
 *   duplicate candidates) — no invented medical severity, no AI urgency.
 * - Responsive: tiles flow onto one prioritized band on wide screens and a
 *   comfortable grid on narrow ones (no far-left column of cards beside a
 *   giant empty area).
 * - Every tile carries a useful action; selecting a tile drives the dashboard
 *   queue/inspector rather than dead-ending in a generic list.
 */
import { useTranslation } from "react-i18next";
import { Icons } from "../../../components/Icons";
import { relativeTime } from "../../../utils/time";
import type { NeedsAttention } from "../incidentAnalytics";

export interface AttentionTile {
  key: string;
  icon: JSX.Element;
  count: number;
  label: string;
  severity: "alert" | "warn" | "info";
  action: string;
  to: string;
  detail?: string;
}

export function buildAttentionTiles(attention: NeedsAttention, labels: {
  unassigned: string; waiting: string; handoff: string; location: string; duplicates: string;
  review: string; fix: string; oldest: string;
}): AttentionTile[] {
  const tiles: AttentionTile[] = [];
  if (attention.unassignedOld.length > 0) {
    tiles.push({
      key: "waiting", icon: <Icons.clock size={16} />, count: attention.unassignedOld.length,
      label: labels.waiting, severity: "alert", action: labels.review, to: "/incidents?category=awaiting",
      detail: `${labels.oldest}: ${relativeTime(attention.unassignedOld[0]!.occurredAt ?? attention.unassignedOld[0]!.createdAt)}`,
    });
  }
  if (attention.handoffWaiting.length > 0) {
    tiles.push({
      key: "handoff", icon: <Icons.handoff size={16} />, count: attention.handoffWaiting.length,
      label: labels.handoff, severity: "warn", action: labels.review, to: "/incidents?category=active",
    });
  }
  if (attention.missingLocation.length > 0) {
    tiles.push({
      key: "location", icon: <Icons.map size={16} />, count: attention.missingLocation.length,
      label: labels.location, severity: "info", action: labels.fix, to: "/incidents?category=active",
    });
  }
  if (attention.possibleDuplicates.length > 0) {
    tiles.push({
      key: "dupes", icon: <Icons.flag size={16} />, count: attention.possibleDuplicates.length,
      label: labels.duplicates, severity: "info", action: labels.review, to: "/incidents",
    });
  }
  return tiles;
}

export function AttentionQueue({
  tiles,
  unassigned,
  onOpen,
  clearLabel,
}: {
  tiles: AttentionTile[];
  unassigned: number;
  onOpen: (to: string) => void;
  clearLabel: string;
}) {
  const { t } = useTranslation("professional");
  if (tiles.length === 0 && unassigned === 0) {
    return (
      <div className="attn-band attn-clear" role="status">
        <Icons.check size={16} />
        <span>{clearLabel}</span>
      </div>
    );
  }
  return (
    <div className="attn-band" role="group" aria-label={t("needsAttention", { defaultValue: "Needs attention" })}>
      {tiles.map((tile) => (
        <button key={tile.key} className={`attn-tile severity-${tile.severity}`} onClick={() => onOpen(tile.to)}>
          <span className="attn-tile-icon" aria-hidden="true">{tile.icon}</span>
          <span className="attn-tile-body">
            <span className="attn-tile-count">{tile.count}</span>
            <span className="attn-tile-label">{tile.label}</span>
            {tile.detail && <span className="attn-tile-detail">{tile.detail}</span>}
          </span>
          <span className="attn-tile-action">{tile.action}</span>
        </button>
      ))}
    </div>
  );
}
