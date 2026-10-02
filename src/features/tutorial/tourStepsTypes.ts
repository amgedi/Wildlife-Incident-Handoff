export interface TourAction {
  label: string;
  /** In-app route to navigate to (SPA navigation, keeps the tour alive). */
  to?: string;
  /** Advance to the next step after running. */
  advance: boolean;
}

export interface TourStepV2 {
  /** Stable data-tour-id of the element to highlight. */
  tourId: string;
  /** Selector fallback when the tour-id element isn't rendered. */
  selectorFallback?: string;
  title: string;
  text: string;
  /** Route to navigate to before measuring (e.g. /incidents or /incidents/:id?tab=timeline). */
  route?: string;
  /** Extra settle time after navigation before looking for the target. */
  waitMs?: number;
  /** Optional guided action button in the callout. */
  action?: TourAction;
}
