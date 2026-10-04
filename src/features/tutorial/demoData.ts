/**
 * Fictional demo incidents. Clearly labeled isDemo and never mixed into the
 * real incident lists. Users can open them read-as-example or copy them into
 * their workspace as real (editable) records.
 */
import type { Incident, TimelineEvent } from "../../types/incident";
import { SCHEMA_VERSION } from "../../types/incident";

let demoCounter = 0;

function minutesAgo(m: number): string {
  return new Date(Date.now() - m * 60_000).toISOString();
}

function hoursAgo(h: number, m = 0): string {
  const d = new Date();
  d.setHours(d.getHours() - h, d.getMinutes() - m);
  return d.toISOString();
}

function makeDemo(partial: Omit<Incident, "schemaVersion" | "isDemo" | "id"> & { id?: string }): Incident {
  demoCounter += 1;
  return {
    id: partial.id ?? `demo-${demoCounter}-${Math.random().toString(36).slice(2, 8)}`,
    schemaVersion: SCHEMA_VERSION,
    isDemo: true,
    ...partial,
  };
}

function ev(incidentId: string, eventType: TimelineEvent["eventType"], summary: string, timestamp: string, details?: string, metadata?: Record<string, string>): TimelineEvent {
  return { eventId: `de-${Math.random().toString(36).slice(2, 10)}`, incidentId, eventType, timestamp, actor: null, summary, details: details ?? null, metadata: metadata ?? null, relatedAttachmentIds: [] };
}

