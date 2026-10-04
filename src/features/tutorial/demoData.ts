/**
 * Fictional demo incidents. Clearly labeled isDemo and never mixed into the
 * real incident lists.
 *
 * 0.3: this is now a thin compatibility wrapper over the seeded simulation
 * generator (src/features/simulation/scenario.ts), which builds the full
 * simulated work environment. Existing callers (Examples page, tour, network
 * demo load) keep working unchanged.
 */
import type { Incident } from "../../types/incident";
import { generateScenario } from "../simulation/scenario";

/** Fixed seed so every caller sees the same stable example set. */
const DEMO_SEED = 20260204;

export function buildDemoIncidents(): Incident[] {
  return generateScenario({ role: "general", intensity: "quiet", seed: DEMO_SEED }).incidents;
}
