/**
 * 0.3.0-dev.2 structural screen-reader audit (spec 23–31).
 * Static + runtime checks for the contracts an NVDA pass would exercise.
 * NVDA itself is NOT available in this environment — results here are the
 * structural foundation, honestly classified as SIMULATED/STRUCTURAL.
 */
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppProvider } from "../app/AppContext";
import { ResponseFlow } from "./network/dashboard/ResponseFlow";
import { CountryComboBox } from "../components/CountryComboBox";
import type { Incident } from "../types/incident";

function inc(status: string): Incident {
  return {
    id: `a-${status}`, humanReference: `WIH-2026-00${status.length}0`, schemaVersion: 1,
    status, incidentType: null,
    animal: { group: "bird", species: null, speciesConfirmed: false, count: 1, lifeStage: null, sex: null, description: "Audit bird" },
    location: { description: null, precision: "approximate", landmark: null, address: null, latitude: null, longitude: null, notes: null },
    occurredAt: "2026-10-04T09:00:00Z", createdAt: "2026-10-04T09:00:00Z", updatedAt: "2026-10-04T09:00:00Z",
    timeline: [], observations: [], hazards: null, actions: [], animalNow: null, animalNowDescription: null,
    contacts: [], custody: [], handoffs: [], attachments: [], tags: [], notes: [],
    archivedAt: null, deletedAt: null, isDemo: false, shareProfile: "private", createdVia: "form",
    summary: null, nextStep: null,
  } as Incident;
}

describe("response flow screen-reader contract (spec 25)", () => {
  it("each stage announces label + count via aria-label and pressed state", () => {
    const scope = [inc("awaiting_pickup"), inc("awaiting_pickup"), inc("in_care")];
    render(
      <MemoryRouter>
        <AppProvider>
          <ResponseFlow scope={scope} />
        </AppProvider>
      </MemoryRouter>
    );
    const pickup = screen.getByRole("button", { name: "Pickup: 2" });
    expect(pickup.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(pickup);
    expect(pickup.getAttribute("aria-pressed")).toBe("true");
    // drawer announces itself as a labelled region
    const drawer = screen.getByRole("region", { label: /Pickup/i });
    expect(drawer.textContent).toContain("2");
  });

  it("keyboard: arrow keys move selection (tab-like semantics)", () => {
    const scope = [inc("awaiting_pickup"), inc("in_care")];
    render(
      <MemoryRouter>
        <AppProvider>
          <ResponseFlow scope={scope} />
        </AppProvider>
      </MemoryRouter>
    );
    const pickup = screen.getByRole("button", { name: "Pickup: 1" });
    fireEvent.click(pickup);
    fireEvent.keyDown(pickup, { key: "ArrowRight" });
    // selection moved to the NEXT stage (Transfer, 0 cases) — pressed state moves
    const transfer = screen.getByRole("button", { name: /Transfer: 0/ });
    expect(transfer.getAttribute("aria-pressed")).toBe("true");
    expect(pickup.getAttribute("aria-pressed")).toBe("false");
  });
});

describe("country combobox semantics (spec 31)", () => {
  it("combobox + listbox + options with selected state; Escape closes", () => {
    const { container } = render(<CountryComboBox label="Country or region" value="CA" onChange={() => undefined} />);
    const trigger = screen.getByRole("combobox");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    const listbox = screen.getByRole("listbox");
    expect(listbox).toBeTruthy();
    const canada = screen.getByRole("option", { selected: true });
    expect(canada.textContent).toContain("Canada");
    fireEvent.keyDown(trigger, { key: "Escape" });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(container).toBeTruthy();
  });
});

describe("palette + titlebar audit (spec 24)", () => {
  it("palette dialog is labelled; options are listbox options", async () => {
    const { CommandPalette } = await import("../components/CommandPalette");
    render(
      <MemoryRouter>
        <AppProvider>
          <CommandPalette open onClose={() => undefined} />
        </AppProvider>
      </MemoryRouter>
    );
    expect(screen.getByRole("dialog", { name: /command palette/i })).toBeTruthy();
    expect(screen.getByRole("listbox")).toBeTruthy();
    const input = screen.getByRole("textbox");
    expect(input.getAttribute("aria-label")).toMatch(/command palette/i);
  });
});
