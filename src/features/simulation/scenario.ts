/**
 * Simulated work environment (0.3, spec items 31–43, 94–95, 107–109).
 *
 * A seeded, deterministic generator for a realistic-feeling set of
 * FICTIONAL incidents, assignments, handoffs, timelines and activity —
 * so professionals can try the test view against a world that behaves
 * like a real response area.
 *
 * Safety rules (spec 42):
 * - every record: isDemo: true and provenance: "demo"
 * - every summary/note text contains the word "fictional"
 * - organization names embed "(demo)"
 * Nothing generated here may ever be mistaken for a real report, and
 * exports preserve the isDemo labeling.
 */
import { SCHEMA_VERSION } from "../../types/incident";
import type {
  AnimalGroup,
  AttachmentMeta,
  ContactInfo,
  CustodyEntry,
  Handoff,
  Incident,
  IncidentNote,
  IncidentStatus,
  IncidentType,
  LocationPrecision,
  ObservedUrgency,
  Observation,
  TimelineEvent,
} from "../../types/incident";

export type SimulationRole =
  | "rehabilitator"
  | "field_responder"
  | "dispatcher"
  | "transport"
  | "general";

export type SimulationIntensity = "quiet" | "normal" | "busy" | "surge";

/** Inclusive [min, max] incident counts per intensity (spec 33). */
export const INTENSITY_COUNTS: Record<SimulationIntensity, readonly [number, number]> = {
  quiet: [4, 6],
  normal: [10, 14],
  busy: [20, 30],
  surge: [35, 45],
};

/** Canonical status set (mirrors STATUS_LABELS in features/incidents/labels.ts). */
export const CANONICAL_STATUSES: IncidentStatus[] = [
  "draft",
  "reported",
  "response_requested",
  "responder_assigned",
  "awaiting_pickup",
  "in_transport",
  "transferred",
  "in_care",
  "veterinary_care",
  "monitoring",
  "released",
  "deceased",
  "closed",
  "cancelled",
];

/** Fictional region (default Calgary-ish). Never a real address. */
export const REGION_CENTER = { lat: 51.05, lon: -114.07 };
export const REGION_SPAN = 0.15; // ± degrees

export interface ScenarioServiceArea {
  label: string;
  centerLat: number;
  centerLon: number;
  radiusKm: number;
}

export interface ScenarioActivityEvent {
  id: string;
  at: string;
  text: string;
  incidentId: string | null;
}

export interface Scenario {
  seed: number;
  role: SimulationRole;
  intensity: SimulationIntensity;
  /** Simulated "now" for the scenario (ISO string). */
  baseNow: string;
  incidents: Incident[];
  serviceArea: ScenarioServiceArea;
  activity: ScenarioActivityEvent[];
}

export interface ScenarioOptions {
  role: SimulationRole;
  intensity: SimulationIntensity;
  seed: number;
  now?: string | Date;
}

// ---- Deterministic PRNG (mulberry32) ----

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, list: readonly T[]): T {
  return list[Math.floor(rng() * list.length)]!;
}

