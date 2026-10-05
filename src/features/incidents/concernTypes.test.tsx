/**
 * Concern model V5 tests (0.3.0-dev.5, spec Part XII + 141).
 */
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppProvider } from "../../app/AppContext";
import { CreateIncidentPage } from "./CreateIncidentPage";
import { CONCERN_TYPES, concernDescriptor, concernOf, isAnimalConcern } from "./concernTypes";
import { getAllIncidents, putIncident } from "../../storage/repositories";
import { makeIncident } from "../export/exportService.test";

describe("concern catalog", () => {
  it("offers the six top-level concern categories", () => {
    expect(CONCERN_TYPES.map((c) => c.value)).toEqual([
      "wildlife_animal", "habitat_site", "environmental_hazard",
      "infrastructure_hazard", "human_wildlife_conflict", "other",
    ]);
  });
  it("only the wildlife-animal concern collects mandatory animal details", () => {
    for (const c of CONCERN_TYPES) {
      expect(isAnimalConcern(c.value)).toBe(c.value === "wildlife_animal");
    }
  });
  it("records no legal conclusions anywhere in the vocabulary", () => {
    const all = CONCERN_TYPES.map((c) => `${c.label} ${c.hint}`).join(" ").toLowerCase();
    for (const banned of ["illegal", "poaching", "crime", "criminal", "fraud"]) {
      expect(all).not.toContain(banned);
    }
  });
  it("unknown/legacy concern values fall back to wildlife animal", () => {
    expect(concernOf({ concernType: null })).toBe("wildlife_animal");
    expect(concernOf({} as { concernType?: never })).toBe("wildlife_animal");
    expect(concernDescriptor("nonexistent" as never).value).toBe("wildlife_animal");
  });
});

describe("legacy record migration (spec 141)", () => {
  it("records without concernType migrate as wildlife_animal, no data loss", async () => {
    const legacy = makeIncident();
    delete (legacy as { concernType?: string }).concernType;
    await putIncident(legacy);
    const all = await getAllIncidents();
    const loaded = all.find((i) => i.id === legacy.id)!;
    expect(loaded.concernType).toBe("wildlife_animal");
    expect(loaded.humanReference).toBe(legacy.humanReference);
  });
});

describe("dynamic intake", () => {
  it("wizard step 1 asks for the concern type and adapts the animal step", async () => {
    render(
      <MemoryRouter initialEntries={["/incidents/new"]}>
        <AppProvider>
          <CreateIncidentPage />
        </AppProvider>
      </MemoryRouter>
    );
    const group = await screen.findByRole("radiogroup", { name: /what kind of concern/i });
    expect(group).toBeTruthy();
    // Select a habitat concern → next step is the focused variant, not the animal grid.
    fireEvent.click(screen.getByRole("radio", { name: /habitat \/ site concern/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Next/ }));
    expect(await screen.findByText(/Describe the site and what disturbance/i)).toBeTruthy();
    expect(screen.queryByLabelText(/Animal type/)).toBeNull();
  });
  it("wildlife-animal concerns keep the animal details step", async () => {
    render(
      <MemoryRouter initialEntries={["/incidents/new"]}>
        <AppProvider>
          <CreateIncidentPage />
        </AppProvider>
      </MemoryRouter>
    );
    await screen.findByRole("radiogroup", { name: /what kind of concern/i });
    fireEvent.click(screen.getByRole("radio", { name: /wildlife animal/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Next/ }));
    expect(await screen.findByText("Animal type")).toBeTruthy();
  });
});
