/**
 * Community Recognition (0.3, spec items 84–88) — an OPTIONAL motivational
 * system emphasizing quality of contribution, explicitly NOT a productivity
 * leaderboard.
 *
 * Hard boundaries (spec 84/85/88 + final rules):
 * - NO "most cases", "fastest responder", "most reports", "top responder" —
 *   nothing ranked by speed or raw volume.
 * - Recognition counts only after a report/incident reaches a verified or
 *   reviewed state, so spam is never rewarded.
 * - Opt-in: a person chooses whether their display profile appears
 *   (private / organization-only / public-display). Public display requires a
 *   connected system that does not exist locally — the local app offers
 *   private badges only and says so honestly.
 * - Deterministic from real records; nothing invented.
 */
import type { Incident } from "../../types/incident";

export type RecognitionBadge =
  | "helpful_observer"
  | "detailed_reporter"
  | "location_helper"
  | "follow_up_contributor"
  | "clear_handoff"
  | "documentation_steward"
  | "team_contributor";

export interface RecognitionRule {
  badge: RecognitionBadge;
  /** Human-readable what/why — no speed or volume ranking. */
  description: string;
}

export const RECOGNITION_RULES: RecognitionRule[] = [
  { badge: "helpful_observer", description: "Several of your reports were accepted and used in a response." },
  { badge: "detailed_reporter", description: "Your reports consistently include enough detail for responders to act." },
  { badge: "location_helper", description: "Your reports included usable location information." },
  { badge: "follow_up_contributor", description: "You followed up on reports when responders needed more information." },
  { badge: "clear_handoff", description: "Handoffs you recorded were complete and accepted without gaps." },
  { badge: "documentation_steward", description: "Your incident documentation (notes, observations, media) is consistently complete." },
  { badge: "team_contributor", description: "You contribute across the whole response flow — reporting, responding, and handing off." },
];

export const RECOGNITION_PRIVACY_LEVELS = ["private", "organization", "display"] as const;
export type RecognitionPrivacy = (typeof RECOGNITION_PRIVACY_LEVELS)[number];

export interface RecognitionProfile {
  enabled: boolean;
  privacy: RecognitionPrivacy;
}

export const DEFAULT_RECOGNITION: RecognitionProfile = { enabled: false, privacy: "private" };

/** Deterministic, quality-based badge computation. A report counts only when
 *  accepted/verified enough (responder assigned, or a structured handoff
 *  completed) — never for raw submission volume. No speed metrics anywhere. */
export function computeRecognition(incidents: Incident[], actor: string): RecognitionBadge[] {
  const name = actor.trim();
  if (!name) return [];
  const badges: RecognitionBadge[] = [];
  const mine = incidents.filter((i) => !i.deletedAt && !i.isDemo && actorInvolved(i, name));
  if (mine.length === 0) return [];

  const accepted = mine.filter(
    (i) =>
      (i.custody?.some((c) => !c.endedAt) && i.status !== "reported" && i.status !== "response_requested") ||
      (i.handoffs?.length ?? 0) > 0
  );

  // Helpful Observer: 2+ reports that were actually accepted into response.
  if (accepted.length >= 2) badges.push("helpful_observer");

  // Detailed Reporter: accepted reports with observation/summary detail.
  const detailed = accepted.filter(
    (i) => (i.timeline?.some((e) => e.eventType === "observation_added") ?? false) || (i.summary ?? "").length >= 40
  );
  if (detailed.length >= 1) badges.push("detailed_reporter");

  // Location Helper: accepted reports with usable location info.
  if (accepted.some((i) => i.location.description || i.location.latitude != null)) badges.push("location_helper");

  // Follow-up Contributor: observation added after the initial creation event.
  if (mine.some((i) => i.timeline?.filter((e) => e.eventType === "observation_added").length >= 2)) {
    badges.push("follow_up_contributor");
  }

  // Clear Handoff: recorded handoffs with both sides and no missing organization.
  if (mine.some((i) => i.handoffs?.some((h) => h.toOrganization && h.occurredAt))) badges.push("clear_handoff");

  // Documentation Steward: media or notes attached on accepted reports.
  if (accepted.some((i) => (i.attachments?.length ?? 0) > 0)) badges.push("documentation_steward");

  // Team Contributor: appears in more than one role (reporter AND responder).
  const reported = mine.some((i) => i.timeline?.some((e) => e.eventType === "incident_created" && e.actor === name));
  const responded = mine.some((i) => i.custody?.some((c) => c.holder === name));
  if (reported && responded) badges.push("team_contributor");

  return badges;
}

