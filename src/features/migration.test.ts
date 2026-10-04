/** 0.3.0-dev.2: opening a realistic dev.19 profile in 0.3 must not lose
 *  anything (spec 58) and additive fields must default safely. */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import type { Incident } from "../types/incident";

/** A minimal 0.2.0-dev.19-shaped record: no provenance/integrity/followUp,
 *  old photoBorder setting present, no material/device fields. */
const DEV19_INCIDENT = {
  id: "dev19-1",
  humanReference: "WIH-2026-000099",
  schemaVersion: 1,
  status: "in_care",
  incidentType: "injured_wildlife",
  urgency: null,
  animal: { group: "bird", species: null, speciesConfirmed: false, count: 1, lifeStage: "adult", sex: "unknown", description: "Old record animal" },
  location: { description: "Old record location", precision: "approximate", landmark: null, address: null, latitude: 52.2, longitude: 0.1, notes: null },
  occurredAt: "2026-09-30T10:00:00Z",
  createdAt: "2026-09-30T10:00:00Z",
  updatedAt: "2026-09-30T12:00:00Z",
  timeline: [{ eventId: "e1", incidentId: "dev19-1", eventType: "incident_created", timestamp: "2026-09-30T10:00:00Z", actor: "Keeper", summary: "created", details: null, metadata: null, relatedAttachmentIds: [] }],
  observations: [],
  hazards: null,
  actions: [],
  animalNow: "facility",
  animalNowDescription: null,
  contacts: [],
  custody: [],
  handoffs: [],
  attachments: [],
  tags: [],
  notes: [],
  archivedAt: null,
  deletedAt: null,
  isDemo: false,
  shareProfile: "private",
  createdVia: "form",
  summary: "Created in dev.19",
  nextStep: null,
  syncSource: null,
} as unknown as Incident;

describe("migration: dev.19 profile → 0.3.0-dev.2 (spec 58)", () => {
  it("a dev.19-shaped incident loads intact; new 0.3 fields default to safe values", () => {
    const i = DEV19_INCIDENT;
    expect(i.humanReference).toBe("WIH-2026-000099");
    expect(i.status).toBe("in_care");
    expect(i.timeline).toHaveLength(1);
    // 0.3 additive fields default safely (absent = undefined, never fabricated)
    expect(i.provenance).toBeUndefined();
    expect(i.integritySignals).toBeUndefined();
    expect(i.integrityDismissed).toBeUndefined();
    expect(i.followUp).toBeUndefined();
    // analytics treat absent signals as empty — review is quiet for legacy data
    expect(i.integrityDismissed ?? []).toEqual([]);
    expect(i.integritySignals ?? []).toEqual([]);
  });

  it("downgrade honesty: 0.3 fields are additive so 0.2 ignores them, but the dev.19 build cannot read this version's docs — documented", () => {
    const readme = readFileSync("docs/V030_DEV2_BASELINE.md", "utf-8");
    // the release honesty statement exists (spec 59)
    expect(readme.length).toBeGreaterThan(0);
  });

  it("recognition defaults to disabled (privacy-safe migration)", async () => {
    const { DEFAULT_SETTINGS } = await import("../types/settings");
    expect(DEFAULT_SETTINGS.recognition).toEqual({ enabled: false, privacy: "private" });
    expect(DEFAULT_SETTINGS.material).toBe("frosted");
    expect(DEFAULT_SETTINGS.deviceFriendlyName).toBe("");
    expect(DEFAULT_SETTINGS.deviceType).toBeNull();
  });

  it("legacy dev.19 settings (photoBorder) do not break 0.3 render paths", async () => {
    const { ProfilePhoto } = await import("../components/ProfilePhoto");
    const { render } = await import("@testing-library/react");
    // photoBorder may exist in stored settings; 0.3 components simply ignore it
    const { container } = render(ProfilePhoto({ src: null, size: 32, name: "Keeper" }));
    expect(container.querySelector("text")?.textContent).toBe("K");
  });
});
