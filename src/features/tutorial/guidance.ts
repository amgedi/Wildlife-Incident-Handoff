/**
 * Guidance systems registry.
 *
 * THREE distinct guidance concepts share ONE spotlight rendering engine but
 * nothing else — different ids, different step builders, different
 * completion persistence keys, different entry points:
 *
 *  A. "interface-tour"          — "Show me where things are."
 *  B. "guided-first-incident"   — "Teach me how to actually report an animal."
 *                                  (the /tutorial checklist flow, not a spotlight)
 *  C. "demo-incident-tour"      — "Explain this fictional demo incident."
 *
 * Completing one never marks another complete.
 */

export type GuidanceSystemId = "interface-tour" | "guided-first-incident" | "demo-incident-tour" | "finding-reports";

export const GUIDANCE_STORAGE_KEYS: Record<GuidanceSystemId, string> = {
  "interface-tour": "guidance-interface-tour-version",
  "guided-first-incident": "guidance-guided-incident-version",
  "demo-incident-tour": "guidance-demo-incident-version",
  "finding-reports": "guidance-finding-reports-version",
};

export const GUIDANCE_VERSION = 1;

import { getSetting, setSetting } from "../../storage/repositories";
import type { TourResult } from "./tourStepsTypes";

/**
 * dev.18 — every tour run is recorded with an honest result
 * (completed / skipped_by_user / auto_skipped_target_missing / failed).
 * A run that auto-skipped a missing target is NEVER a clean pass; QA reads
 * this log (also mirrored on window.__wihTourResults for desktop automation).
 */
const tourResultsLog: TourResult[] = [];

export function recordTourResult(result: TourResult): void {
  tourResultsLog.push(result);
  if (tourResultsLog.length > 100) tourResultsLog.shift();
  if (typeof window !== "undefined") {
    (window as unknown as { __wihTourResults?: TourResult[] }).__wihTourResults = [...tourResultsLog];
  }
}

export function getTourResultsLog(): TourResult[] {
  return [...tourResultsLog];
}

export async function isGuidanceComplete(systemId: GuidanceSystemId): Promise<boolean> {
  const v = await getSetting<number>(GUIDANCE_STORAGE_KEYS[systemId]);
  return v === GUIDANCE_VERSION;
}

export async function markGuidanceComplete(systemId: GuidanceSystemId): Promise<void> {
  await setSetting(GUIDANCE_STORAGE_KEYS[systemId], GUIDANCE_VERSION);
}

export async function resetGuidance(systemId: GuidanceSystemId): Promise<void> {
  await setSetting(GUIDANCE_STORAGE_KEYS[systemId], null);
}

export async function resetAllGuidance(): Promise<void> {
  for (const id of Object.keys(GUIDANCE_STORAGE_KEYS) as GuidanceSystemId[]) {
    await resetGuidance(id);
  }
}