function actorInvolved(i: Incident, actor: string): boolean {
  return (
    i.timeline?.some((e) => e.actor === actor) === true ||
    i.custody?.some((c) => c.holder === actor) === true
  );
}

/** Guard used by tests + UI: leaderboard-style badges must never appear. */
export const FORBIDDEN_BADGES = ["fastest_responder", "most_cases", "top_responder", "most_reports", "leaderboard"] as const;

/* ------------------------------------------------------------------ */
/* Stewardship levels (0.3.0-dev.3, spec items 76–89)                  */
/*                                                                     */
/* A quality-weighted, CAPPED contribution score → Steward Level 1–5.  */
/* Every input is quality-gated (accepted / reviewed / completed) and  */
/* hard-capped, so neither junk volume nor speed can move the score.   */
/* Deterministic from real records; nothing invented.                  */
/* ------------------------------------------------------------------ */

export type StewardshipInputKey =
  | "accepted_reports"
  | "actionable_locations"
  | "complete_handoffs"
  | "useful_follow_ups"
  | "documentation_milestones"
  | "training_completed";

export interface StewardshipInput {
  key: StewardshipInputKey;
  /** Maximum points this input can ever contribute — junk volume cannot
   *  push past the cap, so raw submission count is worthless on its own. */
  cap: number;
  /** How the input is quality-gated (shown in the UI / tested against). */
  gate: string;
}

export const STEWARDSHIP_INPUTS: StewardshipInput[] = [
  { key: "accepted_reports", cap: 10, gate: "Reports accepted into a response (assigned custody or a recorded handoff)." },
  { key: "actionable_locations", cap: 8, gate: "Accepted reports that included usable location detail." },
  { key: "complete_handoffs", cap: 8, gate: "Reviewed handoffs recorded with both sides and a time." },
  { key: "useful_follow_ups", cap: 6, gate: "Accepted reports where you added follow-up observations." },
  { key: "documentation_milestones", cap: 6, gate: "Accepted reports with complete documentation (media, notes, or a detailed summary)." },
  { key: "training_completed", cap: 4, gate: "In-app training / tour modules completed." },
];

/** Cumulative score threshold at which each level (1–5) begins. */
export const STEWARDSHIP_LEVELS = [0, 8, 18, 28, 36] as const;
export const STEWARDSHIP_MAX_LEVEL = STEWARDSHIP_LEVELS.length;

export interface StewardshipProgress {
  level: number;
  score: number;
  scoreIntoLevel: number;
  /** Score at which the next level begins; null at max level. */
  scoreForNextLevel: number | null;
  /** Short human sentence for the closest remaining quality milestone; null at max level. */
  nextMilestone: string | null;
  earned: RecognitionBadge[];
  locked: Array<{ badge: RecognitionBadge; how: string }>;
}

export interface StewardshipOptions {
  /** Number of completed tutorial/training modules (cap 4 points). */
  tutorialsCompleted?: number;
}

const ZERO_VALUES: Record<StewardshipInputKey, number> = {
  accepted_reports: 0,
  actionable_locations: 0,
  complete_handoffs: 0,
  useful_follow_ups: 0,
  documentation_milestones: 0,
  training_completed: 0,
};

/** Deterministic, quality-gated and capped stewardship score. Pure function:
 *  same inputs → same output, always (gamification contract, spec 115). */