export function buildDemoIncidents(): Incident[] {
  const raptor = makeDemo({
    humanReference: "WIH-2026-000101",
    createdAt: hoursAgo(20),
    updatedAt: hoursAgo(18),
    status: "awaiting_pickup",
    incidentType: "injured_wildlife",
    occurredAt: hoursAgo(20),
    urgency: "appears_distressed",
    summary: "Reported by a member of the public: a large bird beside the road, unable to fly when approached. Traffic passes close by.",
    nextStep: "Volunteer responder en route; rehab facility notified.",
    animal: { group: "bird", species: null, speciesConfirmed: false, count: 1, lifeStage: "adult", sex: "unknown", description: "Unknown raptor — large hawk-sized bird" },
    location: { description: "Roadside near wetland", precision: "approximate", landmark: "Wetland car park entrance", address: null, latitude: null, longitude: null, notes: null },
    observations: [
      { id: "d1", category: "movement", text: "Unable to fly; walks a short distance then stops.", recordedAt: hoursAgo(20), recordedBy: "Reporter (via phone)" },
      { id: "d2", category: "body_position", text: "Right wing hangs lower than left when standing.", recordedAt: hoursAgo(20), recordedBy: "Reporter (via phone)" },
      { id: "d3", category: "responsiveness", text: "Alert, head up, tracking movement.", recordedAt: hoursAgo(19, 40), recordedBy: "Volunteer J.M." },
    ],
    hazards: { hazards: ["traffic"], notes: "Fast road, no shoulder. Reporter advised to stay behind the fence.", recordedAt: hoursAgo(20) },
    actions: [
      { id: "d10", text: "Contacted wildlife rescue line", recordedAt: hoursAgo(19, 50), recordedBy: null },
      { id: "d11", text: "Moved people away", recordedAt: hoursAgo(20), recordedBy: null },
    ],
    animalNow: "original_location",
    animalNowDescription: "Under a hedge beside the road, out of the wind.",
    contacts: [
      { id: "dc1", role: "finder", name: "R. Okafor", organization: null, phone: "+44 7700 900123", email: null, preferredContactMethod: "phone", markedPrivate: true },
      { id: "dc2", role: "responder", name: "J. Meyer", organization: "Riverside Wildlife Rescue", phone: "+44 7700 900456", email: "j.meyer@example.org", preferredContactMethod: "phone", markedPrivate: true },
    ],
    custody: [{ id: "d100", holder: "At original location", holderRole: "Volunteer responder en route", location: "Roadside near wetland", startedAt: hoursAgo(19, 30), endedAt: null, handoffId: null }],
    handoffs: [],
    attachments: [],
    timeline: [
      ev("raptor", "incident_created", "Incident created", hoursAgo(20)),
      ev("raptor", "observation_added", "Observation added", hoursAgo(20), "Unable to fly; walks a short distance then stops."),
      ev("raptor", "observation_added", "Observation added", hoursAgo(19, 55), "Right wing hangs lower than left when standing."),
      ev("raptor", "status_changed", 'Status changed from "reported" to "responder_assigned"', hoursAgo(19, 40)),
      ev("raptor", "custody_changed", "Animal location updated: at original location", hoursAgo(19, 30)),
    ],
    notes: [{ id: "dn1", kind: "incident_record", text: "Rescue line confirmed volunteer pickup; receiving facility is Green Valley Wildlife Centre.", createdAt: hoursAgo(19, 20), createdBy: null }],
    tags: ["raptor", "traffic", "awaiting pickup"],
    archivedAt: null,
    deletedAt: null,
  });

  const duck = makeDemo({
    humanReference: "WIH-2026-000102",
    createdAt: hoursAgo(50),
    updatedAt: hoursAgo(40),
    status: "in_care",
    incidentType: "trapped_entangled",
    occurredAt: hoursAgo(50),
    urgency: "appears_distressed",
    summary: "Mallard tangled in fishing line near the pond edge; line removed by responder and transported to a rehabilitation facility.",
    nextStep: "Assessment by rehabilitation staff.",
    animal: { group: "bird", species: "Mallard (unconfirmed)", speciesConfirmed: false, count: 1, lifeStage: "adult", sex: "unknown", description: null },
    location: { description: "Millpond, east bank", precision: "approximate", landmark: "Millpond footbridge", address: null, latitude: 52.205, longitude: 0.118, notes: null },
    observations: [
      { id: "e1", category: "entanglement", text: "Fishing line wrapped around left leg and wing; about 40 cm trailing.", recordedAt: hoursAgo(50), recordedBy: null },
      { id: "e2", category: "movement", text: "Hopping, not flying; feeding normally when undisturbed.", recordedAt: hoursAgo(50), recordedBy: null },
    ],
    hazards: { hazards: ["fishing_line_hooks", "water"], notes: "Two hooks visible in the line.", recordedAt: hoursAgo(50) },
    actions: [
      { id: "e10", text: "Animal contained", recordedAt: hoursAgo(49), recordedBy: "Volunteer J.M." },
      { id: "e11", text: "Transport started to rehabilitation facility", recordedAt: hoursAgo(48), recordedBy: "Volunteer J.M." },
    ],
    animalNow: "rehab_facility",
    animalNowDescription: "Admitted in a ventilated pet carrier.",
    contacts: [{ id: "ec1", role: "receiving_organization", name: null, organization: "Green Valley Wildlife Centre", phone: "+44 7700 900789", email: "intake@example.org", preferredContactMethod: "email", markedPrivate: false }],
    custody: [
      { id: "e100", holder: "Finder", holderRole: "", location: "Millpond", startedAt: hoursAgo(50), endedAt: hoursAgo(49), handoffId: null },
      { id: "e101", holder: "Volunteer responder", holderRole: "Riverside Wildlife Rescue", location: "Transport", startedAt: hoursAgo(49), endedAt: hoursAgo(47), handoffId: "dh1" },
      { id: "e102", holder: "Green Valley Wildlife Centre", holderRole: "Rehabilitation facility", location: "Intake ward", startedAt: hoursAgo(47), endedAt: null, handoffId: "dh2" },
    ],
    handoffs: [
      { id: "dh1", fromParty: "Finder", toParty: "Volunteer responder", fromOrganization: null, toOrganization: "Riverside Wildlife Rescue", receivingPerson: "J. Meyer", method: "In person", occurredAt: hoursAgo(49), conditionNotes: "Line still attached; duck alert and vocalizing.", items: [{ label: "Animal", included: true }, { label: "Paper notes", included: true }], notes: null, completedAt: hoursAgo(49), recordedBy: null },
      { id: "dh2", fromParty: "Volunteer responder", toParty: "Green Valley Wildlife Centre", fromOrganization: "Riverside Wildlife Rescue", toOrganization: "Green Valley Wildlife Centre", receivingPerson: "Intake desk", method: "In person", occurredAt: hoursAgo(47), conditionNotes: "Line removed by responder before transport; small wound visible on leg.", items: [{ label: "Animal", included: true }, { label: "Transport container", included: true }, { label: "Photos", included: true }], notes: null, completedAt: hoursAgo(47), recordedBy: null },
    ],
    attachments: [],
    timeline: [
      ev("duck", "incident_created", "Incident created", hoursAgo(50)),
      ev("duck", "observation_added", "Observation added", hoursAgo(50), "Fishing line wrapped around left leg and wing."),
      ev("duck", "handoff_started", "Handoff from Finder to Volunteer responder", hoursAgo(49)),
      ev("duck", "handoff_completed", "Custody accepted by Volunteer responder", hoursAgo(49)),
      ev("duck", "status_changed", 'Status changed from "responder_assigned" to "in_transport"', hoursAgo(48)),
      ev("duck", "handoff_started", "Handoff from Volunteer responder to Green Valley Wildlife Centre", hoursAgo(47)),
      ev("duck", "custody_changed", "Current custody: Green Valley Wildlife Centre", hoursAgo(47)),
      ev("duck", "status_changed", 'Status changed from "in_transport" to "in_care"', hoursAgo(46)),
      ev("duck", "field_corrected", "Species corrected", hoursAgo(45), "Confirmed from photo by rehab staff", { field: "species", previousValue: "Unknown duck", newValue: "Mallard" }),
    ],
    notes: [],
    tags: ["entanglement", "fishing line"],
    archivedAt: null,
    deletedAt: null,
  });

  const songbird = makeDemo({
    humanReference: "WIH-2026-000103",
    createdAt: hoursAgo(8),
    updatedAt: hoursAgo(7),
    status: "closed",
    incidentType: "collision",
    occurredAt: hoursAgo(8),
    urgency: "appears_stable",
    summary: "Window-strike songbird, stunned on a patio. Recovered after 20 minutes of observation and flew off strongly.",
    nextStep: null,
    animal: { group: "bird", species: null, speciesConfirmed: false, count: 1, lifeStage: "adult", sex: "not_recorded", description: "Small songbird" },
    location: { description: "Back garden patio", precision: "sensitive", landmark: null, address: null, latitude: null, longitude: null, notes: "Private address — kept vague on purpose." },
    observations: [
      { id: "f1", category: "behavior", text: "Sitting still, eyes opening intermittently.", recordedAt: hoursAgo(8), recordedBy: null },
      { id: "f2", category: "movement", text: "Flew to hedge, then left strongly after 20 minutes.", recordedAt: hoursAgo(7), recordedBy: null },
    ],
    hazards: { hazards: ["none_observed"], notes: null, recordedAt: hoursAgo(8) },
    actions: [{ id: "f10", text: "Kept people and pets away", recordedAt: hoursAgo(8), recordedBy: null }],
    animalNow: "released",
    animalNowDescription: null,
    contacts: [],
    custody: [{ id: "f100", holder: "Released", holderRole: "", location: null, startedAt: hoursAgo(7), endedAt: null, handoffId: null }],
    handoffs: [],
    attachments: [],
    timeline: [
      ev("songbird", "incident_created", "Incident created", hoursAgo(8)),
      ev("songbird", "observation_added", "Observation added", hoursAgo(7), "Flew to hedge, then left strongly after 20 minutes."),
      ev("songbird", "incident_closed", "Incident closed — outcome: Released", hoursAgo(7)),
    ],
    notes: [],
    tags: ["window strike"],
    archivedAt: null,
    deletedAt: null,
  });

  const juvenile = makeDemo({
    humanReference: "WIH-2026-000104",
    createdAt: hoursAgo(30),
    updatedAt: hoursAgo(29),
    status: "response_requested",
    incidentType: "orphaned_young",
    occurredAt: hoursAgo(30),
    urgency: "condition_unclear",
    summary: "A single young mammal found on a lawn, no adult seen for several hours. Species uncertain.",
    nextStep: "Awaiting advice from rescue line on whether to intervene.",
    animal: { group: "mammal", species: null, speciesConfirmed: false, count: 1, lifeStage: "young", sex: "unknown", description: "Unknown juvenile mammal, rabbit-sized" },
    location: { description: "Meadow edge, near the mowed lawn boundary", precision: "approximate", landmark: null, address: null, latitude: null, longitude: null, notes: null },
    observations: [
      { id: "g1", category: "behavior", text: "Crouched still in grass; no calling heard.", recordedAt: hoursAgo(30), recordedBy: null },
    ],
    hazards: { hazards: ["pets", "people"], notes: "Family dog uses the garden.", recordedAt: hoursAgo(30) },
    actions: [{ id: "g10", text: "No action taken", recordedAt: hoursAgo(30), recordedBy: null }],
    animalNow: "original_location",
    animalNowDescription: null,
    contacts: [],
    custody: [{ id: "g100", holder: "At original location", holderRole: "", location: null, startedAt: hoursAgo(30), endedAt: null, handoffId: null }],
    handoffs: [],
    attachments: [],
    timeline: [
      ev("juvenile", "incident_created", "Incident created", hoursAgo(30)),
      ev("juvenile", "observation_added", "Observation added", hoursAgo(30), "Crouched still in grass; no calling heard."),
      ev("juvenile", "status_changed", 'Status changed from "reported" to "response_requested"', hoursAgo(29)),
    ],
    notes: [],
    tags: ["juvenile", "orphaned"],
    archivedAt: null,
    deletedAt: null,
  });

  // 0.3: a rapid-repeat pair with identical text — exercises the integrity
  // review queue with clearly fictional data (provenance marked "demo").
  const spamBase = makeDemo({
    humanReference: "WIH-2026-000105",
    createdAt: minutesAgo(14),
    updatedAt: minutesAgo(14),
    status: "reported",
    incidentType: "other",
    occurredAt: minutesAgo(14),
    urgency: null,
    animal: { group: "mammal", species: null, description: "Completely normal squirrel doing squirrel activities", count: 1, speciesConfirmed: false, lifeStage: null, sex: null },
    location: { description: "Plaza fountain (fictional demo street)", latitude: null, longitude: null, landmark: "Fountain", precision: "approximate" as const, address: null, notes: null },
    timeline: [ev("demo-spam-1", "incident_created", "Fictional demo report created", minutesAgo(14))],
    observations: [],
    hazards: null,
    actions: [],
    animalNow: null,
    animalNowDescription: null,
    contacts: [],
    custody: [],
    handoffs: [],
    attachments: [],
    tags: [],
    archivedAt: null,
    deletedAt: null,
    shareProfile: "private",
    createdVia: "form",
    provenance: "demo",
    summary: null,
    nextStep: null,
    notes: [],
  });
  const spamCopy = { ...spamBase, id: "demo-spam-2", humanReference: "WIH-2026-000106", createdAt: minutesAgo(11), occurredAt: minutesAgo(11), updatedAt: minutesAgo(11), provenance: "demo" as const };

  return [raptor, duck, songbird, juvenile, spamBase, spamCopy];
}
