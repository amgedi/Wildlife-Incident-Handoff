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
  options?: { maxKm?: number; maxHours?: number }
): DuplicateCandidate[] {
  const maxKm = options?.maxKm ?? 2;
  const maxHours = options?.maxHours ?? 24;
  const candidates: DuplicateCandidate[] = [];
  const live = incidents.filter((i) => !i.deletedAt && !i.isDemo);
  for (let i = 0; i < live.length; i++) {
    for (let j = i + 1; j < live.length; j++) {
      const a = live[i]!;
      const b = live[j]!;
      if (a.incidentType !== b.incidentType) continue;
      const ageHours =
        Math.abs(new Date(a.occurredAt ?? a.createdAt).getTime() - new Date(b.occurredAt ?? b.createdAt).getTime()) /
        3_600_000;
      if (ageHours > maxHours) continue;
      let distanceKm: number | null = null;
      if (
        a.location.latitude != null && a.location.longitude != null &&
        b.location.latitude != null && b.location.longitude != null
      ) {
        distanceKm = haversineKm(a.location.latitude, a.location.longitude, b.location.latitude, b.location.longitude);
        if (distanceKm > maxKm) continue;
      }
      const words = (t: string | null) =>
        new Set((t ?? "").toLowerCase().split(/\W+/).filter((w) => w.length > 3));
      const sharedWords = [...words(a.animal.description ?? a.animal.species)].filter((w) =>
        words(b.animal.description ?? b.animal.species).has(w)
      ).length;
      if (distanceKm == null && sharedWords === 0) continue;
      candidates.push({ a, b, distanceKm, ageHours, sharedWords });
    }
  }
  return candidates;
}
