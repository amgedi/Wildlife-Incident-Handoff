/**
 * StewardshipCard (0.3.0-dev.3, spec items 76–89, 114–115) — the profile UI
 * for Community Recognition V4: a motivating, game-like-but-safe progression.
 *
 * Hard boundaries preserved:
 * - Opt-in, private by default (reads settings.recognition.enabled).
 * - No leaderboards, no speed, no raw-volume-only progress: every level input
 *   is quality-gated and capped (see stewardshipProgress).
 * - Badges are earned, never bought or boosted; organization commendations are
 *   honestly described as not-yet-possible (no connected mode exists).
 * - Theming via CSS custom properties only — works in every theme.
 *
 * Self-contained: mounted in Settings → profile. Loads its own incident data
 * unless incidents/actor props are supplied (tests, previews).
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useApp } from "../../app/AppContext";
import { getAllIncidents } from "../../storage/repositories";
import type { Incident } from "../../types/incident";
import {
  RECOGNITION_RULES,
  STEWARDSHIP_LEVELS,
  stewardshipProgress,
  type RecognitionBadge,
  type StewardshipProgress,
} from "./recognitionService";

/** Small inline SVG icon per badge — self-contained, theme-colored via currentColor. */
function BadgeGlyph({ badge, size = 20 }: { badge: RecognitionBadge; size?: number }): ReactNode {
  const paths: Record<RecognitionBadge, ReactNode> = {
    helpful_observer: <path d="M12 3 3 8v8l9 5 9-5V8l-9-5Zm0 4 5 3v4l-5 3-5-3v-4l5-3Z" />,
    detailed_reporter: (
      <>
        <rect x="5" y="3" width="14" height="18" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M8 8h8M8 12h8M8 16h5" stroke="currentColor" strokeWidth="2" fill="none" />
      </>
    ),
    location_helper: <path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5Z" />,
    follow_up_contributor: <path d="M4 5h16v11H9l-5 4V5Zm4 4h8v2H8V9Zm0 4h5v2H8v-2Z" />,
    clear_handoff: <path d="M7 7h6a4 4 0 0 1 0 8H9l3 3-1 1-5-5 5-5 1 1-3 3h4a2 2 0 0 0 0-4H7V7Zm10 10h2v2h-2v-2Z" />,
    documentation_steward: <path d="M6 2h9l5 5v15H6V2Zm8 2v4h4l-4-4ZM8 12h8v2H8v-2Zm0 4h8v2H8v-2Z" />,
    team_contributor: <path d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2 19c0-3 3-5 6-5s6 2 6 5v1H2v-1Zm12-4.7c2 .5 4 2.2 4 4.7v1h4v-1c0-2.4-2-4.2-4-4.7Z" />,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      {paths[badge]}
    </svg>
  );
}

export interface StewardshipCardProps {
  /** Incidents to derive progress from; defaults to all stored incidents. */
  incidents?: Incident[];
  /** The person whose stewardship is shown; defaults to the local display name. */
  actor?: string;
  /** Completed tutorial/training modules (counts, capped at 4 points). */
  tutorialsCompleted?: number;
  /** Badges already acknowledged (e.g. from the last session). When a badge is
   *  newly earned vs this list, one tasteful toast is shown — no confetti. */
  priorEarned?: RecognitionBadge[];
}

