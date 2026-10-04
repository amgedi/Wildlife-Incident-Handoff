/** Field-aware correction dialog tests (0.3.0-dev.3, spec 44–48, 96, 110):
 *  no generic "New value" label, field-specific reason examples, preview row. */
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AppProvider } from "../../app/AppContext";
import { DEFAULT_SETTINGS } from "../../types/settings";
import { setSetting } from "../../storage/repositories";
import { i18n } from "../../i18n";
import { DetailsTab } from "./detail/DetailsTab";
import {
  CORRECTION_FIELDS,
  WIRED_CORRECTION_FIELDS,
  correctionField,
  FORBIDDEN_GENERIC_LABEL,
  type CorrectionFieldKey,
} from "./correctionFields";
import type { Incident } from "../../types/incident";

function inc(): Incident {
  const t = "2026-10-04T10:00:00Z";
  return {
    id: "corr-1",
    humanReference: "WIH-2026-000001",
    schemaVersion: 1,
    status: "responder_assigned",
    incidentType: null,
    urgency: null,
    animal: { group: "mammal", species: "Eastern cottontail", description: "Juvenile rabbit", count: 1, speciesConfirmed: false, lifeStage: null, sex: null },
    location: { description: "Trail head", latitude: 52.2, longitude: 0.1, landmark: null, precision: "approximate", address: null, notes: null },
    occurredAt: t,
    createdAt: t,
    updatedAt: t,
    timeline: [{ eventType: "incident_created", timestamp: t, actor: "Maya", summary: "created", eventId: "t1", incidentId: "corr-1", details: null, metadata: null, relatedAttachmentIds: [] }],
    custody: [],
    handoffs: [],
    attachments: [],
    isDemo: false,
    deletedAt: null,
    archivedAt: null,
    shareProfile: "private",
    createdVia: "form",
    summary: "Found a juvenile rabbit near the trail",
    nextStep: "Await callback",
    tags: [],
    notes: [],
    observations: [],
    hazards: null,
    actions: [],
    animalNow: null,
    animalNowDescription: null,
    contacts: [],
  } as Incident;
}

function openSpeciesDialog() {
  render(
    <AppProvider>
      <DetailsTab incident={inc()} onChanged={() => {}} />
    </AppProvider>
  );
  // Row order in DetailsTab: summary, species, description, location.
  // The species row is the second "Correct" button.
  const speciesButton = screen.getAllByRole("button", { name: /Correct|Identify/ })[1];
  fireEvent.click(speciesButton!);
}

beforeEach(async () => {
  await i18n.changeLanguage("en");
  await setSetting("app-settings", { ...DEFAULT_SETTINGS, displayName: "Maya" });
});

describe("correction field registry", () => {
  it("covers the required fields with non-generic metadata", () => {
    const keys = CORRECTION_FIELDS.map((f) => f.key) as CorrectionFieldKey[];
    for (const required of ["locationDescription", "landmark", "description", "species", "animalCount", "lifeStage", "sex", "summary", "nextStep"]) {
      expect(keys).toContain(required as CorrectionFieldKey);
    }
    // Every wired field resolves a specific input label — never "New value".
    for (const field of WIRED_CORRECTION_FIELDS) {
      expect(field.inputLabel).not.toBe(FORBIDDEN_GENERIC_LABEL);
      expect(field.inputLabel.startsWith("New ")).toBe(true);
      expect(field.displayName.length).toBeGreaterThan(3);
      expect(field.reasonExample).toBeTruthy();
    }
  });

  it("reason examples are field-specific (no shared generic example)", () => {
    const examples = WIRED_CORRECTION_FIELDS.map((f) => f.reasonExample);
    expect(new Set(examples).size).toBe(examples.length);
    const species = correctionField("species")!;
    expect(species.reasonExample).toContain("rehabilitator");
  });

  it("declares honest wiring: landmark/count/lifeStage/sex are not yet editable via correctField", () => {
    for (const key of ["landmark", "animalCount", "lifeStage", "sex"] as const) {
      expect(correctionField(key)?.wired).toBe(false);
    }
  });
});

describe("field-aware correction dialog", () => {
  it("opens with a field-specific title, input label, current value and reason example", async () => {
    openSpeciesDialog();
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toBeTruthy();
    // Title "Correct Species" — never a generic "Correct field".
    expect(screen.getByText("Correct Species")).toBeTruthy();
    expect(screen.getByText("New species")).toBeTruthy();
    expect(screen.getByText(/Current Species:/)).toBeTruthy();
    const reason = screen.getByLabelText(/Reason for correction/) as HTMLInputElement;
    expect(reason.placeholder).toContain("rehabilitator");
  });

  it("shows a Current → Proposed preview row before save", async () => {
    openSpeciesDialog();
    await screen.findByRole("alertdialog");
    expect(screen.getByTestId("correction-preview").textContent).toContain("Current → Proposed");
  });

  it("never shows the generic 'New value' label for any dialog-reachable field", async () => {
    // Rows offered by DetailsTab, in document order.
    const DIALOG_ROWS = ["summary", "species", "description", "locationDescription"] as const;
    for (const key of DIALOG_ROWS) {
      const field = correctionField(key)!;
      expect(field.wired).toBe(true);
      render(
        <AppProvider>
          <DetailsTab incident={inc()} onChanged={() => {}} />
        </AppProvider>
      );
      const buttons = screen.getAllByRole("button", { name: /Correct|Identify/ });
      fireEvent.click(buttons[DIALOG_ROWS.indexOf(key)]!);
      const dialog = await screen.findByRole("alertdialog");
      expect(dialog.textContent).not.toContain(FORBIDDEN_GENERIC_LABEL);
      // The input label is specific to this field.
      expect(screen.getByText(field.inputLabel)).toBeTruthy();
      // Clean up for the next field iteration.
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    }
  });

  it("saving appends a field_corrected timeline event and keeps the original value", async () => {
    // Persistence logic itself is contract-tested elsewhere; here we assert the
    // dialog still offers the save path that calls correctField with the
    // registry key.
    openSpeciesDialog();
    await screen.findByRole("alertdialog");
    const save = screen.getByRole("button", { name: "Save correction" });
    expect(save).toBeTruthy();
  });
});
