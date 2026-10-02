/**
 * Incident service: every mutation flows through here so that current state
 * and the append-only timeline stay synchronized in one place.
 *
 * Rules:
 * - Corrections never erase history: previous values live on timeline events.
 * - Status and custody changes create events.
 * - Unknown stays a valid value everywhere.
 */
import type {
  ContactInfo,
  Handoff,
  Incident,
  IncidentNote,
  IncidentStatus,
  Observation,
  TimelineEvent,
  TimelineEventType,
} from "../types/incident";
import { SCHEMA_VERSION } from "../types/incident";
import { randomId, formatHumanReference, nextSequenceFromRefs } from "../utils/id";
import { cleanText } from "../utils/text";
import { nowIso } from "../utils/time";
import { getAllIncidents, putIncident, deleteIncidentRecord } from "./repositories";

export interface ActorInfo {
  actor?: string | null;
}

function makeEvent(
  incidentId: string,
  eventType: TimelineEventType,
  summary: string,
  options?: {
    details?: string | null;
    actor?: string | null;
    metadata?: Record<string, string> | null;
    relatedAttachmentIds?: string[];
    timestamp?: string;
  }
): TimelineEvent {
  return {
    eventId: randomId(),
    incidentId,
    eventType,
    timestamp: options?.timestamp ?? nowIso(),
    actor: options?.actor ?? null,
    summary,
    details: options?.details ?? null,
    metadata: options?.metadata ?? null,
    relatedAttachmentIds: options?.relatedAttachmentIds ?? [],
  };
}

function touch(incident: Incident): Incident {
  return { ...incident, updatedAt: nowIso() };
}

/** Create a full incident record from wizard data (already reviewed by the user). */
export async function createIncident(
  data: Omit<Incident, "id" | "humanReference" | "schemaVersion" | "createdAt" | "updatedAt" | "timeline" | "status"> & {
    status?: IncidentStatus;
    actor?: string | null;
  }
): Promise<Incident> {
  const all = await getAllIncidents();
  const year = new Date().getFullYear();
  const seq = nextSequenceFromRefs(all.map((i) => i.humanReference));
  const now = nowIso();
  const incident: Incident = {
    ...data,
    id: crypto.randomUUID(),
    humanReference: formatHumanReference(year, seq),
    schemaVersion: SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now,
    status: data.status ?? "reported",
    timeline: [
      makeEvent("", "incident_created", `Incident created`, {
        details: cleanText(data.summary ?? "") || null,
        actor: data.actor ?? null,
      }),
    ],
  };
  incident.timeline[0]!.incidentId = incident.id;
  await putIncident(incident);
  return incident;
}

export async function changeStatus(
  incident: Incident,
  newStatus: IncidentStatus,
  actor?: string | null,
  note?: string | null
): Promise<Incident> {
  if (incident.status === newStatus) return incident;
  const event = makeEvent(
    incident.id,
    "status_changed",
    `Status changed from "${incident.status}" to "${newStatus}"`,
    { actor, details: note ?? null }
  );
  const updated = touch({ ...incident, status: newStatus, timeline: [...incident.timeline, event] });
  await putIncident(updated);
  return updated;
}

export async function addObservation(
  incident: Incident,
  observation: Omit<Observation, "id" | "recordedAt">,
  actor?: string | null
): Promise<Incident> {
  const full: Observation = { ...observation, id: randomId(), recordedAt: nowIso() };
  const event = makeEvent(incident.id, "observation_added", "Observation added", {
    details: observation.text,
    actor,
    metadata: { category: observation.category },
  });
  const updated = touch({
    ...incident,
    observations: [...incident.observations, full],
    timeline: [...incident.timeline, event],
  });
  await putIncident(updated);
  return updated;
}

export async function addNote(
  incident: Incident,
  note: Omit<IncidentNote, "id" | "createdAt">,
  actor?: string | null
): Promise<Incident> {
  const full: IncidentNote = { ...note, id: randomId(), createdAt: nowIso() };
  const event = makeEvent(
    incident.id,
    "note_added",
    note.kind === "private" ? "Private working note added" : "Incident note added",
    { details: note.text, actor }
  );
  const updated = touch({ ...incident, notes: [...incident.notes, full], timeline: [...incident.timeline, event] });
  await putIncident(updated);
  return updated;
}

export async function addContact(
  incident: Incident,
  contact: Omit<ContactInfo, "id">,
  actor?: string | null
): Promise<Incident> {
  const full: ContactInfo = { ...contact, id: randomId() };
  const roleLabel = contact.role.replaceAll("_", " ");
  const event = makeEvent(incident.id, "contact_added", `Contact added: ${roleLabel}`, { actor });
  const updated = touch({ ...incident, contacts: [...incident.contacts, full], timeline: [...incident.timeline, event] });
  await putIncident(updated);
  return updated;
}

/**
 * Correct a simple text field while preserving the previous value on the timeline.
 * Used for species, location description, next step and similar free-text fields.
 */
export async function correctField(
  incident: Incident,
  field: "species" | "description" | "locationDescription" | "nextStep" | "summary",
  newValue: string,
  reason: string | null,
  actor?: string | null
): Promise<Incident> {
  let previousValue: string | null;
  let label: string;
  const next: Incident = { ...incident };
  switch (field) {
    case "species":
      previousValue = incident.animal.species;
      label = "Species";
      next.animal = { ...incident.animal, species: cleanText(newValue) };
      break;
    case "description":
      previousValue = incident.animal.description;
      label = "Animal description";
      next.animal = { ...incident.animal, description: cleanText(newValue) };
      break;
    case "locationDescription":
      previousValue = incident.location.description;
      label = "Location description";
      next.location = { ...incident.location, description: cleanText(newValue) };
      break;
    case "nextStep":
      previousValue = incident.nextStep;
      label = "Next step";
      next.nextStep = cleanText(newValue);
      break;
    case "summary":
      previousValue = incident.summary;
      label = "What happened";
      next.summary = cleanText(newValue);
      break;
  }
  const event = makeEvent(incident.id, "field_corrected", `${label} corrected`, {
    actor,
    details: reason ?? null,
    metadata: {
      field,
      previousValue: previousValue ?? "(empty)",
      newValue: cleanText(newValue),
    },
  });
  const updated = touch({ ...next, timeline: [...incident.timeline, event] });
  await putIncident(updated);
  return updated;
}

