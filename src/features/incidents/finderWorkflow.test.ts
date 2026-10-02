/**
 * Integration test: the END-TO-END FINDER scenario (spec §86) exercised
 * through the service layer — a person finds an unknown bird near a road,
 * records observations without knowing the species, and hands the case on.
 */
import { describe, it, expect } from "vitest";
import { createIncident, addObservation, changeStatus, recordHandoff } from "../../storage/incidentService";
import { getAllIncidents } from "../../storage/repositories";
import { makeIncident } from "../export/exportService.test";
import { buildPlainText, SHAREABLE_EXPORT } from "../export/exportService";

function finderIncidentData() {
  const base = makeIncident();
  const { id: _id, humanReference: _hr, schemaVersion: _sv, createdAt: _c, updatedAt: _u, timeline: _t, ...rest } = base;
  return {
    ...rest,
    status: "reported" as const,
    observations: [],
    custody: [],
    handoffs: [],
    attachments: [],
    animal: { group: "bird" as const, species: null, speciesConfirmed: false, count: 1, lifeStage: "unknown" as const, sex: "unknown" as const, description: "Unknown bird" },
    location: { description: "Near the road by the park", precision: "approximate" as const, landmark: null, address: null, latitude: null, longitude: null, notes: null },
  };
}

describe("finder end-to-end workflow", () => {
  it("creates an incident with species Unknown, records observations, hazards and hands off", async () => {
    // 1. Create incident, leaving species Unknown.
    const incident = await createIncident(finderIncidentData());
    expect(incident.animal.species).toBeNull();
    expect(incident.status).toBe("reported");

    // 2. Record inability to fly as an observation.
    const withObservation = await addObservation(incident, { category: "movement", text: "Unable to fly", recordedBy: null });
    expect(withObservation.observations).toHaveLength(1);

    // 3. Approximate location, traffic hazard recorded at creation (assert preserved).
    expect(incident.location.precision).toBe("approximate");
    expect(incident.hazards?.hazards).toContain("traffic");

    // 4. State animal remains onsite (assert preserved from creation data).
    expect(incident.animalNow).toBe("original_location");

    // 5. Later: volunteer pickup recorded via status + handoff.
    const dispatched = await changeStatus(withObservation, "awaiting_pickup");
    const handedOff = await recordHandoff(
      dispatched,
      {
        fromParty: "Finder", toParty: "Green Valley Wildlife Centre", fromOrganization: null,
        toOrganization: "Green Valley Wildlife Centre", receivingPerson: "Intake", method: "Volunteer transport",
        occurredAt: new Date().toISOString(), conditionNotes: "Alert but grounded",
        items: [{ label: "Animal", included: true }], notes: null,
        completedAt: new Date().toISOString(), recordedBy: null,
      },
      null
    );

    // History intact: created → observed → dispatched → handed off.
    const types: string[] = handedOff.timeline.map((e) => e.eventType);
    expect(types.indexOf("incident_created")).toBeLessThan(types.indexOf("observation_added"));
    expect(types).toContain("status_changed");
    expect(types).toContain("handoff_completed");

    // 6. Shareable export works and contains the essentials but no coordinates (there are none) or private contacts.
    const stored = await getAllIncidents();
    expect(stored).toHaveLength(1);
    const summary = buildPlainText(stored[0]!, SHAREABLE_EXPORT);
    expect(summary).toContain("Unknown bird");
    expect(summary).toContain("Unable to fly");
    expect(summary).not.toContain("finder@example.org");
  });
});