export function StewardshipCard({ incidents, actor, tutorialsCompleted, priorEarned }: StewardshipCardProps) {
  const { settings, updateSettings, showToast } = useApp();
  const { t } = useTranslation("settings");
  const [loaded, setLoaded] = useState<Incident[]>([]);
  const toastedRef = useRef(false);

  useEffect(() => {
    if (incidents) {
      setLoaded(incidents);
      return;
    }
    let cancelled = false;
    void getAllIncidents().then((all) => {
      if (!cancelled) setLoaded(all);
    });
    return () => {
      cancelled = true;
    };
  }, [incidents]);

  const name = (actor ?? settings.displayName ?? "").trim();
  const progress: StewardshipProgress = useMemo(
    () => stewardshipProgress(loaded, name, { tutorialsCompleted }),
    [loaded, name, tutorialsCompleted]
  );

  // Milestone toast: exactly once, only for badges newly earned vs priorEarned.
  useEffect(() => {
    if (!priorEarned || toastedRef.current) return;
    const fresh = progress.earned.filter((b) => !priorEarned.includes(b));
    const first = fresh[0];
    if (first) {
      toastedRef.current = true;
      showToast(
        t("stewardToast", {
          defaultValue: "Achievement unlocked — {{badge}}",
          badge: t(`stewardBadge_${first}`, { defaultValue: first.replaceAll("_", " ") }),
        })
      );
    }
  }, [priorEarned, progress.earned, showToast, t]);

  const enabled = settings.recognition?.enabled ?? false;
  const showcase = (settings.recognitionShowcase ?? []).slice(0, 3);

  const togglePin = (badge: RecognitionBadge) => {
    const next = showcase.includes(badge)
      ? showcase.filter((b) => b !== badge)
      : showcase.length >= 3
        ? showcase
        : [...showcase, badge];
    updateSettings({ recognitionShowcase: next });
  };

  const levelStart = STEWARDSHIP_LEVELS[progress.level - 1] ?? 0;
  const span = progress.scoreForNextLevel !== null ? progress.scoreForNextLevel - levelStart : progress.score - levelStart;
  const pct = span > 0 ? Math.min(100, Math.round((progress.scoreIntoLevel / span) * 100)) : 100;

  return (
    <div className="card" data-testid="stewardship-card" style={{ marginBottom: "var(--space-3)" }}>
      <h3 style={{ marginTop: 0, display: "flex", alignItems: "center", gap: 8 }}>
        <BadgeGlyph badge="documentation_steward" size={16} />
        {t("stewardTitle", { defaultValue: "Wildlife Stewardship" })}
      </h3>

      {!enabled ? (
        <>{/* 0.3.0-dev.6 (spec 65): the OFF state is an attractive preview, not a bare checkbox. */}
          <p style={{ margin: "0 0 8px", color: "var(--c-ink-soft)" }}>
            {t("stewardPreviewIntro", {
              defaultValue:
                "Recognition is optional and private. Earn quality-based milestones for clear handoffs, useful observations, complete documentation and training — computed only from your own records on this device.",
            })}
          </p>
          <div className="steward-preview-badges" aria-label={t("stewardPreviewBadges", { defaultValue: "Badges you could earn" })}>
            {RECOGNITION_RULES.slice(0, 4).map((rule) => (
              <span key={rule.badge} className="steward-preview-badge">
                <BadgeGlyph badge={rule.badge} size={15} />
                {t(`stewardBadge_${rule.badge}`, { defaultValue: rule.badge.replaceAll("_", " ") })}
              </span>
            ))}
          </div>
          <button
            className="btn btn-primary btn-sm"
            style={{ marginTop: 10 }}
            onClick={() =>
              updateSettings({
                recognition: { ...(settings.recognition ?? { enabled: false, privacy: "private" as const }), enabled: true },
              })
            }
          >
            {t("stewardEnable", { defaultValue: "Enable Wildlife Stewardship" })}
          </button>
          <p className="hint" style={{ margin: "8px 0 0" }}>
            {t("stewardPrivacy", {
              defaultValue:
                "Private by default: milestones come only from your own records on this device — no public leaderboard, nothing ranked by speed or volume.",
            })}
          </p>
        </>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
            <span className="badge" style={{ background: "var(--c-primary)", color: "var(--c-bg, #fff)" }}>
              {t("stewardLevel", { defaultValue: "Steward Level {{level}}", level: progress.level })}
            </span>
            <span style={{ color: "var(--c-ink-soft)", fontSize: "0.88rem" }}>
              {t("stewardScore", { defaultValue: "{{score}} of {{max}} possible quality points", score: progress.score, max: 42 })}
            </span>
          </div>

          <div
            data-testid="stewardship-progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            aria-label={t("stewardLevel", { defaultValue: "Steward Level {{level}}", level: progress.level })}
            style={{ height: 8, background: "var(--c-border)", borderRadius: 4, margin: "10px 0 6px", overflow: "hidden" }}
          >
            <div style={{ height: "100%", width: `${pct}%`, background: "var(--c-primary)", borderRadius: 4 }} />
          </div>

          <p className="hint" style={{ margin: "0 0 10px" }}>
            {progress.scoreForNextLevel === null
              ? t("stewardMaxLevel", { defaultValue: "You have reached the highest steward level. Thank you for consistently careful work." })
              : t("stewardUntilNext", {
                  defaultValue: "{{count}} quality milestones until next level",
                  count: progress.scoreForNextLevel - progress.score,
                })}
            {progress.nextMilestone
              ? ` — ${t("stewardNextMilestone", { defaultValue: "next: {{milestone}}", milestone: progress.nextMilestone })}`
              : ""}
          </p>

          <h4 style={{ margin: "0 0 6px" }}>{t("stewardEarned", { defaultValue: "Earned badges" })}</h4>
          {progress.earned.length === 0 ? (
            <p style={{ color: "var(--c-ink-faint)", fontSize: "0.88rem", margin: "0 0 10px" }}>
              {t("stewardNoneEarned", { defaultValue: "No badges yet. Quality milestones below show what counts — accepted and reviewed work only." })}
            </p>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "0 0 10px" }} data-testid="stewardship-cabinet">
              {progress.earned.map((badge) => {
                const pinned = showcase.includes(badge);
                return (
                  <button
                    key={badge}
                    type="button"
                    className="btn btn-sm"
                    aria-pressed={pinned}
                    title={pinned ? t("stewardUnpin", { defaultValue: "Unpin from showcase" }) : t("stewardPin", { defaultValue: "Pin to profile showcase (up to 3)" })}
                    onClick={() => togglePin(badge)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      border: `1px solid ${pinned ? "var(--c-primary)" : "var(--c-border)"}`,
                      color: pinned ? "var(--c-primary)" : "var(--c-ink)",
                      background: "transparent",
                      borderRadius: 8,
                      padding: "4px 10px",
                      cursor: "pointer",
                    }}
                  >
                    <BadgeGlyph badge={badge} size={15} />
                    {t(`stewardBadge_${badge}`, { defaultValue: badge.replaceAll("_", " ") })}
                  </button>
                );
              })}
            </div>
          )}

          {progress.locked.length > 0 && (
            <>
              <h4 style={{ margin: "0 0 6px" }}>{t("stewardLocked", { defaultValue: "Not yet earned" })}</h4>
              <ul style={{ listStyle: "none", margin: 0, padding: 0, opacity: 0.75 }}>
                {progress.locked.map(({ badge, how }) => (
                  <li key={badge} style={{ display: "flex", gap: 8, alignItems: "baseline", padding: "4px 0", borderTop: "1px solid var(--c-border)", fontSize: "0.86rem" }}>
                    <span style={{ color: "var(--c-ink-faint)", flexShrink: 0 }}><BadgeGlyph badge={badge} size={14} /></span>
                    <span>
                      <strong style={{ color: "var(--c-ink-faint)" }}>{t(`stewardBadge_${badge}`, { defaultValue: badge.replaceAll("_", " ") })}</strong>{" "}
                      <span style={{ color: "var(--c-ink-faint)" }}>— {how}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}

      <p className="hint" style={{ margin: "10px 0 0" }}>
        {t("stewardCommendations", {
          defaultValue:
            "Organization commendations will be possible when connected mode exists — recognition stays local and private until then.",
        })}
      </p>
    </div>
  );
}

/** Re-exported for the Settings page and tests. */
export { RECOGNITION_RULES };
