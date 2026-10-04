/**
 * Live Activity V5 (0.3.0-dev.5) — a rich operational event feed.
 *
 * dev.4's feed had collapsed into near-anonymous reference rows (time +
 * summary + ref). This restores visual differentiation (icon + accent chip +
 * label per event category — never color alone), rich row content (actor,
 * org, status transition, concern, generalized location — all only when the
 * record actually carries them), compact category filters, Today/Yesterday/
 * Earlier grouping, and a "New activity" badge that avoids violently
 * shifting the viewport when events arrive while the user has scrolled down.
 *
 * Everything is derived only from real timeline events (see
 * incidentAnalytics.getActivityFeed) — nothing is fabricated.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Icons } from "../../../components/Icons";
import { activityCategory, type ActivityFeedEntry } from "../incidentAnalytics";
import { STATUS_LABELS_BY_KEY } from "../../incidents/labels";

type ActivityCategory = "reports" | "assignments" | "handoffs" | "status" | "observations" | "system";

const CATEGORY_META: Record<ActivityCategory, { icon: keyof typeof Icons; key: string; defaultValue: string }> = {
  reports: { icon: "flag", key: "activityCatReports", defaultValue: "Reports" },
  assignments: { icon: "user", key: "activityCatAssignments", defaultValue: "Assignments" },
  handoffs: { icon: "handoff", key: "activityCatHandoffs", defaultValue: "Handoffs" },
  status: { icon: "refresh", key: "activityCatStatus", defaultValue: "Status" },
  observations: { icon: "camera", key: "activityCatObservations", defaultValue: "Observations" },
  system: { icon: "settings", key: "activityCatSystem", defaultValue: "System" },
};

const CATEGORY_ORDER: ActivityCategory[] = ["reports", "assignments", "handoffs", "status", "observations", "system"];

function statusLabel(status: string | null): string | null {
  if (!status) return null;
  return (STATUS_LABELS_BY_KEY as Record<string, string>)[status] ?? status;
}

function dayGroup(timestamp: string, now: Date): "today" | "yesterday" | "earlier" {
  const d = new Date(timestamp);
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(now) - startOf(d)) / 86_400_000);
  if (diffDays <= 0) return "today";
  if (diffDays === 1) return "yesterday";
  return "earlier";
}

interface Props {
  feed: ActivityFeedEntry[];
  onOpenIncident: (incidentId: string) => void;
  maxRows?: number;
}

export function LiveActivityFeed({ feed, onOpenIncident, maxRows = 40 }: Props) {
  const { t } = useTranslation("professional");
  const [category, setCategory] = useState<ActivityCategory | "all">("all");
  const listRef = useRef<HTMLOListElement | null>(null);
  const seenHeadRef = useRef<string | null>(feed[0]?.timestamp ?? null);
  const [newCount, setNewCount] = useState(0);
  const now = new Date();

  const presentCategories = useMemo(() => {
    const set = new Set(feed.map((e) => activityCategory(e.eventType, e.statusTo) as ActivityCategory));
    return CATEGORY_ORDER.filter((c) => set.has(c));
  }, [feed]);

  const visible = useMemo(() => {
    const filtered = category === "all" ? feed : feed.filter((e) => activityCategory(e.eventType, e.statusTo) === category);
    return filtered.slice(0, maxRows);
  }, [feed, category, maxRows]);

  const grouped = useMemo(() => {
    const groups: Array<{ group: "today" | "yesterday" | "earlier"; items: ActivityFeedEntry[] }> = [];
    for (const e of visible) {
      const g = dayGroup(e.timestamp, now);
      const last = groups[groups.length - 1];
      if (last && last.group === g) last.items.push(e);
      else groups.push({ group: g, items: [e] });
    }
    return groups;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // New-activity detection: if the head event changed and the user has scrolled
  // away from the top, count it behind a badge instead of shifting the viewport.
  useEffect(() => {
    const head = feed[0]?.timestamp ?? null;
    if (head && head !== seenHeadRef.current) {
      const el = listRef.current;
      const scrolledAway = el ? el.scrollTop > 4 : false;
      if (!scrolledAway) {
        seenHeadRef.current = head;
        setNewCount(0);
      } else {
        setNewCount((c) => c + 1);
      }
    }
  }, [feed]);

  const jumpToNew = () => {
    seenHeadRef.current = feed[0]?.timestamp ?? null;
    setNewCount(0);
    listRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const groupLabel = (g: "today" | "yesterday" | "earlier") =>
    g === "today"
      ? t("activityToday", { defaultValue: "Today" })
      : g === "yesterday"
        ? t("activityYesterday", { defaultValue: "Yesterday" })
        : t("activityEarlier", { defaultValue: "Earlier" });

  return (
    <div className="activity-v5" data-testid="live-activity-v5">
      {feed.length > 0 && (
        <div className="activity-v5-filters" role="group" aria-label={t("activityFilters", { defaultValue: "Activity filters" })}>
          <button
            className={`chip-btn${category === "all" ? " active" : ""}`}
            aria-pressed={category === "all"}
            onClick={() => setCategory("all")}
          >
            {t("activityAll", { defaultValue: "All" })}
          </button>
          {presentCategories.map((c) => (
            <button
              key={c}
              className={`chip-btn${category === c ? " active" : ""}`}
              aria-pressed={category === c}
              onClick={() => setCategory(c)}
            >
              {t(CATEGORY_META[c].key, { defaultValue: CATEGORY_META[c].defaultValue })}
            </button>
          ))}
        </div>
      )}

      {feed.length === 0 ? (
        <p className="hint" style={{ margin: 0 }}>
          {t("feedEmpty", { defaultValue: "Timeline events from your records will appear here." })}
        </p>
      ) : (
        <>
          {newCount > 0 && (
            <button className="activity-v5-new badge" data-status="response_requested" onClick={jumpToNew} data-testid="activity-new-badge">
              {t("activityNew", { defaultValue: "New activity" })}{newCount > 1 ? ` (${newCount})` : ""}
            </button>
          )}
          <ol className="ops-feed activity-v5-list" ref={listRef} aria-label={t("liveActivity", { defaultValue: "Live activity" })}>
            {grouped.map(({ group, items }) => (
              <li key={group} className="activity-v5-group">
                <span className="nav-sep activity-v5-group-label">{groupLabel(group)}</span>
                <ol className="activity-v5-group-list">
                  {items.map((e, idx) => {
                    const cat = activityCategory(e.eventType, e.statusTo) as ActivityCategory;
                    const meta = CATEGORY_META[cat] ?? CATEGORY_META.system;
                    const CatIcon = Icons[meta.icon] as React.ComponentType<{ size?: number }>;
                    const fromLabel = statusLabel(e.statusFrom);
                    const toLabel = statusLabel(e.statusTo);
                    return (
                      <li key={`${e.incidentId}-${e.timestamp}-${idx}`}>
                        <button onClick={() => onOpenIncident(e.incidentId)} className="ops-feed-item" data-cat={cat}>
                          <span className="ops-feed-time">{new Date(e.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                          <span className="activity-v5-rail" aria-hidden="true" />
                          <span className="ops-feed-body">
                            <span className="activity-v5-head">
                              <span className={`activity-v5-chip`} data-cat={cat}>
                                <CatIcon size={11} />
                                {t(meta.key, { defaultValue: meta.defaultValue })}
                              </span>
                              <span className="ops-feed-event" data-evt={e.eventType}>{e.summary}</span>
                            </span>
                            {(e.actor || e.organization) && (
                              <span className="ops-feed-meta">
                                {[e.actor, e.organization].filter(Boolean).join(" · ")}
                              </span>
                            )}
                            <span className="ops-feed-ref">
                              {e.incidentRef}
                              {e.animalLabel ? ` · ${e.animalLabel}` : ""}
                              {fromLabel && toLabel ? ` · ${fromLabel} → ${toLabel}` : toLabel ? ` · ${toLabel}` : ""}
                            </span>
                            {e.locationHint && <span className="ops-feed-loc">{e.locationHint}</span>}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
