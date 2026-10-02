/**
 * Tour step definitions. Every step names a real element via data-tour-id
 * and, when that element lives on another page, the route (and incident tab)
 * the tour must navigate to first. The tour never points at something
 * that isn't currently visible.
 */
import type { TourStepV2 } from "./tourStepsTypes";

export type { TourStepV2 } from "./tourStepsTypes";

/** Make sure at least one openable incident exists; returns its id. */
export async function ensureTourIncident(): Promise<string | null> {
  const { getAllIncidents, putIncident } = await import("../../storage/repositories");
  const all = await getAllIncidents();
  const usable = all.find((i) => !i.deletedAt);
  if (usable) return usable.id;
  // Persist a fictional demo so the tour can show the real workspace.
  const { buildDemoIncidents } = await import("./demoData");
  const demo = buildDemoIncidents()[0]!;
  await putIncident(demo);
  return demo.id;
}

export async function buildMainTourSteps(): Promise<TourStepV2[]> {
  const incidentId = await ensureTourIncident();
  const detail = incidentId ? `/incidents/${incidentId}` : "/incidents";
  return [
    {
      tourId: "nav-home",
      title: "Home",
      text: "Your starting point: resume open incidents and see what needs attention.",
    },
    {
      tourId: "nav-create",
      title: "Create incident",
      text: "A guided wizard walks you through recording what you observed, step by step. Unknown is always a valid answer.",
    },
    {
      tourId: "nav-incidents",
      title: "Incidents",
      text: "This is where all your incidents live — active, closed and archived. Let's open it.",
      action: { label: "Open Incidents", to: "/incidents", advance: true },
      waitMs: 700,
    },
    {
      tourId: "incident-search",
      title: "Search",
      text: "Search by incident reference, species, location, organization or notes — anything you wrote.",
      waitMs: 900,
    },
    {
      tourId: "incident-filters",
      title: "Filters",
      text: "Narrow the list by status and incident type. Closed and archived cases stay searchable here instead of cluttering the home screen.",
    },
    {
      tourId: "tab-timeline",
      title: "Timeline",
      text: "Inside an incident, the Timeline keeps every update in chronological order — observations, photos, corrections. Nothing is overwritten. Opening a real example now…",
      route: `${detail}?tab=timeline`,
      waitMs: 1200,
    },
    {
      tourId: "tab-people",
      title: "People & handoffs",
      text: "Record who takes responsibility: transfers, custody history and receiving organizations live here.",
      route: `${detail}?tab=people`,
      waitMs: 900,
    },
    {
      tourId: "handoff-button",
      title: "Transfer / hand off",
      text: "This button records a handoff — who it came from, who receives, method, condition and items transferred.",
      waitMs: 600,
    },
    {
      tourId: "tab-export",
      title: "Export",
      text: "Generate a print-ready handoff summary, or a privacy-safe shareable version with location and contacts removed.",
      route: `${detail}?tab=export`,
      waitMs: 900,
    },
    {
      tourId: "nav-settings",
      title: "Settings",
      text: "Themes, motion, accessibility, privacy and backups all live here. Your data stays on this device.",
    },
  ];
}
