/** Tiny navigation escape hatch for non-React modules (tours launcher). */
let navigateFn: ((to: string) => void) | null = null;

export function registerNavigate(fn: (to: string) => void): void {
  navigateFn = fn;
}

export default function routerNavigate(to: string): void {
  navigateFn?.(to);
}