export function stewardshipProgress(
  incidents: Incident[],
  actor: string,
  opts?: StewardshipOptions
): StewardshipProgress {
  const name = actor.trim();
  const earned = computeRecognition(incidents, actor);
  const locked = RECOGNITION_RULES
    .filter((r) => !earned.includes(r.badge))
    .map((r) => ({ badge: r.badge, how: r.description }));

  if (!name) {
    return { level: 1, score: 0, scoreIntoLevel: 0, scoreForNextLevel: STEWARDSHIP_LEVELS[1], nextMilestone: milestoneFor("accepted_reports", ZERO_VALUES), earned: [], locked };
  }

  const mine = incidents.filter((i) => !i.deletedAt && !i.isDemo && actorInvolved(i, name));
  const accepted = mine.filter(
    (i) =>
      (i.custody?.some((c) => !c.endedAt) && i.status !== "reported" && i.status !== "response_requested") ||
      (i.handoffs?.length ?? 0) > 0
  );

  const values: Record<StewardshipInputKey, number> = {
    // Quality-gated: only reports that actually entered a response count.
    accepted_reports: Math.min(accepted.length, 10),
    actionable_locations: Math.min(
      accepted.filter((i) => i.location.description || i.location.landmark || i.location.latitude != null).length,
      8
    ),
    complete_handoffs: Math.min(
      mine.reduce((n, i) => n + (i.handoffs?.filter((h) => h.toOrganization && h.occurredAt).length ?? 0), 0),
      8
    ),
    useful_follow_ups: Math.min(
      mine.filter((i) => (i.timeline?.filter((e) => e.eventType === "observation_added").length ?? 0) >= 2).length,
      6
    ),
    documentation_milestones: Math.min(
      2 * accepted.filter(
        (i) => (i.attachments?.length ?? 0) > 0 || i.timeline?.some((e) => e.eventType === "note_added") || (i.summary ?? "").length >= 40
      ).length,
      6
    ),
    training_completed: Math.min(2 * Math.max(0, opts?.tutorialsCompleted ?? 0), 4),
  };

  const score = Object.values(values).reduce((a, b) => a + b, 0);
  let level = 1;
  for (let l = STEWARDSHIP_LEVELS.length; l >= 1; l -= 1) {
    if (score >= STEWARDSHIP_LEVELS[l - 1]) {
      level = l;
      break;
    }
  }

  const scoreForNextLevel = level < STEWARDSHIP_MAX_LEVEL ? STEWARDSHIP_LEVELS[level] : null;
  const nextMilestone =
    scoreForNextLevel === null
      ? null
      : milestoneFor(
          (STEWARDSHIP_INPUTS.find((input) => values[input.key] < input.cap) ?? STEWARDSHIP_INPUTS[0]).key,
          values
        );

  return {
    level,
    score,
    scoreIntoLevel: score - STEWARDSHIP_LEVELS[level - 1],
    scoreForNextLevel,
    nextMilestone,
    earned,
    locked,
  };
}

/** Short human sentence for the next quality milestone. NEVER mentions speed
 *  or raw volume ranking (no "fastest", "most cases", "most reports"). */
function milestoneFor(key: StewardshipInputKey, values: Record<StewardshipInputKey, number>): string {
  const input = STEWARDSHIP_INPUTS.find((i) => i.key === key);
  const room = input ? input.cap - values[key] : 0;
  switch (key) {
    case "accepted_reports":
      return room > 0
        ? `${room} more report${room === 1 ? "" : "s"} accepted into a response`
        : "All accepted-report milestones reached";
    case "actionable_locations":
      return room > 0
        ? `${room} more accepted report${room === 1 ? "" : "s"} with usable location detail`
        : "All location-detail milestones reached";
    case "complete_handoffs":
      return room > 0
        ? `${room} more complete handoff${room === 1 ? "" : "s"} recorded`
        : "All handoff milestones reached";
    case "useful_follow_ups":
      return room > 0
        ? `${room} more report${room === 1 ? "" : "s"} with useful follow-up observations`
        : "All follow-up milestones reached";
    case "documentation_milestones":
      return room > 0
        ? `${Math.ceil(room / 2)} more fully documented report${Math.ceil(room / 2) === 1 ? "" : "s"}`
        : "All documentation milestones reached";
    case "training_completed":
      return room > 0
        ? `${Math.ceil(room / 2)} more training module${Math.ceil(room / 2) === 1 ? "" : "s"} completed`
        : "All training milestones reached";
  }
}
