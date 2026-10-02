/**
 * Canonical brand mark for Wildlife Incident Handoff: a clean bear-paw
 * print on a rounded tile. One shape is reused across the app header,
 * favicon (public/favicon.svg), PWA icons and the social preview so the
 * identity can never drift apart. The paw reads clearly at favicon size,
 * works monochrome, and is deliberately calm — not an insignia.
 */
export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" role="img" aria-label="Wildlife Incident Handoff" focusable="false">
      <rect width="32" height="32" rx="8" fill="#2f5d3f" />
      {/* toes */}
      <ellipse cx="9.4" cy="12.2" rx="2.5" ry="3.1" transform="rotate(-18 9.4 12.2)" fill="#eef3e9" />
      <ellipse cx="14.6" cy="9.9" rx="2.5" ry="3.2" transform="rotate(-6 14.6 9.9)" fill="#eef3e9" />
      <ellipse cx="20" cy="10.6" rx="2.5" ry="3.1" transform="rotate(8 20 10.6)" fill="#eef3e9" />
      <ellipse cx="24.6" cy="13.6" rx="2.3" ry="2.9" transform="rotate(22 24.6 13.6)" fill="#eef3e9" />
      {/* pad */}
      <path
        d="M16.4 14.6c-4.1 0-7.1 2.9-7.1 6 0 2.3 1.9 3.8 4.3 3.8 1.1 0 1.9-.3 2.8-.3.9 0 1.7.3 2.8.3 2.4 0 4.3-1.5 4.3-3.8 0-3.1-3-6-7.1-6Z"
        fill="#eef3e9"
      />
    </svg>
  );
}
