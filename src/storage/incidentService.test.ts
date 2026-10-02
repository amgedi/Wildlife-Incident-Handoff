import { describe, it, expect, beforeEach } from "vitest";
import {
  createIncident, changeStatus, addObservation, correctField, recordHandoff,
  closeIncident, reopenIncident, moveToTrash, restoreFromTrash, custodyWarnings,
} from "./incidentService";
import { getAllIncidents, putIncident, getIncident } from "./repositories";
import type { Incident } from "../types/incident";
import { makeIncident } from "../features/export/exportService.test";

function cleanIncident() {
  const base = makeIncident();
  return { ...base, observations: [], custody: [], timeline: [] } as Parameters<typeof createIncident>[0];
}

async function seed(): Promise<Incident> {
  return createIncident(cleanIncident());
}

describe("incident service — history preservation", () => {
  beforeEach(async () => {
    // ensure empty store
    for (const i of await getAllIncidents()) await putIncident({ ...i, id: i.id }); // no-op
  });

  it("creates an incident with unique reference and a creation event", async () => {
    const a = await createIncident(cleanIncident());
    const b = await createIncident(cleanIncident());
    expect(a.id).not.toBe(b.id);
    expect(a.humanReference).toMatch(/^WIH-\d{4}-\d{6}$/);
    expect(b.humanReference).not.toBe(a.humanReference);
    expect(a.timeline).toHaveLength(1);
    expect(a.timeline[0]!.eventType).toBe("incident_created");
  });

  it("appends a status change event without erasing history", async () => {
    const inc = await seed();
    const updated = await changeStatus(inc, "in_transport", "J. Meyer", "Leaving roadside");
    expect(updated.status).toBe("in_transport");
    const events = updated.timeline.map((e) => e.eventType);
    expect(events).toContain("incident_created");
    expect(events).toContain("status_changed");
    const statusEvent = updated.timeline.find((e) => e.eventType === "status_changed")!;
    expect(statusEvent.details).toBe("Leaving roadside");
  });

  it("keeps observations append-only", async () => {
    const inc = await seed();
    const first = await addObservation(inc, { category: "movement", text: "Unable to fly", recordedBy: null });
    const second = await addObservation(first, { category: "behavior", text: "Alert, tracking movement", recordedBy: null });
    expect(second.observations).toHaveLength(2);
    expect(second.observations[0]!.text).toBe("Unable to fly");
    expect(second.observations[0]!.text).toBe("Unable to fly");
    expect(second.timeline.filter((e) => e.eventType === "observation_added")).toHaveLength(2);
  });

  it("corrections store previous and new values on the timeline", async () => {
    const inc = await seed();
    const corrected = await correctField(inc, "species", "Red-tailed hawk", "Identified from photo", "Rehab staff");
    expect(corrected.animal.species).toBe("Red-tailed hawk");
    const correction = corrected.timeline.find((e) => e.eventType === "field_corrected")!;
    // Previous species was null, so the timeline records "(empty)".
    expect(correction.metadata).toMatchObject({ field: "species", previousValue: "(empty)", newValue: "Red-tailed hawk" });
    expect(correction.details).toBe("Identified from photo");
  });

  it("records handoffs and builds custody history", async () => {
    const inc = await seed();
    const handed = await recordHandoff(
      inc,
      {
        fromParty: "Finder", toParty: "Volunteer responder", fromOrganization: null, toOrganization: "Riverside Rescue",
        receivingPerson: "J. Meyer", method: "In person", occurredAt: new Date().toISOString(),
        conditionNotes: "Alert", items: [{ label: "Animal", included: true }], notes: null,
        completedAt: new Date().toISOString(), recordedBy: null,
      },
      null
    );
    expect(handed.handoffs).toHaveLength(1);
    const current = handed.custody.filter((c) => !c.endedAt);
    expect(current).toHaveLength(1);
    expect(current[0]!.holder).toBe("Volunteer responder");
    const types = handed.timeline.map((e) => e.eventType);
    expect(types).toContain("handoff_started");
    expect(types).toContain("handoff_completed");
    expect(types).toContain("custody_changed");
  });

  it("close then reopen preserves closure history", async () => {
    const inc = await seed();
    const closed = await closeIncident(inc, "Released", "Flew off strongly", null);
    expect(closed.status).toBe("closed");
    const reopened = await reopenIncident(closed);
    expect(reopened.status).toBe("monitoring");
    const summary = reopened.timeline.map((e) => e.summary).join(" | ");
    expect(summary).toContain("closed");
    expect(summary).toContain("reopened");
  });

  it("trash and restore round-trips", async () => {
    const inc = await seed();
    const trashed = await moveToTrash(inc);
    expect(trashed.deletedAt).not.toBeNull();
    const restored = await restoreFromTrash(trashed);
    expect(restored.deletedAt).toBeNull();
    expect(await getIncident(inc.id)).toBeTruthy();
  });

  it("flags status/custody inconsistency instead of silently fixing it", () => {
    const inc = makeIncident({
      status: "released",
      custody: [{ id: "c1", holder: "Veterinary hospital", holderRole: "", location: null, startedAt: new Date().toISOString(), endedAt: null, handoffId: null }],
    });
    expect(custodyWarnings(inc).length).toBeGreaterThan(0);
  });
});
