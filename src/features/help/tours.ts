/** Help → tutorial launchers (P76): help articles can start the right tour. */

export type GuidedTourKind = "interface" | "first-report" | "finding-reports";

export async function startGuidedTour(kind: GuidedTourKind): Promise<void> {
  if (kind === "first-report") {
    const { default: router } = await import("../../app/routerNavigate");
    router("/tutorial");
    return;
  }
  const { getSetting } = await import("../../storage/repositories");
  const settings = await getSetting<{ workspace?: "reporter" | "professional" }>("app-settings");
  const workspace = settings?.workspace === "professional" ? "professional" : "reporter";
  const { default: routerNavigate } = await import("../../app/routerNavigate");
  const { default: start } = await import("./launchTour");

  if (kind === "finding-reports") {
    // dev.18: standalone search/filters/saved-views tour. It navigates to the
    // incidents page itself via its declarative step routes.
    const { buildFindingReportsTourSteps } = await import("../tutorial/guidance");
    const steps = buildFindingReportsTourSteps(workspace);
    routerNavigate("/incidents");
    setTimeout(() => start("finding-reports", steps), 300);
    return;
  }

  const { buildInterfaceTourSteps } = await import("../tutorial/guidance");
  const steps = await buildInterfaceTourSteps(workspace);
  // The first tour step targets Home — go there before spotlighting (P69).
  routerNavigate("/");
  setTimeout(() => start("interface-tour", steps), 300);
}
