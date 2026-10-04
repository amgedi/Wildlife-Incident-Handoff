export interface TourAction {
  label?: string;
  labelKey?: string;
  /** In-app route to navigate to (SPA navigation, keeps the tour alive). */
  to?: string;
  /** Advance to the next step after running. */
  advance: boolean;
}

export interface TourStepV2 {
  /** Unique step id within its guidance system, e.g. "interface-search". */
  id: string;
  /** Stable data-tour-id of the element to highlight. */
  tourId: string;
  /** Selector fallback when the tour-id element isn't rendered. */
  selectorFallback?: string;
  /** translation keys (guidance namespace) resolved at render time */
  titleKey?: string;
  textKey?: string;
  /** workspace-specific text keys (reporter / professional) */
  textKeyR?: string;
  textKeyP?: string;
  /** literal fallbacks (used only where content is deliberately fixed) */
  title?: string;
  text?: string;
  /** Route to navigate to before measuring (e.g. /incidents or /incidents/:id?tab=timeline). */
  route?: string;
  /** Extra settle time after navigation before looking for the target. */
  waitMs?: number;
  /** Optional guided action button in the callout. */
  action?: TourAction;
  /**
   * data-tour-id of a control to click AFTER route readiness and BEFORE
   * measuring the target — e.g. open a popover so its contents can be
   * highlighted. Declarative: the engine clicks it, the step never relies
   * on the user pressing a previous-step button to reach a state.
   */
  openTarget?: string;
}

/** How a tour run actually ended (dev.18 — tours must report honestly). */
export type TourResultStatus =
  | "completed" // every step shown; zero target misses
  | "skipped_by_user" // user chose Exit / Escape
  | "auto_skipped_target_missing" // one or more targets never appeared
  | "failed"; // engine error

export interface TourResult {
  status: TourResultStatus;
  systemId?: string;
  /** Step ids whose target was missing and were auto-skipped. */
  autoSkippedSteps: string[];
  /** Total steps in the run. */
  totalSteps: number;
  finishedAt: string;
}
