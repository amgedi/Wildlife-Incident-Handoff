/** Bridges non-React tour launchers into AppContext guidance state.
 *  App registers this once at startup. */
import type { GuidanceSystemId } from "../tutorial/guidance";
import type { TourStepV2 } from "../tutorial/tourStepsTypes";

let startFn: ((systemId: GuidanceSystemId, steps: TourStepV2[]) => void) | null = null;

export function registerTourLauncher(fn: (systemId: GuidanceSystemId, steps: TourStepV2[]) => void): void {
  startFn = fn;
}

export default function launchTour(systemId: GuidanceSystemId, steps: TourStepV2[]): void {
  startFn?.(systemId, steps);
}
