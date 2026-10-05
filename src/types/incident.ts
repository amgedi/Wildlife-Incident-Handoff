/**
 * Core data model for Wildlife Incident Handoff.
 *
 * Design principles:
 * - Current state is stored on the incident; history is append-only events.
 * - "Unknown" and "not recorded" are first-class, valid answers.
 * - Observations are what the reporter saw, never a diagnosis.
 */

export const SCHEMA_VERSION = 1;

/** How the user mainly uses the app. Presentation preset only — never permissions. */
export type ExperienceMode =
  | "reporter"
  | "rescue"
  | "rehab"
  | "vet"
  | "conservation"
  | "general";

export type DetailLevel = "simple" | "standard" | "professional";

export type IncidentStatus =
  | "draft"
  | "reported"
  | "response_requested"
  | "responder_assigned"
  | "awaiting_pickup"
  | "in_transport"
  | "transferred"
  | "in_care"
  | "veterinary_care"
  | "monitoring"
  | "released"
  | "deceased"
  | "closed"
  | "cancelled";

export type IncidentType =
  | "injured_wildlife"
  | "sick_unusual"
  | "orphaned_young"
  | "trapped_entangled"
  | "collision"
  | "hazardous_location"
  | "dead_wildlife"
  | "human_wildlife_conflict"
  | "other"
  | "not_sure";

export type AnimalGroup =
  | "bird"
  | "mammal"
  | "reptile"
  | "amphibian"
  | "fish"
  | "invertebrate"
  | "other"
  | "not_sure";

export type LifeStage = "adult" | "juvenile" | "young" | "unknown";
export type Sex = "male" | "female" | "unknown" | "not_recorded";

export type LocationPrecision = "exact" | "approximate" | "sensitive";

/** Observational urgency — explicitly NOT veterinary triage. */
export type ObservedUrgency =
  | "immediate_danger"
  | "appears_distressed"
  | "appears_stable"
  | "condition_unclear"
  | "deceased";

export type Hazard =
  | "traffic"
  | "water"
  | "predators"
  | "pets"
  | "people"
  | "machinery"
  | "extreme_weather"
  | "fishing_line_hooks"
  | "chemicals"
  | "unsafe_structure"
  | "other"
  | "none_observed"
  | "unknown";

export type AnimalLocation =
  | "original_location"
  | "being_observed"
  | "contained"
  | "with_finder"
  | "with_responder"
  | "in_transport"
  | "rehab_facility"
  | "vet_facility"
  | "released"
  | "deceased"
  | "unknown"
  | "other";

export type ObservationCategory =
  | "movement"
  | "breathing"
  | "bleeding"
  | "visible_injury"
  | "behavior"
  | "responsiveness"
  | "entanglement"
  | "body_position"
  | "other";

export interface AnimalInfo {
  group: AnimalGroup | null;
  /** Free-text species description. Never treated as verified. */
  species: string | null;
  speciesConfirmed: boolean;
  count: number | null;
  lifeStage: LifeStage | null;
  sex: Sex | null;
  /** Optional hierarchical subgroup, e.g. "Raptor" (additive, v0.2). */
  subgroup?: string | null;
  /** Short human description used on cards when species is unknown, e.g. "Unknown raptor". */
  description: string | null;
}

export interface IncidentLocation {
  description: string | null;
  precision: LocationPrecision | null;
  landmark: string | null;
  address: string | null;
  /** Latitude/longitude. Nullable; never auto-exposed in shareable exports. */
  latitude: number | null;
  longitude: number | null;
  notes: string | null;
  /** Device-reported GPS accuracy in metres (additive, v0.2). */
  accuracyMeters?: number | null;
  /** When the coordinates were captured (additive, v0.2). */
  capturedAt?: string | null;
  /** True when the user captured coordinates via device geolocation. */
  fromDevice?: boolean;
}

export interface Observation {
  id: string;
  category: ObservationCategory;
  text: string;
  recordedAt: string;
  recordedBy: string | null;
}

export interface HazardRecord {
  hazards: Hazard[];
  notes: string | null;
  recordedAt: string;
}

export interface ActionRecord {
  id: string;
  text: string;
  recordedAt: string;
  recordedBy: string | null;
}

export interface ContactInfo {
  id: string;
  role: "finder" | "responder" | "receiving_organization" | "receiving_person" | "other";
  name: string | null;
  organization: string | null;
  phone: string | null;
  email: string | null;
  preferredContactMethod: "phone" | "email" | "in_person" | "other" | null;
  markedPrivate: boolean;
}

export interface CustodyEntry {
  id: string;
  holder: string;
  holderRole: string;
  location: string | null;
  startedAt: string;
  endedAt: string | null;
  handoffId: string | null;
}

