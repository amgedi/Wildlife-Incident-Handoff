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

export type GuidanceSystemId = "interface-tour" | "guided-first-incident" | "demo-incident-tour";

export const GUIDANCE_STORAGE_KEYS: Record<GuidanceSystemId, string> = {
  "interface-tour": "guidance-interface-tour-version",
  "guided-first-incident": "guidance-guided-incident-version",
  "demo-incident-tour": "guidance-demo-incident-version",
};

export const GUIDANCE_VERSION = 1;

import { getSetting, setSetting } from "../../storage/repositories";

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

  const steps = [
    {
      id: "interface-home",
      tourId: "hero",
      titleKey: reporter ? "tourHomeTitle" : "tourHomeTitle",
      textKeyR: "tourHomeReporter",
      textKeyP: "tourHomePro",
    },
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
      id: "interface-search",
      tourId: "incident-search",
      titleKey: "tourSearchTitle",
      textKeyR: "tourSearchTextR",
      textKeyP: "tourSearchTextP",
      waitMs: 900,
    },
    {
      id: "interface-filters",
      tourId: "incident-filters",
      titleKey: "tourFiltersTitle",
      textKey: "tourFiltersText",
    },
    {
      id: "interface-report-header",
      tourId: "incident-header",
      titleKey: "tourHomeTitle",
      textKey: "tourTimelineText",
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
          titleKey: "tourHomeTitle",
          textKey: "tourFiltersText",
        }
      : {
          id: "interface-people",
          tourId: "tab-people",
          titleKey: "tourHomeTitle",
          textKey: "tourTimelineText",
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
    {
      id: "interface-guide",
      tourId: "guide-me-card",
      route: "/",
      titleKey: "tourGuideTitle",
      textKeyR: "tourGuideTextR",
      textKeyP: "tourGuideTextP",
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
