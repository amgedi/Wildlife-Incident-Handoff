/**
 * Canonical incident status registry (0.3.0-dev.6, Part XVI).
 *
 * ONE source for label, semantic color token, glyph and sort order across
 * Response Flow, incident list, Live Activity, map popup, analytics drawer
 * and duplicate comparison. Colors are THEME TOKENS (resolved per theme via
 * CSS custom properties) — never hard-coded hex in components.
 */
import type { IncidentStatus } from "../../types/incident";

export interface StatusDescriptor {
  status: IncidentStatus;
  label: string;
  /** CSS custom property holding the semantic color for this status family. */
  token: string;
  /** Fallback hex used only when the theme does not define the token. */
  fallback: string;
  /** Distinct glyph so color is never the only signal. */
  glyph: string;
  /** Canonical sort order (response lifecycle). */
  order: number;
}

export const STATUS_REGISTRY: Record<IncidentStatus, StatusDescriptor> = {
  draft:              { status: "draft", label: "Draft", token: "--status-draft", fallback: "#6b7280", glyph: "○", order: 0 },
  reported:           { status: "reported", label: "Reported", token: "--status-reported", fallback: "#2f6fd0", glyph: "●", order: 1 },
  response_requested: { status: "response_requested", label: "Response requested", token: "--status-reported", fallback: "#2f6fd0", glyph: "●", order: 2 },
  responder_assigned: { status: "responder_assigned", label: "Responder assigned", token: "--status-assigned", fallback: "#5b5bd6", glyph: "◆", order: 3 },
  in_transport:       { status: "in_transport", label: "En route", token: "--status-enroute", fallback: "#0e8f9e", glyph: "➜", order: 4 },
  awaiting_pickup:    { status: "awaiting_pickup", label: "Awaiting pickup", token: "--status-pickup", fallback: "#b45309", glyph: "▲", order: 5 },
  transferred:        { status: "transferred", label: "Transferred", token: "--status-transfer", fallback: "#7c3aed", glyph: "⇄", order: 6 },
  in_care:            { status: "in_care", label: "In care", token: "--status-care", fallback: "#2f7d4f", glyph: "♥", order: 7 },
  veterinary_care:    { status: "veterinary_care", label: "Veterinary care", token: "--status-care", fallback: "#2f7d4f", glyph: "+", order: 8 },
  monitoring:         { status: "monitoring", label: "Monitoring", token: "--status-care", fallback: "#2f7d4f", glyph: "◐", order: 9 },
  released:           { status: "released", label: "Released", token: "--status-ok", fallback: "#22c55e", glyph: "✓", order: 10 },
  deceased:           { status: "deceased", label: "Deceased", token: "--status-closed", fallback: "#374151", glyph: "✕", order: 11 },
  closed:             { status: "closed", label: "Closed", token: "--status-closed", fallback: "#6b7280", glyph: "■", order: 12 },
  cancelled:          { status: "cancelled", label: "Cancelled", token: "--status-closed", fallback: "#9ca3af", glyph: "×", order: 13 },
};

/** Resolve the concrete color for a status (token with fallback). */
export function statusColor(status: IncidentStatus | string): string {
  const d = STATUS_REGISTRY[status as IncidentStatus];
  if (!d) return "var(--c-ink-faint)";
  return `var(${d.token}, ${d.fallback})`;
}

/** Response-flow stage → semantic color (Part V/XXII example direction). */
export const STAGE_COLORS: Record<string, string> = {
  reported: "var(--status-reported, #2f6fd0)",
  assigned: "var(--status-assigned, #5b5bd6)",
  enroute: "var(--status-enroute, #0e8f9e)",
  pickup: "var(--status-pickup, #b45309)",
  transfer: "var(--status-transfer, #7c3aed)",
  care: "var(--status-care, #2f7d4f)",
  closed: "var(--status-closed, #6b7280)",
};