export interface AttachmentMeta {
  id: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
  caption: string | null;
  addedAt: string;
  sourceAttribution: string | null;
  /** Excluded from shareable exports when true. */
  sensitive: boolean;
  /** Media kind. Optional: older records without it are photos. */
  kind?: "photo" | "video";
  /** Videos: duration in seconds when known. */
  durationSeconds?: number;
  /** Videos: small poster frame (data URL) for previews/exports. */
  posterDataUrl?: string;
}

export type TimelineEventType =
  | "incident_created"
  | "status_changed"
  | "observation_added"
  | "photo_added"
  | "contact_added"
  | "handoff_started"
  | "handoff_completed"
  | "custody_changed"
  | "field_corrected"
  | "note_added"
  | "incident_closed"
  | "incident_reopened"
  | "incident_archived"
  | "incident_restored"
  | "attachment_removed";

export interface TimelineEvent {
  eventId: string;
  incidentId: string;
  eventType: TimelineEventType;
  timestamp: string;
  actor: string | null;
  summary: string;
  details: string | null;
  /** Structured payload: e.g. { field, previousValue, newValue } for corrections. */
  metadata: Record<string, string> | null;
  relatedAttachmentIds: string[];
}

/** LAN sync provenance (dev.15): which trusted device last delivered this record. */
export interface SyncSource {
  deviceId: string;
  name: string;
  at: string;
}

export interface HandoffItem {
  label: string;
  included: boolean;
}

export interface Handoff {
  id: string;
  fromParty: string;
  toParty: string;
  fromOrganization: string | null;
  toOrganization: string | null;
  receivingPerson: string | null;
  method: string | null;
  occurredAt: string;
  conditionNotes: string | null;
  items: HandoffItem[];
  notes: string | null;
  completedAt: string | null;
  recordedBy: string | null;
}

export type NoteKind = "incident_record" | "private";

/** Privacy preset chosen at creation; sets export defaults (v0.2). */
export type ShareProfile = "private" | "responder" | "public";

export interface IncidentNote {
  id: string;
  kind: NoteKind;
  text: string;
  createdAt: string;
  createdBy: string | null;
}

export interface Incident {
  id: string;
  humanReference: string;
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
  status: IncidentStatus;
  incidentType: IncidentType | null;
  occurredAt: string | null;
  urgency: ObservedUrgency | null;
  animal: AnimalInfo;
  location: IncidentLocation;
  observations: Observation[];
  hazards: HazardRecord | null;
  actions: ActionRecord[];
  animalNow: AnimalLocation | null;
  animalNowDescription: string | null;
  contacts: ContactInfo[];
  custody: CustodyEntry[];
  handoffs: Handoff[];
  attachments: AttachmentMeta[];
  timeline: TimelineEvent[];
  notes: IncidentNote[];
  tags: string[];
  /** LAN sync provenance (optional, additive v0.2): last trusted device that delivered this record. */
  syncSource?: SyncSource | null;
  archivedAt: string | null;
  deletedAt: string | null;
  isDemo: boolean;
  /** Default privacy profile for exports (additive, v0.2). */
  shareProfile?: ShareProfile | null;
  /** Pinned to the top of the incidents list (additive, v0.2). */
  pinnedAt?: string | null;
  /** How the report was created: locally, or via the guided flow. */
  createdVia?: "form" | "guide" | null;
  /** Report provenance (0.3, additive): where this report came from. Review
   *  context only — NEVER proof of fraud or identity. */
  provenance?: ReportProvenance | null;
  /** Integrity review signals recorded for this report (0.3, additive).
   *  Heuristic review hints, not accusations; professionals decide. */
  integritySignals?: IntegritySignal[];
  /** Signal keys the reviewer dismissed (kept so they do not resurface). */
  integrityDismissed?: string[];
  /** Local follow-up marks when contact was voluntarily provided (0.3). */
  followUp?: ReporterFollowUp | null;
  /** Free-text "what happened" summary from creation. */
  summary: string | null;
  /** Short "next step" line shown on the overview. */
  nextStep: string | null;
  /** 0.3.0-dev.5 concern model: top-level concern category. Absent on legacy
   *  records, which are wildlife-animal incidents by definition (see
   *  features/incidents/concernTypes.ts). */
  concernType?: "wildlife_animal" | "habitat_site" | "environmental_hazard" | "infrastructure_hazard" | "human_wildlife_conflict" | "other" | null;
}

export type ReportProvenance =
  | "anonymous_local"
  | "known_local_profile"
  | "trusted_device"
  | "partner_organization"
  | "demo";

export interface IntegritySignal {
  key: string;
  at: string;
  detail?: string;
}

export type ReporterFollowUp =
  | "contact_attempted"
  | "more_info_requested"
  | "confirmed_by_reporter"
  | "unable_to_contact"
  | null;

export interface IncidentDraft {
  id: string;
  step: number;
  data: Partial<Incident> & { animal: AnimalInfo; location: IncidentLocation };
  savedAt: string;
}
