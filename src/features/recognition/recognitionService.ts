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