/** Interface-tour steps: an application-wide tour through the REAL app. */
export async function buildInterfaceTourSteps(workspace: "reporter" | "professional") {
  const { ensureTourIncident } = await import("./tourSteps");
  const incidentId = await ensureTourIncident();
  const detail = incidentId ? `/incidents/${incidentId}` : "/incidents";
  const reporter = workspace === "reporter";

  // 0.3: professionals land on the operations dashboard — teach it right
  // after the greeting (needs-attention band, response-flow stage rail).
  const dashboardSteps = reporter
    ? []
    : [
        {
          id: "interface-dashboard",
          tourId: "ops-dashboard",
          titleKey: "tourDashboardTitle",
          textKey: "tourDashboardTextP",
          route: "/network",
          waitMs: 1200,
        },
        {
          id: "interface-attention",
          tourId: "attn-band",
          titleKey: "tourAttentionTitle",
          textKey: "tourAttentionTextP",
          waitMs: 800,
        },
        {
          id: "interface-rflow",
          tourId: "rflow-rail",
          titleKey: "tourFlowTitle",
          textKey: "tourFlowTextP",
          waitMs: 800,
        },
      ];

  const steps = [
    {
      id: "interface-home",
      tourId: "hero",
      titleKey: reporter ? "tourHomeTitle" : "tourHomeTitle",
      textKeyR: "tourHomeReporter",
      textKeyP: "tourHomePro",
    },
    ...dashboardSteps,
    {
      id: "interface-report",
      tourId: "nav-create",
      titleKey: reporter ? "tourReportTitleR" : "tourReportTitleP",
      textKeyR: "tourReportTextR",
      textKeyP: "tourReportTextP",
    },
    {
      id: "interface-reports",
      tourId: "nav-incidents",
      titleKey: reporter ? "tourReportsTitleR" : "tourReportsTitleP",
      textKeyR: "tourReportsTextR",
      textKeyP: "tourReportsTextP",
      action: { labelKey: reporter ? "openMyReports" : "openIncidents", to: "/incidents", advance: true },
      waitMs: 800,
    },
    {
      id: "interface-summary",
      tourId: "incident-summary",
      titleKey: "tourSummaryTitle",
      textKeyR: "tourSummaryTextR",
      textKeyP: "tourSummaryTextP",
      route: "/incidents",
      waitMs: 1000,
    },
    {
      id: "interface-report-header",
      tourId: "incident-header",
      titleKey: "tourIncidentTitle",
      textKey: "tourHeaderText",
      route: detail,
      waitMs: 1200,
    },
    {
      id: "interface-timeline",
      tourId: "tab-timeline",
      titleKey: "tourTimelineTitle",
      textKey: "tourTimelineText",
      route: `${detail}?tab=timeline`,
      waitMs: 900,
    },
    reporter
      ? {
          id: "interface-status",
          tourId: "incident-header",
          titleKey: "tourStatusTitle",
          textKey: "tourStatusText",
        }
      : {
          id: "interface-people",
          tourId: "tab-people",
          titleKey: "tourPeopleTitle",
          textKey: "tourPeopleText",
          route: `${detail}?tab=people`,
          waitMs: 900,
        },
    {
      id: "interface-export",
      tourId: "tab-export",
      title: reporter ? "Share / export" : "Export",
      textKeyR: "tourExportTextR",
      textKeyP: "tourExportTextP",
      route: `${detail}?tab=export`,
      waitMs: 900,
    },
    // 0.3: the professional home has no guide-me card — it closes with the
    // "continue working" list instead of a broken target.
    reporter
      ? {
          id: "interface-guide",
          tourId: "guide-me-card",
          route: "/",
          titleKey: "tourGuideTitle",
          textKeyR: "tourGuideTextR",
          textKeyP: "tourGuideTextP",
        }
      : {
          id: "interface-guide",
          tourId: "continue-working",
          route: "/",
          titleKey: "tourContinueTitle",
          textKey: "tourContinueText",
          waitMs: 800,
        },
    {
      id: "interface-devices",
      tourId: "device-center",
      titleKey: "tourDevicesTitle",
      textKey: "tourDevicesText",
      route: "/settings?section=devices",
      waitMs: 1000,
    },
    {
      id: "interface-settings",
      tourId: "nav-settings",
      titleKey: "tourSettingsTitle",
      textKey: "tourSettingsText",
    },
  ];
  return steps;
}

/** Demo-incident tour: explains a FICTIONAL demo incident (3 steps). */
export function buildDemoTourSteps() {
  return [
    {
      id: "demo-what",
      tourId: "incident-header",
      titleKey: "demoTitle1",
      textKey: "demoText1",
      waitMs: 600,
    },
    {
      id: "demo-explore",
      tourId: "tab-timeline",
      titleKey: "demoTitle2",
      textKey: "demoText2",
      waitMs: 500,
    },
    {
      id: "demo-isolation",
      tourId: "demo-banner",
      titleKey: "demoTitle3",
      textKey: "demoText3",
      waitMs: 500,
    },
  ];
}

/**
 * dev.18 — "Finding reports": restores the search/filters teaching that was
 * removed in dev.17, as its OWN tour with declarative routes. Navigates to
 * the incidents page first (My Reports for reporters, Incidents for
 * professionals), then teaches search, filters and saved views on real,
 * always-present targets. Works in both workspaces.
 */
export function buildFindingReportsTourSteps(workspace: "reporter" | "professional") {
  const reporter = workspace === "reporter";
  return [
    {
      id: "finding-nav",
      tourId: "nav-incidents",
      titleKey: "findingNavTitle",
      textKeyR: reporter ? "findingNavTextR" : "findingNavTextRPro",
    },
    {
      id: "finding-open-list",
      tourId: "incident-filters",
      route: "/incidents",
      waitMs: 900,
      titleKey: "findingListTitle",
      textKeyR: reporter ? "findingListTextR" : "findingListTextRPro",
    },
    {
      id: "finding-viewmode",
      tourId: "view-mode",
      titleKey: "findingViewTitle",
      textKey: "findingViewText",
    },
    {
      id: "finding-search",
      tourId: "incident-search",
      titleKey: "findingSearchTitle",
      textKeyR: reporter ? "findingSearchTextR" : "findingSearchTextRPro",
    },
    {
      id: "finding-filters",
      tourId: "filters-button",
      titleKey: "findingFiltersTitle",
      textKey: "findingFiltersText",
    },
    {
      id: "finding-saved-views",
      tourId: "saved-view-controls",
      openTarget: "filters-button",
      waitMs: 600,
      titleKey: "findingSavedTitle",
      textKey: "findingSavedText",
    },
  ];
}
