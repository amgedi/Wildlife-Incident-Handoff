import { describe, it, expect } from "vitest";
import { buildPlainText, buildHtml, INTERNAL_EXPORT, SHAREABLE_EXPORT } from "./exportService";
import type { Incident } from "../../types/incident";

export function makeIncident(overrides: Partial<Incident> = {}): Incident {
  return {
    id: "test-id-1",
    humanReference: "WIH-2026-000001",
    schemaVersion: 1,
    createdAt: "2026-04-01T10:00:00Z",
    updatedAt: "2026-04-01T12:00:00Z",
    status: "awaiting_pickup",
    incidentType: "injured_wildlife",
    occurredAt: "2026-04-01T09:30:00Z",
    urgency: "appears_distressed",
    summary: "Bird beside a road, unable to fly.",
    nextStep: "Waiting for volunteer pickup.",
    animal: { group: "bird", species: null, speciesConfirmed: false, count: 1, lifeStage: "adult", sex: "unknown", description: "Unknown raptor" },
    location: {
      description: "Roadside near wetland",
      precision: "approximate",
      landmark: "Wetland car park",
      address: null,
      latitude: 52.205,
      longitude: 0.118,
      notes: null,
    },
    observations: [{ id: "o1", category: "movement", text: "Unable to fly", recordedAt: "2026-04-01T09:40:00Z", recordedBy: null }],
    hazards: { hazards: ["traffic"], notes: "Fast road", recordedAt: "2026-04-01T09:35:00Z" },
    actions: [{ id: "a1", text: "Contacted wildlife rescue", recordedAt: "2026-04-01T09:50:00Z", recordedBy: null }],
    animalNow: "original_location",
    animalNowDescription: "Under a hedge",
    contacts: [
      { id: "c1", role: "finder", name: "R. Finder", organization: null, phone: "+44 7700 900123", email: "finder@example.org", preferredContactMethod: "phone", markedPrivate: true },
    ],
    custody: [{ id: "cu1", holder: "At original location", holderRole: "Volunteer en route", location: null, startedAt: "2026-04-01T10:00:00Z", endedAt: null, handoffId: null }],
    handoffs: [],
    attachments: [{ id: "at1", fileName: "photo1.jpg", mimeType: "image/jpeg", byteSize: 12345, caption: "The bird", addedAt: "2026-04-01T10:05:00Z", sourceAttribution: null, sensitive: false }],
    timeline: [
      { eventId: "e1", incidentId: "test-id-1", eventType: "incident_created", timestamp: "2026-04-01T10:00:00Z", actor: null, summary: "Incident created", details: null, metadata: null, relatedAttachmentIds: [] },
      { eventId: "e2", incidentId: "test-id-1", eventType: "field_corrected", timestamp: "2026-04-01T11:00:00Z", actor: null, summary: "Species corrected", details: null, metadata: { field: "species", previousValue: "Unknown hawk", newValue: "Red-tailed hawk" }, relatedAttachmentIds: [] },
    ],
    notes: [
      { id: "n1", kind: "incident_record", text: "Rescue line confirmed pickup.", createdAt: "2026-04-01T10:10:00Z", createdBy: null },
      { id: "n2", kind: "private", text: "Private working note — do not share.", createdAt: "2026-04-01T10:12:00Z", createdBy: null },
    ],
    tags: ["raptor"],
    archivedAt: null,
    deletedAt: null,
    isDemo: false,
    ...overrides,
  };
}

describe("export privacy redaction", () => {
  it("shareable export excludes coordinates, personal contacts and private notes", () => {
    const text = buildPlainText(makeIncident(), SHAREABLE_EXPORT);
    expect(text).not.toContain("52.205");
    expect(text).not.toContain("0.118");
    expect(text).not.toContain("900123");
    expect(text).not.toContain("finder@example.org");
    expect(text).not.toContain("Private working note");
    expect(text).toContain("redacted in this export");
  });

  it("internal export includes everything", () => {
    const text = buildPlainText(makeIncident(), INTERNAL_EXPORT);
    expect(text).toContain("52.205");
    expect(text).toContain("900123");
    expect(text).toContain("Private working note");
  });

  it("marks species as unconfirmed", () => {
    const withSpecies = makeIncident({ animal: { group: "bird", species: "Red-tailed hawk", speciesConfirmed: false, count: 1, lifeStage: "adult", sex: "unknown", description: null } });
    const text = buildPlainText(withSpecies, SHAREABLE_EXPORT);
    expect(text).toContain("unconfirmed — as reported");
  });

  it("escapes HTML in user content", () => {
    const malicious = makeIncident({
      summary: '<script>alert("x")</script>',
      animal: { group: "bird", species: null, speciesConfirmed: false, count: null, lifeStage: null, sex: null, description: "<img src=x onerror=alert(1)>" },
    });
    const html = buildHtml(malicious, SHAREABLE_EXPORT);
    expect(html).not.toContain("<script>alert");
    expect(html).not.toContain("<img src=x");
  });

  it("includes reference and timeline highlights", () => {
    const text = buildPlainText(makeIncident(), SHAREABLE_EXPORT);
    expect(text).toContain("WIH-2026-000001");
    expect(text).toContain("TIMELINE HIGHLIGHTS");
    expect(text).toContain("Species corrected");
  });
});