/** Record a completed or in-progress handoff and update custody. */
export async function recordHandoff(
  incident: Incident,
  handoff: Omit<Handoff, "id">,
  actor?: string | null
): Promise<Incident> {
  const full: Handoff = { ...handoff, id: randomId() };
  const startedEvent = makeEvent(incident.id, "handoff_started", `Handoff from ${full.fromParty || "unknown"} to ${full.toParty || "unknown"}`, {
    actor: actor ?? full.recordedBy,
    details: full.method ? `Method: ${full.method}` : null,
  });
  const events: TimelineEvent[] = [startedEvent];
  const custody = [...incident.custody];
  if (custody.length > 0) {
    const last = custody[custody.length - 1]!;
    custody[custody.length - 1] = { ...last, endedAt: full.occurredAt };
  }
  custody.push({
    id: randomId(),
    holder: full.toParty || "Unknown",
    holderRole: full.toOrganization ?? "",
    location: null,
    startedAt: full.occurredAt,
    endedAt: null,
    handoffId: full.id,
  });
  if (full.completedAt) {
    events.push(
      makeEvent(incident.id, "handoff_completed", `Custody accepted by ${full.toParty || "unknown"}`, {
        actor: full.receivingPerson ?? full.toParty,
        timestamp: full.completedAt,
      })
    );
  }
  events.push(
    makeEvent(incident.id, "custody_changed", `Current custody: ${full.toParty || "unknown"}`, {
      timestamp: full.occurredAt,
      actor,
    })
  );
  const updated = touch({
    ...incident,
    handoffs: [...incident.handoffs, full],
    custody,
    timeline: [...incident.timeline, ...events],
  });
  await putIncident(updated);
  return updated;
}

export async function closeIncident(
  incident: Incident,
  outcome: string,
  finalNotes: string | null,
  actor?: string | null
): Promise<Incident> {
  const event = makeEvent(incident.id, "incident_closed", `Incident closed — outcome: ${outcome}`, {
    actor,
    details: finalNotes,
  });
  const updated = touch({
    ...incident,
    status: "closed",
    nextStep: null,
    timeline: [...incident.timeline, event],
  });
  await putIncident(updated);
  return updated;
}

export async function reopenIncident(incident: Incident, actor?: string | null): Promise<Incident> {
  const event = makeEvent(incident.id, "incident_reopened", "Incident reopened", { actor });
  const updated = touch({ ...incident, status: "monitoring", timeline: [...incident.timeline, event] });
  await putIncident(updated);
  return updated;
}

export async function updateCurrentLocation(
  incident: Incident,
  animalNow: Incident["animalNow"],
  description: string | null,
  actor?: string | null
): Promise<Incident> {
  const label = animalNow ? animalNow.replaceAll("_", " ") : "unknown";
  const event = makeEvent(incident.id, "custody_changed", `Animal location updated: ${label}`, { actor, details: description });
  const updated = touch({ ...incident, animalNow, animalNowDescription: description, timeline: [...incident.timeline, event] });
  await putIncident(updated);
  return updated;
}

// --- Trash / archive ---

export async function moveToTrash(incident: Incident): Promise<Incident> {
  const updated = touch({ ...incident, deletedAt: nowIso() });
  await putIncident(updated);
  return updated;
}

export async function restoreFromTrash(incident: Incident): Promise<Incident> {
  const updated = touch({ ...incident, deletedAt: null });
  await putIncident(updated);
  return updated;
}

export async function archiveIncident(incident: Incident): Promise<Incident> {
  const event = makeEvent(incident.id, "incident_archived", "Incident archived", {});
  const updated = touch({ ...incident, archivedAt: nowIso(), timeline: [...incident.timeline, event] });
  await putIncident(updated);
  return updated;
}

export async function unarchiveIncident(incident: Incident): Promise<Incident> {
  const event = makeEvent(incident.id, "incident_restored", "Incident unarchived", {});
  const updated = touch({ ...incident, archivedAt: null, timeline: [...incident.timeline, event] });
  await putIncident(updated);
  return updated;
}

/** Permanent delete: removes the record and its attachment blobs. */
export async function permanentlyDelete(incident: Incident): Promise<void> {
  await deleteIncidentRecord(incident.id);
  const { deleteAttachmentsForIncident } = await import("./repositories");
  await deleteAttachmentsForIncident(incident.id);
}

// --- Consistency warnings (never silently fixed) ---

export function custodyWarnings(incident: Incident): string[] {
  const warnings: string[] = [];
  const current = incident.custody.filter((c) => !c.endedAt).at(-1);
  if (incident.status === "released" && current && !/released/i.test(current.holder + " " + current.holderRole)) {
    warnings.push("Status is Released but current custody still shows an organization. Consider recording a final custody change.");
  }
  if (incident.status === "in_transport" && current && !/transport|responder|volunteer/i.test(current.holder + " " + current.holderRole)) {
    warnings.push("Status is In transport but custody does not show a transporter.");
  }
  return warnings;
}
