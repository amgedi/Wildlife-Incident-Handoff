/**
 * Incident network service — LOCAL PREVIEW.
 *
 * This module provides the professional dashboard experience against local
 * data only. There is NO live network transmission: the "network" is a local
 * service abstraction with a mock organization registry so the UX and data
 * model can be validated before any real backend exists. See
 * docs/NETWORK_ARCHITECTURE.md for the two-mode design and the privacy model.
 */
import type { Incident } from "../../types/incident";
import { haversineKm } from "../../utils/units";

/** A participating organization as the local registry models it. */
export interface Organization {
  id: string;
  name: string;
  type:
    | "wildlife_rehabilitation"
    | "animal_welfare"
    | "veterinary"
    | "conservation"
    | "protected_area"
    | "municipal"
    | "wildlife_authority"
    | "emergency"
    | "research"
    | "other";
  country: string;
  region: string;
  verified: boolean;
}

/**
 * Professional network roles. Unlike the local UI experience presets, these
 * are permission concepts for a future real backend — kept as data here so
 * the UI can be role-aware from the start.
 */
export type NetworkRole =
  | "reporter"
  | "dispatcher"
  | "responder"
  | "rehabilitator"
  | "veterinary"
  | "ranger"
  | "org_admin"
  | "reviewer";

/** Field visibility levels for network mode (documented in NETWORK_ARCHITECTURE.md). */
export type VisibilityLevel = "public" | "responder" | "receiving_facility" | "admin";

/** Map provider abstraction: no vendor is hard-wired. */
export interface MapProvider {
  readonly id: string;
  /** Declarative provider metadata (tiles, attribution, health check), when backed by a descriptor. */
  readonly descriptor?: {
    id: string;
    kind: string;
    requiresNetwork: boolean;
    attribution: string;
    usageNote: string;
  };
  renderMarkers(
    container: HTMLElement,
    points: Array<{ lat: number; lon: number; state: string; label: string }>
  ): void;
  destroy?(): void;
}

/** No map vendor ships with v0.2; the placeholder provider keeps the seam real. */
export const noneMapProvider: MapProvider = {
  id: "none",
  renderMarkers() {
    /* intentionally empty — map view is documented as pending a provider */
  },
};

/** The mock local registry. Never presented as authoritative or complete. */
export const LOCAL_ORG_REGISTRY: Organization[] = [
  {
    id: "org-demo-1",
    name: "Riverside Wildlife Rescue (example)",
    type: "wildlife_rehabilitation",
    country: "GB",
    region: "Example Region",
    verified: false,
  },
];

export interface ServiceArea {
  centerLat: number | null;
  centerLon: number | null;
  radiusKm: number;
  label: string;
}

export interface FeedGroup {
  id: "new" | "active" | "transfer" | "closed";
  label: string;
}

export const FEED_GROUPS: FeedGroup[] = [
  { id: "new", label: "New — needs response" },
  { id: "active", label: "Active" },
  { id: "transfer", label: "Transfer / in care" },
  { id: "closed", label: "Closed" },
];

const NEW_STATUSES = new Set(["reported", "response_requested"]);
const ACTIVE_STATUSES = new Set(["responder_assigned", "awaiting_pickup"]);
const TRANSFER_STATUSES = new Set(["in_transport", "transferred", "in_care", "veterinary_care", "monitoring"]);

export function feedGroupFor(incident: Incident): FeedGroup["id"] {
  if (NEW_STATUSES.has(incident.status)) return "new";
  if (ACTIVE_STATUSES.has(incident.status)) return "active";
  if (TRANSFER_STATUSES.has(incident.status)) return "transfer";
  return "closed";
}

/** Distance from the service-area center, in km, or null when unknown. */
export function distanceFromArea(incident: Incident, area: ServiceArea): number | null {
  if (area.centerLat == null || area.centerLon == null) return null;
  if (incident.location.latitude == null || incident.location.longitude == null) return null;
  return haversineKm(area.centerLat, area.centerLon, incident.location.latitude, incident.location.longitude);
}

export function inServiceArea(incident: Incident, area: ServiceArea): boolean {
  const d = distanceFromArea(incident, area);
  return d == null || d <= area.radiusKm;
}

export interface DuplicateCandidate {
  a: Incident;
  b: Incident;
  distanceKm: number | null;
  ageHours: number;
  sharedWords: number;
}

/**
 * Duplicate-candidate detection: geographic proximity + time window +
 * overlapping animal description words + same incident type.
 * Detection only — merging is deliberately NOT automatic.
 */
export function findDuplicateCandidates(
  incidents: Incident[],
  options?: { maxKm?: number; maxHours?: number; maxCandidates?: number }
): DuplicateCandidate[] {
  const maxKm = options?.maxKm ?? 2;
  const maxHours = options?.maxHours ?? 24;
  const maxCandidates = options?.maxCandidates ?? 50;
  const candidates: DuplicateCandidate[] = [];
  // Perf (dev.15): sort by time and use a sliding window so the comparison
  // count stays near-linear instead of O(n²) Date parses (10k incidents froze
  // the dashboard). Candidate output is capped for the same reason.
  const live = incidents
    .filter((i) => !i.deletedAt && !i.isDemo)
    .map((i) => ({ i, t: new Date(i.occurredAt ?? i.createdAt).getTime() }))
    .filter((x) => Number.isFinite(x.t))
    .sort((a, b) => a.t - b.t);
  const windowMs = maxHours * 3_600_000;
  const words = (t: string | null) =>
    new Set((t ?? "").toLowerCase().split(/\W+/).filter((w) => w.length > 3));
  const descWords = live.map((x) => words(x.i.animal.description ?? x.i.animal.species));
  for (let a = 0; a < live.length; a++) {
    if (candidates.length >= maxCandidates) break;
    for (let b = a + 1; b < live.length; b++) {
      if (live[b]!.t - live[a]!.t > windowMs) break; // sorted → rest are too new
      const rec1 = live[a]!.i;
      const rec2 = live[b]!.i;
      if (rec1.incidentType !== rec2.incidentType) continue;
      let distanceKm: number | null = null;
      if (
        rec1.location.latitude != null && rec1.location.longitude != null &&
        rec2.location.latitude != null && rec2.location.longitude != null
      ) {
        distanceKm = haversineKm(rec1.location.latitude, rec1.location.longitude, rec2.location.latitude, rec2.location.longitude);
        if (distanceKm > maxKm) continue;
      }
      const sharedWords = [...descWords[a]!].filter((w) => descWords[b]!.has(w)).length;
      if (distanceKm == null && sharedWords === 0) continue;
      if (distanceKm != null && sharedWords === 0) continue;
      const ageHours = Math.round((live[b]!.t - live[a]!.t) / 3_600_000);
      candidates.push({ a: rec1, b: rec2, distanceKm, ageHours, sharedWords });
      if (candidates.length >= maxCandidates) break;
    }
  }
  return candidates;
}