function intBetween(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

// ---- Fictional content pools ----

const FICTIONAL_ROSTER = [
  "A. Whitfield",
  "M. Osei",
  "J. Cardinal",
  "T. Nakamura",
  "R. Delacroix",
  "S. Brightwater",
  "L. Manybears",
  "K. Sorensen",
  "P. Adeyemi",
  "D. Foxrunner",
];

const FICTIONAL_ORGS = [
  "Riverside Wildlife Rescue (demo)",
  "Green Valley Wildlife Centre (demo)",
  "Calgary Wildlife Rehabilitation Society (demo)",
];

const STREETS = [
  "Bow Bend Road (fictional)",
  "Elbow Crescent (fictional)",
  "Prairie Sage Way (fictional)",
  "Cottonwood Lane (fictional)",
  "Bighorn Avenue (fictional)",
  "Wildrose Mews (fictional)",
  "Old Trout Creek Road (fictional)",
  "Aspen Ridge Drive (fictional)",
];

const PARKS = [
  "Whispering Pines Park (fictional)",
  "Sage Flats Natural Area (fictional)",
  "Two Osprey Park (fictional)",
  "Marble Creek Greenway (fictional)",
  "Highwood Bluffs Park (fictional)",
];

const HIGHWAYS = [
  "Highway 8 median near Elk Gulch (fictional)",
  "Route 22 shoulder at Longgrass Crossing (fictional)",
  "Highway 1A eastbound at Deerfoot Overpass (fictional)",
];

const LANDMARKS = [
  "boat launch",
  "off-leash park gate",
  "parking lot east side",
  "pedestrian bridge",
  "storm pond outlet",
  "transmission tower base",
  "campground entrance",
  "trailhead kiosk",
];

interface SpeciesInfo {
  group: AnimalGroup;
  desc?: string;
  species?: string;
}

const SPECIES_DESCRIPTIONS: SpeciesInfo[] = [
  { group: "bird", desc: "Unknown raptor — large hawk-sized bird" },
  { group: "bird", desc: "Waterbird, gull-sized" },
  { group: "bird", desc: "Small songbird, brownish" },
  { group: "bird", desc: "Corvid — crow or raven sized" },
  { group: "mammal", desc: "Unknown juvenile mammal, rabbit-sized" },
  { group: "mammal", desc: "Medium mammal, raccoon-sized" },
  { group: "mammal", desc: "Small bat, grounded" },
  { group: "reptile", desc: "Snake, unidentifiable from distance" },
  { group: "not_sure", desc: "Animal not clearly seen (fictional demo)" },
];

const CONFIRMED_SPECIES: SpeciesInfo[] = [
  { group: "bird", species: "Mallard (unconfirmed)" },
  { group: "bird", species: "Great horned owl (unconfirmed)" },
  { group: "mammal", species: "White-tailed jackrabbit (unconfirmed)" },
  { group: "mammal", species: "Northern flying squirrel (unconfirmed)" },
  { group: "bird", species: "Canada goose (unconfirmed)" },
];

const INCIDENT_TYPES: IncidentType[] = [
  "injured_wildlife",
  "sick_unusual",
  "orphaned_young",
  "trapped_entangled",
  "collision",
  "hazardous_location",
  "dead_wildlife",
  "human_wildlife_conflict",
];

const URGENCIES: ObservedUrgency[] = [
  "immediate_danger",
  "appears_distressed",
  "appears_stable",
  "condition_unclear",
];

/** Status pools per role — rehabilitation roles see more in-care cases. */
const STATUS_POOLS: Record<SimulationRole, IncidentStatus[]> = {
  rehabilitator: [
    "in_care", "in_care", "veterinary_care", "monitoring", "transferred",
    "awaiting_pickup", "released", "in_transport",
  ],
  field_responder: [
    "responder_assigned", "awaiting_pickup", "in_transport", "reported",
    "response_requested", "transferred", "in_care",
  ],
  dispatcher: [
    "reported", "reported", "response_requested", "responder_assigned",
    "awaiting_pickup", "in_transport", "closed",
  ],
  transport: [
    "awaiting_pickup", "in_transport", "in_transport", "transferred",
    "reported", "response_requested",
  ],
  general: CANONICAL_STATUSES.filter((s) => s !== "draft"),
};

const OBSERVATION_TEXTS = [
  { category: "movement" as const, text: "Unable to fly; moves a short distance then stops (fictional observation)." },
  { category: "behavior" as const, text: "Crouched still in grass, no calling heard (fictional observation)." },
  { category: "bleeding" as const, text: "Small amount of blood visible on left wing (fictional observation)." },
  { category: "responsiveness" as const, text: "Alert, head up, tracking movement (fictional observation)." },
  { category: "body_position" as const, text: "One wing hangs lower than the other when standing (fictional observation)." },
  { category: "entanglement" as const, text: "Fishing line wrapped around leg, roughly 40 cm trailing (fictional observation)." },
  { category: "breathing" as const, text: "Breathing fast with mouth open (fictional observation)." },
  { category: "visible_injury" as const, text: "Possible limp, weight-bearing on three legs (fictional observation)." },
];

const HAZARD_POOL = [
  ["traffic"], ["water"], ["pets"], ["people"], ["fishing_line_hooks"],
  ["traffic", "water"], ["predators"], ["machinery"], ["none_observed"],
] as const;

// ---- Role-weighted status selection ----

function statusForRole(rng: () => number, role: SimulationRole): IncidentStatus {
  return pick(rng, STATUS_POOLS[role]);
}

// ---- Location generation ----

interface RegionPoint { lat: number; lon: number }

function regionPoint(rng: () => number, jitterScale = 1): RegionPoint {
  const half = REGION_SPAN / 2;
  const lat = REGION_CENTER.lat + (rng() * REGION_SPAN - half) + (rng() - 0.5) * 0.004 * jitterScale;
  const lon = REGION_CENTER.lon + (rng() * REGION_SPAN - half) + (rng() - 0.5) * 0.004 * jitterScale;
  return { lat: Math.round(lat * 1e6) / 1e6, lon: Math.round(lon * 1e6) / 1e6 };
}

function locationDescription(rng: () => number): { description: string; landmark: string; address: string | null } {
  const roll = rng();
  const landmark = pick(rng, LANDMARKS);
  if (roll < 0.45) {
    const street = pick(rng, STREETS);
    const num = intBetween(rng, 100, 9900);
    return { description: `${num} ${street}, near ${landmark}`, landmark, address: `${num} ${street} (fictional)` };
  }
  if (roll < 0.75) {
    const park = pick(rng, PARKS);
    return { description: `${park}, near the ${landmark}`, landmark, address: null };
  }
  return { description: pick(rng, HIGHWAYS), landmark, address: null };
}

// ---- Timestamp helpers ----

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

// ---- Incident builder ----

interface BuildContext {
  rng: () => number;
  baseNow: number;
  role: SimulationRole;
  intensity: SimulationIntensity;
  seed: number;
  index: number;
}

function buildTimeline(
  ctx: BuildContext,
  incidentId: string,
  status: IncidentStatus,
  createdAt: number,
  updatedAt: number,
  custody: CustodyEntry[],
  handoffs: Handoff[],
): TimelineEvent[] {
  const { rng } = ctx;
  const events: TimelineEvent[] = [];
  const actor = pick(rng, FICTIONAL_ROSTER);
  const span = Math.max(updatedAt - createdAt, 60_000);
  const at = (frac: number) => iso(createdAt + Math.round(span * frac));

  events.push({
    eventId: `${incidentId}-ev0`,
    incidentId,
    eventType: "incident_created",
    timestamp: iso(createdAt),
    actor: null,
    summary: "Fictional demo incident created",
    details: null,
    metadata: null,
    relatedAttachmentIds: [],
  });

  let frac = 0.25;
  const statusStep = (to: IncidentStatus, f: number) => {
    events.push({
      eventId: `${incidentId}-ev-s${events.length}`,
      incidentId,
      eventType: "status_changed",
      timestamp: at(f),
      actor,
      summary: `Status changed to "${to}" (fictional demo)`,
      details: null,
      metadata: null,
      relatedAttachmentIds: [],
    });
    frac = f;
  };

  if (status !== "reported" && status !== "draft") {
    statusStep(status, 0.5);
  }
  if (custody.length > 1) {
    const last = custody[custody.length - 1]!;
    events.push({
      eventId: `${incidentId}-ev-c`,
      incidentId,
      eventType: "custody_changed",
      timestamp: last.startedAt,
      actor,
      summary: `Custody recorded with ${last.holder} (fictional demo)`,
      details: null,
      metadata: null,
      relatedAttachmentIds: [],
    });
    frac = 0.85;
  }
  for (const h of handoffs) {
    events.push({
      eventId: `${incidentId}-ev-h${events.length}`,
      incidentId,
      eventType: h.completedAt ? "handoff_completed" : "handoff_started",
      timestamp: h.occurredAt,
      actor,
      summary: `Handoff to ${h.toParty} (fictional demo)`,
      details: null,
      metadata: null,
      relatedAttachmentIds: [],
    });
    frac = 0.9;
  }
  if (["released", "deceased", "closed", "cancelled"].includes(status)) {
    events.push({
      eventId: `${incidentId}-ev-x`,
      incidentId,
      eventType: "incident_closed",
      timestamp: at(Math.max(frac + 0.05, 0.95)),
      actor,
      summary: `Incident closed — outcome: ${status} (fictional demo)`,
      details: null,
      metadata: null,
      relatedAttachmentIds: [],
    });
  }
  // Events from different sources must read chronologically.
  return events.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
}

function buildCustodyAndHandoffs(
  ctx: BuildContext,
  incidentId: string,
  status: IncidentStatus,
  createdAt: number,
  updatedAt: number,
): { custody: CustodyEntry[]; handoffs: Handoff[] } {
  const { rng } = ctx;
  const custody: CustodyEntry[] = [];
  const handoffs: Handoff[] = [];
  const span = Math.max(updatedAt - createdAt, 60_000);

  const needsChain =
    ["awaiting_pickup", "in_transport", "transferred", "in_care", "veterinary_care", "monitoring", "released", "deceased"].includes(status);

  if (!needsChain) return { custody, handoffs };

  const responder = pick(rng, FICTIONAL_ROSTER);
  const org = pick(rng, FICTIONAL_ORGS);
  const finderEnd = createdAt + Math.round(span * 0.25);
  const responderEnd = createdAt + Math.round(span * 0.55);

  custody.push({
    id: `${incidentId}-cu0`,
    holder: "Finder (fictional demo person)",
    holderRole: "Demo",
    location: null,
    startedAt: iso(createdAt),
    endedAt: iso(finderEnd),
    handoffId: null,
  });
  custody.push({
    id: `${incidentId}-cu1`,
    holder: responder,
    holderRole: "Demo",
    location: "In transit (fictional demo)",
    startedAt: iso(finderEnd),
    endedAt: status === "awaiting_pickup" ? null : iso(responderEnd),
    handoffId: null,
  });

  if (status !== "awaiting_pickup") {
    const pending = status === "in_transport";
    const handoffId = `${incidentId}-ha0`;
    handoffs.push({
      id: handoffId,
      fromParty: responder,
      toParty: org,
      fromOrganization: null,
      toOrganization: org,
      receivingPerson: pick(rng, FICTIONAL_ROSTER),
      method: "In person",
      occurredAt: iso(responderEnd),
      conditionNotes: "Fictional condition notes for the demo handoff.",
      items: [
        { label: "Animal", included: true },
        { label: "Transport container", included: true },
        { label: "Photos", included: rng() < 0.5 },
      ],
      notes: "This handoff is entirely fictional (demo).",
      completedAt: pending ? null : iso(responderEnd + Math.round(span * 0.1)),
      recordedBy: responder,
    });
    custody[custody.length - 1] = { ...custody[custody.length - 1]!, endedAt: iso(responderEnd), handoffId: pending ? null : handoffId };
    if (!pending) {
      custody.push({
        id: `${incidentId}-cu2`,
        holder: org,
        holderRole: "Demo",
        location: "Intake ward (fictional demo)",
        startedAt: iso(responderEnd),
        endedAt: null,
        handoffId,
      });
    }
  }
  return { custody, handoffs };
}

function buildIncident(ctx: BuildContext, slot: { statusOverride?: IncidentStatus; ageMinutes?: number }): Incident {
  const { rng, baseNow, index } = ctx;
  const incidentId = `sim-${ctx.role}-${ctx.intensity}-${ctx.seed}-${index}`;
  const humanReference = `WIH-DEMO-${String(100 + index).padStart(5, "0")}`;

  // Age of the report: mostly within the last 24 h; one slot per scenario is
  // deliberately an old unassigned case reaching back 1–3 days (see plan()).
  const ageMinutes = slot.ageMinutes ?? intBetween(rng, 5, 60 * 26);
  const createdAt = baseNow - ageMinutes * 60_000;
  const status = slot.statusOverride ?? statusForRole(rng, ctx.role);
  const updatedAt = Math.min(baseNow, createdAt + Math.max(Math.round(ageMinutes * 60_000 * (0.5 + rng() * 0.45)), 60_000));

  const type = pick(rng, INCIDENT_TYPES);
  const urgency = pick(rng, URGENCIES);
  const unknownSpecies = rng() < 0.4;
  const speciesInfo = unknownSpecies ? pick(rng, SPECIES_DESCRIPTIONS) : pick(rng, CONFIRMED_SPECIES);

  const { description, landmark, address } = locationDescription(rng);
  const point = regionPoint(rng);
  // Precision distribution (spec 34): mostly approximate, some exact,
  // a couple sensitive — deterministic by index plus rng.
  const precisionRoll = index % 5 === 0 ? "exact" : index % 11 === 3 ? "sensitive" : rng() < 0.15 ? "exact" : "approximate";
  const precision: LocationPrecision = precisionRoll as LocationPrecision;

  const { custody, handoffs } = buildCustodyAndHandoffs(ctx, incidentId, status, createdAt, updatedAt);
  const timeline = buildTimeline(ctx, incidentId, status, createdAt, updatedAt, custody, handoffs);

  const observations: Observation[] = [];
  const obsCount = intBetween(rng, 1, 3);
  for (let o = 0; o < obsCount; o++) {
    const t = pick(rng, OBSERVATION_TEXTS);
    observations.push({
      id: `${incidentId}-ob${o}`,
      category: t.category,
      text: t.text,
      recordedAt: iso(createdAt + Math.round((updatedAt - createdAt) * ((o + 1) / (obsCount + 1)))),
      recordedBy: o === 0 ? "Reporter (fictional demo)" : pick(rng, FICTIONAL_ROSTER),
    });
  }

  const attachments: AttachmentMeta[] = [];
  if (rng() < 0.4) {
    attachments.push({
      id: `${incidentId}-at0`,
      fileName: `fictional-demo-photo-${index}.jpg`,
      mimeType: "image/jpeg",
      byteSize: intBetween(rng, 120_000, 3_400_000),
      caption: "Fictional demo photo placeholder.",
      addedAt: iso(createdAt + 60_000),
      sourceAttribution: "Simulated environment (demo)",
      sensitive: precision === "sensitive",
      kind: "photo",
    });
  }

  const contacts: ContactInfo[] = [];
  if (rng() < 0.6) {
    contacts.push({
      id: `${incidentId}-ct0`,
      role: "finder",
      name: `${pick(rng, ["R. Okafor", "B. Tremblay", "H. Lindqvist", "N. Achebe"])} (fictional demo)`,
      organization: null,
      phone: "+1 403 555 0" + intBetween(rng, 100, 999),
      email: null,
      preferredContactMethod: "phone",
      markedPrivate: true,
    });
  }
  if (custody.length > 0 && rng() < 0.5) {
    contacts.push({
      id: `${incidentId}-ct1`,
      role: "receiving_organization",
      name: null,
      organization: pick(rng, FICTIONAL_ORGS),
      phone: "+1 403 555 0" + intBetween(rng, 100, 999),
      email: "intake@example.org",
      preferredContactMethod: "email",
      markedPrivate: false,
    });
  }

  const notes: IncidentNote[] = [];
  if (rng() < 0.5) {
    notes.push({
      id: `${incidentId}-no0`,
      kind: "private",
      text: "Private note — this record and every person in it are fictional demo data (simulated environment).",
      createdAt: iso(updatedAt),
      createdBy: pick(rng, FICTIONAL_ROSTER),
    });
  }
  if (attachments.length === 0 && rng() < 0.6) {
    notes.push({
      id: `${incidentId}-no1`,
      kind: "incident_record",
      text: "No photos attached — reporter could not approach safely. Missing media is expected in this fictional demo set.",
      createdAt: iso(createdAt + 120_000),
      createdBy: null,
    });
  }

  const speciesLabel = unknownSpecies ? (speciesInfo.desc ?? "unknown animal") : (speciesInfo.species ?? "unknown animal");
  const summary = `Fictional demo report: ${speciesLabel.toLowerCase()} reported via the simulated work environment (demo).`;

  return {
    id: incidentId,
    humanReference,
    schemaVersion: SCHEMA_VERSION,
    createdAt: iso(createdAt),
    updatedAt: iso(Math.min(updatedAt, baseNow)),
    status,
    // 0.3.0-dev.5 spec 71: simulated work environment mixes concern types
    // realistically (mostly animal incidents, plus habitat/hazard/conflict).
    concernType: pick(rng, [
      "wildlife_animal", "wildlife_animal", "wildlife_animal", "wildlife_animal",
      "wildlife_animal", "wildlife_animal",
      "habitat_site", "environmental_hazard", "infrastructure_hazard",
      "human_wildlife_conflict", "other",
    ] as const),
    incidentType: type,
    occurredAt: iso(createdAt),
    urgency,
    summary,
    nextStep: custody.length > 1 ? "Handled inside the simulated environment (demo)." : "Awaiting dispatcher review (fictional demo).",
    animal: {
      group: speciesInfo.group,
      species: unknownSpecies ? null : (speciesInfo.species ?? null),
      speciesConfirmed: false,
      count: rng() < 0.85 ? 1 : intBetween(rng, 2, 4),
      lifeStage: pick(rng, ["adult", "juvenile", "young", "unknown"] as const),
      sex: pick(rng, ["unknown", "not_recorded", "male", "female"] as const),
      subgroup: null,
      description: unknownSpecies ? (speciesInfo.desc ?? null) : null,
    },
    location: {
      description,
      precision,
      landmark,
      address,
      latitude: point.lat,
      longitude: point.lon,
      notes: precision === "sensitive" ? "Sensitive location — deliberately vague (fictional demo)." : null,
      accuracyMeters: intBetween(rng, 5, 50),
      capturedAt: iso(createdAt),
      fromDevice: rng() < 0.7,
    },
    observations,
    hazards: {
      hazards: [...pick(rng, HAZARD_POOL)],
      notes: rng() < 0.4 ? "Fictional hazard note (demo)." : null,
      recordedAt: iso(createdAt),
    },
    actions: [
      { id: `${incidentId}-ac0`, text: "Contacted rescue line (fictional demo)", recordedAt: iso(createdAt + 60_000), recordedBy: null },
    ],
    animalNow:
      status === "in_care" || status === "veterinary_care" || status === "monitoring" ? "rehab_facility"
      : status === "released" ? "released"
      : status === "deceased" ? "deceased"
      : status === "in_transport" ? "in_transport"
      : status === "awaiting_pickup" ? "original_location"
      : "original_location",
    animalNowDescription: null,
    contacts,
    custody,
    handoffs,
    attachments,
    timeline,
    notes,
    tags: ["demo", "simulated"],
    archivedAt: null,
    deletedAt: null,
    isDemo: true,
    shareProfile: "responder",
    createdVia: rng() < 0.5 ? "guide" : "form",
    provenance: "demo",
    integritySignals: [],
    followUp: null,
  };
}

// ---- Plan: which special cases occupy which slots ----

function planScenario(count: number): { kind: "normal" | "duplicate_a" | "duplicate_b" | "old_unassigned" | "handoff_pending" | "fresh" | "missing_media"; statusOverride?: IncidentStatus; ageMinutes?: number }[] {
  const slots: { kind: "normal" | "duplicate_a" | "duplicate_b" | "old_unassigned" | "handoff_pending" | "fresh" | "missing_media"; statusOverride?: IncidentStatus; ageMinutes?: number }[] = [];
  // Slot layout guarantees variety (spec 36) whenever the count allows it.
  slots.push({ kind: "old_unassigned", statusOverride: "reported", ageMinutes: 60 * (24 + 4) }); // >2h, 1–3 days back
  slots.push({ kind: "duplicate_a", statusOverride: "reported" });
  slots.push({ kind: "duplicate_b", statusOverride: "reported" });
  slots.push({ kind: "handoff_pending", statusOverride: "in_transport" });
  slots.push({ kind: "fresh", statusOverride: "reported", ageMinutes: 8 });
  slots.push({ kind: "missing_media", statusOverride: "response_requested" });
  while (slots.length < count) slots.push({ kind: "normal" });
  return slots.slice(0, count);
}

// ---- Generator ----

export function generateScenario(options: ScenarioOptions): Scenario {
  const { role, intensity, seed } = options;
  const baseNowMs = options.now ? Date.parse(options.now instanceof Date ? options.now.toISOString() : options.now) : Date.now();
  const rng = mulberry32(seed);
  const [min, max] = INTENSITY_COUNTS[intensity];
  const count = intBetween(rng, min, max);
  const slots = planScenario(count);
  const baseNow = iso(baseNowMs);

  // The duplicate PAIR must be identical across its two members, so every
  // shared value comes from a dedicated PRNG re-created before the loop.
  const pairRng = mulberry32((seed ^ 0x5f3759df) >>> 0);
  const pairTime = baseNowMs - intBetween(pairRng, 20, 90) * 60_000;
  const pairPlace = locationDescription(pairRng);
  const pairPoint = regionPoint(pairRng, 0.2); // tight cluster — same spot
  const sharedText = "Fictional demo duplicate: a fox is acting strangely near the bins by the pavilion (demo).";

  const incidents: Incident[] = [];
  for (let i = 0; i < count; i++) {
    const slot = slots[i]!;
    const ctx: BuildContext = { rng, baseNow: baseNowMs, role, intensity, seed, index: i };
    const incident = buildIncident(ctx, slot);

    if (slot.kind === "duplicate_a" || slot.kind === "duplicate_b") {
      // Deliberate near-duplicate PAIR: similar time, same place, same text.
      const offsetMin = slot.kind === "duplicate_b" ? 2 : 0;
      const apply = (target: Incident, minutes: number): Incident => ({
        ...target,
        createdAt: iso(pairTime + minutes * 60_000),
        occurredAt: iso(pairTime + minutes * 60_000),
        updatedAt: iso(pairTime + minutes * 60_000 + 60_000),
        status: "reported",
        summary: sharedText,
        animal: { ...target.animal, group: "mammal", species: null, description: "Fox, adult (fictional demo)" },
        location: {
          ...target.location,
          description: pairPlace.description,
          address: pairPlace.address,
          landmark: pairPlace.landmark,
          latitude: pairPoint.lat,
          longitude: pairPoint.lon,
          precision: "approximate",
        },
        observations: [
          {
            id: `${target.id}-ob0`,
            category: "behavior",
            text: sharedText,
            recordedAt: iso(pairTime + minutes * 60_000),
            recordedBy: "Reporter (fictional demo)",
          },
        ],
        tags: [...target.tags, "duplicate pair"],
      });
      const rebuilt = apply({ ...incident, id: incident.id, custody: [], handoffs: [] }, offsetMin);
      rebuilt.timeline = [
        {
          eventId: `${rebuilt.id}-ev0`,
          incidentId: rebuilt.id,
          eventType: "incident_created",
          timestamp: rebuilt.createdAt,
          actor: null,
          summary: "Fictional demo report created",
          details: null,
          metadata: null,
          relatedAttachmentIds: [],
        },
      ];
      if (slot.kind === "duplicate_b") {
        rebuilt.integritySignals = [
          {
            key: "similar_to_recent_report",
            at: rebuilt.createdAt,
            detail: "Similar time, place and description to another fictional demo report.",
          },
        ];
        rebuilt.tags = [...rebuilt.tags, "possible duplicate"];
      }
      rebuilt.provenance = "demo";
      rebuilt.isDemo = true;
      incidents.push(rebuilt);
      continue;
    }

    if (slot.kind === "handoff_pending") {
      // Force an open (unaccepted) handoff.
      const responder = pick(rng, FICTIONAL_ROSTER);
      const org = pick(rng, FICTIONAL_ORGS);
      const at = Date.parse(incident.updatedAt);
      const handoffId = `${incident.id}-hap`;
      incident.handoffs = [
        {
          id: handoffId,
          fromParty: responder,
          toParty: org,
          fromOrganization: null,
          toOrganization: org,
          receivingPerson: pick(rng, FICTIONAL_ROSTER),
          method: "In person",
          occurredAt: iso(at),
          conditionNotes: "Fictional demo condition notes — awaiting acceptance.",
          items: [{ label: "Animal", included: true }, { label: "Paper notes", included: true }],
          notes: "Fictional demo handoff, pending acceptance.",
          completedAt: null,
          recordedBy: responder,
        },
      ];
      incident.custody = [
        ...incident.custody,
        {
          id: `${incident.id}-cup`,
          holder: responder,
          holderRole: "Demo",
          location: "Handoff point (fictional demo)",
          startedAt: iso(at),
          endedAt: null,
          handoffId,
        },
      ];
      incident.status = "in_transport";
      incident.timeline = [
        ...incident.timeline,
        {
          eventId: `${incident.id}-evh`,
          incidentId: incident.id,
          eventType: "handoff_started",
          timestamp: iso(at),
          actor: responder,
          summary: `Handoff to ${org} started — awaiting acceptance (fictional demo)`,
          details: null,
          metadata: null,
          relatedAttachmentIds: [],
        },
      ];
    }

    if (slot.kind === "missing_media") {
      incident.attachments = [];
      incident.notes = [
        ...incident.notes,
        {
          id: `${incident.id}-nom`,
          kind: "incident_record",
          text: "No media attached to this fictional demo report — exercises the missing-data review flow.",
          createdAt: incident.updatedAt,
          createdBy: null,
        },
      ];
    }

    // Safety: enforce unmistakable demo marking on every record (spec 42).
    incident.isDemo = true;
    incident.provenance = "demo";
    if (incident.summary === null || !/fictional|demo/i.test(incident.summary)) {
      incident.summary = `${incident.summary} (fictional demo)`;
    }
    incidents.push(incident);
  }

  // Service area setting object.
  const serviceArea: ScenarioServiceArea = {
    label: "Bow Corridor response area (fictional demo region)",
    centerLat: REGION_CENTER.lat,
    centerLon: REGION_CENTER.lon,
    radiusKm: 45,
  };

  // Activity feed derived deterministically from the incidents.
  const activity: ScenarioActivityEvent[] = incidents
    .map((inc, i) => ({
      id: `act-${seed}-${i}`,
      at: inc.updatedAt,
      text: `${inc.humanReference} updated — status "${inc.status}" (fictional demo)`,
      incidentId: inc.id,
    }))
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

  return { seed, role, intensity, baseNow, incidents, serviceArea, activity };
}

/**
 * Advance a scenario's simulated clock. Kept deliberately simple: it
 * regenerates deterministically from the same seed stream with the shifted
 * "now", so advanceScenario(s, m) === generateScenario({ ...opts, now: s.baseNow + m }).
 */
export function advanceScenario(scenario: Scenario, minutes: number): Scenario {
  const now = new Date(Date.parse(scenario.baseNow) + minutes * 60_000).toISOString();
  return generateScenario({ role: scenario.role, intensity: scenario.intensity, seed: scenario.seed, now });
}
