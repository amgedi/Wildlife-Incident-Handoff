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
      title: reporter ? "Your starting point" : "Home",
      text: reporter
        ? "This is your starting point. From here you can report wildlife and follow what happened to your reports."
        : "This is your dashboard home: resume open incidents and see what needs attention.",
    },
    {
      id: "interface-report",
      tourId: "nav-create",
      title: reporter ? "Report wildlife" : "Create incident",
      text: reporter
        ? "Start here whenever you find wildlife you want to record. A guided wizard walks you through it — Unknown is always a valid answer."
        : "Start a new incident. The guided wizard records what was observed, step by step.",
    },
    {
      id: "interface-reports",
      tourId: "nav-incidents",
      title: reporter ? "My reports" : "Incidents",
      text: reporter
        ? "This is where your reports live — in progress, awaiting response, and resolved."
        : "This is where all incidents live — active, closed and archived. Let's open it.",
      action: { label: reporter ? "Open my reports" : "Open Incidents", to: "/incidents", advance: true },
      waitMs: 800,
    },
    {
      id: "interface-search",
      tourId: "incident-search",
      title: "Search",
      text: reporter
        ? "Search your reports by reference, animal or location."
        : "Search by incident reference, species, location, organization or notes — anything you wrote.",
      waitMs: 900,
    },
    {
      id: "interface-filters",
      tourId: "incident-filters",
      title: "Filters",
      text: "Use filters to narrow the list — by status and incident type.",
    },
    {
      id: "interface-report-header",
      tourId: "incident-header",
      title: reporter ? "A report" : "An incident",
      text: reporter
        ? "Opening one of your reports: the header shows its reference, current status and location."
        : "The incident header shows the reference, status, and the key handoff action.",
      route: detail,
      waitMs: 1200,
    },
    {
      id: "interface-timeline",
      tourId: "tab-timeline",
      title: "Timeline",
      text: "This keeps the history of what happened — every observation, photo and correction in order.",
      route: `${detail}?tab=timeline`,
      waitMs: 900,
    },
    reporter
      ? {
          id: "interface-status",
          tourId: "incident-header",
          title: "Current status",
          text: "The status chip shows where your report is right now. It updates as responders act on it.",
        }
      : {
          id: "interface-people",
          tourId: "tab-people",
          title: "People & handoffs",
          text: "Record who takes responsibility: transfers, custody history and receiving organizations.",
          route: `${detail}?tab=people`,
          waitMs: 900,
        },
    {
      id: "interface-export",
      tourId: "tab-export",
      title: reporter ? "Share / export" : "Export",
      text: reporter
        ? "Generate a summary of your report to share — a privacy-safe version leaves out your contact details and exact location unless you choose otherwise."
        : "Generate a print-ready handoff summary, or a privacy-safe shareable version.",
      route: `${detail}?tab=export`,
      waitMs: 900,
    },
    {
      id: "interface-guide",
      tourId: "guide-me-card",
      route: "/",
      title: "Guide me",
      text: reporter
        ? "If you're ever unsure what to do, Guide me walks you through a real report one friendly step at a time."
        : "Guide me walks through key workflows step by step — reporting, handoffs, exports.",
    },
    {
      id: "interface-settings",
      tourId: "nav-settings",
      title: "Settings",
      text: "Themes, motion, accessibility, privacy and backups live here. Your data stays on this device.",
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
      title: "This is a fictional demo incident",
      text: "Demo cases open in the same workspace as real incidents, but stay clearly labeled as fictional.",
      waitMs: 600,
    },
    {
      id: "demo-explore",
      tourId: "tab-timeline",
      title: "Explore it freely",
      text: "You can explore its timeline, status and handoff information exactly like a real case.",
      waitMs: 500,
    },
    {
      id: "demo-isolation",
      tourId: "demo-banner",
      title: "Nothing mixes with your reports",
      text: "Nothing here enters your real reports unless you choose “Copy into my workspace” back on the examples page.",
      waitMs: 500,
    },
  ];
}
