/**
 * Brand mark: a simple leaf-and-wing motif. Deliberately calm and
 * outdoors-inspired — not an emergency-services or medical symbol.
 */
export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="8" fill="#2f5d3f" />
      <path
        d="M8 22c0-7 4.5-11 12-12-.5 6.5-3 10.5-8.5 12.5"
        fill="none"
        stroke="#e8f1e7"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13 23c4-1 6.5-4 7.5-8.5"
        fill="none"
        stroke="#b5651d"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="22.5" cy="9.5" r="1.8" fill="#e8f1e7" />
    </svg>
  );
}
