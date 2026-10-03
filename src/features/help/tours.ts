/** Help → tutorial launchers (P76): help articles can start the right tour. */

export type GuidedTourKind = "interface" | "first-report";

export async function startGuidedTour(kind: GuidedTourKind): Promise<void> {
  if (kind === "first-report") {
    const { default: router } = await import("../../app/routerNavigate");
    router("/tutorial");
    return;
  }
  const { buildInterfaceTourSteps } = await import("../tutorial/guidance");
  // useApp is React context — read settings via a DOM-free hook is not possible
  // outside a component; the tour builder needs the workspace, so we read the
  // persisted settings through the repository.
  const { getSetting } = await import("../../storage/repositories");
  const settings = await getSetting<{ workspace?: "reporter" | "professional" }>("app-settings");
  const steps = await buildInterfaceTourSteps(settings?.workspace === "professional" ? "professional" : "reporter");
  const { default: routerNavigate } = await import("../../app/routerNavigate");
  const { default: start } = await import("./launchTour");
  // The first tour step targets Home — go there before spotlighting (P69).
  routerNavigate("/");
  setTimeout(() => start("interface-tour", steps), 300);
}
