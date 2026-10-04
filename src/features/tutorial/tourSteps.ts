/**
 * Tour step definitions. Every step names a real element via data-tour-id
 * and, when that element lives on another page, the route (and incident tab)
 * the tour must navigate to first. The tour never points at something
 * that isn't currently visible.
 */
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
