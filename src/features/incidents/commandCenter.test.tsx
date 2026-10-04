/**
 * 0.3 "Incident Command Center" — top summary band (stat counts + quick
 * filters), List/Table modes (persisted), sortable table, side inspector,
 * density persistence, and regression coverage for search/filters/views.
 */
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { AppProvider } from "../../app/AppContext";
import { putIncident, getSetting, setSetting } from "../../storage/repositories";
import { makeIncident } from "../export/exportService.test";
import { IncidentListPage } from "./IncidentListPage";
import type { Incident } from "../../types/incident";

function renderIncidents() {
  return render(
    <AppProvider>
      <MemoryRouter initialEntries={["/incidents"]}>
        <Routes>
          <Route path="/incidents" element={<IncidentListPage />} />
          <Route path="/incidents/new" element={<div>Create page</div>} />
        </Routes>
      </MemoryRouter>
    </AppProvider>
  );
}

async function seed(...incidents: Incident[]) {
  for (const inc of incidents) await putIncident(inc);
}

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

describe("command center: top summary band", () => {
  it("shows operational counts derived from the seeded live incidents", async () => {
    // Open + unassigned (accepted, nobody holds custody) + waiting >2h.
    const a = makeIncident({
      id: "cc-1",
      humanReference: "WIH-2026-000101",
      status: "responder_assigned",
      custody: [],
      occurredAt: hoursAgo(3),
      updatedAt: hoursAgo(1),
    });
    // Open + awaiting pickup + handoff pending.
    const b = makeIncident({
      id: "cc-2",
      humanReference: "WIH-2026-000102",
      status: "awaiting_pickup",
      occurredAt: hoursAgo(1),
      updatedAt: hoursAgo(0.5),
      handoffs: [
        {
          id: "h1", fromParty: "Finder", toParty: "Rescue", fromOrganization: null, toOrganization: null,
          receivingPerson: null, method: null, occurredAt: hoursAgo(0.5), conditionNotes: null,
          items: [], notes: null, completedAt: null, recordedBy: null,
        },
      ],
    });
    // Recently closed.
    const c = makeIncident({ id: "cc-3", humanReference: "WIH-2026-000103", status: "closed", updatedAt: new Date().toISOString() });
    await seed(a, b, c);

    renderIncidents();
    // The band renders before the async store load finishes — wait for counts.
    expect(await screen.findByRole("button", { name: "Open 2" })).toBeTruthy();
    expect(await screen.findByRole("button", { name: "Unassigned 1" })).toBeTruthy();
    expect(await screen.findByRole("button", { name: "Awaiting pickup 1" })).toBeTruthy();
    expect(await screen.findByRole("button", { name: "Handoff pending 1" })).toBeTruthy();
    expect(await screen.findByRole("button", { name: "Waiting >2 h 1" })).toBeTruthy();
    expect(await screen.findByRole("button", { name: "Recently closed 1" })).toBeTruthy();
  });

  it("clicking a stat applies its filter to the list; clicking again clears it", async () => {
    const a = makeIncident({ id: "cc-1", humanReference: "WIH-2026-000101", status: "awaiting_pickup", occurredAt: hoursAgo(1) });
    const b = makeIncident({ id: "cc-2", humanReference: "WIH-2026-000102", status: "closed", updatedAt: hoursAgo(1) });
    await seed(a, b);
    renderIncidents();
    await waitFor(() => expect(document.querySelectorAll(".report-card").length).toBe(2));

    fireEvent.click(await screen.findByRole("button", { name: "Awaiting pickup 1" }));
    await waitFor(() => expect(document.querySelectorAll(".report-card").length).toBe(1));
    expect(document.querySelector(".report-card")?.textContent).toContain("WIH-2026-000101");

    // Toggle off → both cases visible again.
    fireEvent.click(screen.getByRole("button", { name: "Awaiting pickup 1" }));
    await waitFor(() => expect(document.querySelectorAll(".report-card").length).toBe(2));
  });

  it("excludes deleted and archived incidents from the counts", async () => {
    const live = makeIncident({ id: "cc-live", status: "in_care" });
    const trashed = makeIncident({ id: "cc-dead", status: "in_care", deletedAt: hoursAgo(1) });
    const archived = makeIncident({ id: "cc-arch", status: "in_care", archivedAt: hoursAgo(1) });
    await seed(live, trashed, archived);
    renderIncidents();
    expect(await screen.findByRole("button", { name: "Open 1" })).toBeTruthy();
  });
});

describe("command center: table mode", () => {
  it("renders rows with the required columns and sorts by a clicked header", async () => {
    const a = makeIncident({ id: "t-1", humanReference: "WIH-2026-000202", updatedAt: hoursAgo(1) });
    const b = makeIncident({ id: "t-2", humanReference: "WIH-2026-000201", updatedAt: hoursAgo(2) });
    await seed(a, b);
    renderIncidents();

    // Switch to table mode.
    fireEvent.click(screen.getByRole("button", { name: "Table" }));
    const table = await screen.findByRole("table", { name: "Incidents table" });
    for (const header of ["Reference", "Animal", "Status", "Age", "Location", "Assigned", "Handoff", "Last update"]) {
      expect(table.textContent).toContain(header);
    }
    expect(table.querySelectorAll("tbody tr").length).toBe(2);

    // Default order is most-recent-first; sorting by Reference makes it alphabetical.
    let refs = Array.from(table.querySelectorAll("tbody tr td:first-child")).map((td) => td.textContent);
    expect(refs).toEqual(["WIH-2026-000202", "WIH-2026-000201"]);

    fireEvent.click(screen.getByRole("button", { name: "Sort by Reference ascending" }));
    const tableAfter = screen.getByRole("table", { name: "Incidents table" });
    refs = Array.from(tableAfter.querySelectorAll("tbody tr td:first-child")).map((td) => td.textContent);
    expect(refs).toEqual(["WIH-2026-000201", "WIH-2026-000202"]);

    // aria-sort is announced on the sorted column.
    const sortedTh = tableAfter.querySelector("th[aria-sort='ascending']");
    expect(sortedTh?.textContent).toContain("Reference");
  });

  it("the table is bounded by the same render window as the list", async () => {
    const made: Incident[] = [];
    for (let n = 0; n < 130; n++) made.push(makeIncident({ id: `tt-${n}`, humanReference: `WIH-2026-9${String(n).padStart(4, "0")}` }));
    await seed(...made);
    renderIncidents();
    fireEvent.click(await screen.findByRole("button", { name: "Table" }));
    await waitFor(() => expect(screen.getByRole("table", { name: "Incidents table" }).querySelectorAll("tbody tr").length).toBe(100));
    expect(screen.getByText("Showing 100 of 130 reports")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    await waitFor(() => expect(screen.getByRole("table", { name: "Incidents table" }).querySelectorAll("tbody tr").length).toBe(130));
  });
});

describe("command center: side inspector", () => {
  it("opens on row click with the case reference and closes on Escape", async () => {
    const a = makeIncident({ id: "ins-1", humanReference: "WIH-2026-000301" });
    await seed(a);
    renderIncidents();
    await waitFor(() => expect(document.querySelectorAll(".report-card").length).toBe(1));

    fireEvent.click(document.querySelector(".report-card")!);
    const dialog = await screen.findByRole("dialog", { name: /Case inspector/ });
    expect(dialog.textContent).toContain("WIH-2026-000301");
    expect(dialog.textContent).toContain("Open full incident");

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: /Case inspector/ })).toBeNull());
  });

  it("opens from a table row and shows custody plus handoff state", async () => {
    const a = makeIncident({
      id: "ins-2",
      humanReference: "WIH-2026-000302",
      status: "awaiting_pickup",
      handoffs: [
        {
          id: "h1", fromParty: "Finder", toParty: "Rescue", fromOrganization: null, toOrganization: null,
          receivingPerson: null, method: null, occurredAt: hoursAgo(1), conditionNotes: null,
          items: [], notes: null, completedAt: null, recordedBy: null,
        },
      ],
    });
    await seed(a);
    renderIncidents();
    fireEvent.click(await screen.findByRole("button", { name: "Table" }));
    const row = await screen.findByRole("table", { name: "Incidents table" }).then((t) => t.querySelector("tbody tr")!);
    fireEvent.click(row);
    const dialog = await screen.findByRole("dialog", { name: "Case inspector" });
    expect(dialog.textContent).toContain("WIH-2026-000302");
    expect(dialog.textContent).toContain("At original location");
    expect(dialog.textContent).toContain("Pending");
  });
});

describe("command center: persisted display settings", () => {
  it("persists the chosen mode and density", async () => {
    await seed(makeIncident());
    renderIncidents();
    fireEvent.click(await screen.findByRole("button", { name: "Table" }));
    fireEvent.click(screen.getByRole("button", { name: "List" }));
    fireEvent.click(screen.getByRole("button", { name: "Compact" }));
    await waitFor(async () => {
      expect(await getSetting("incidents-view-mode")).toBe("list");
      expect(await getSetting("incidents-density")).toBe("compact");
    });
  });

  it("restores table mode from the stored setting on load", async () => {
    await setSetting("incidents-view-mode", "table");
    await seed(makeIncident());
    renderIncidents();
    expect(await screen.findByRole("table", { name: "Incidents table" })).toBeTruthy();
    expect(document.querySelectorAll(".report-card").length).toBe(0);
  });
});

describe("command center: list regressions", () => {
  it("search narrows the list and the saved-view/filters UI still works", async () => {
    const a = makeIncident({ id: "r-1", humanReference: "WIH-2026-000401" });
    const b = makeIncident({ id: "r-2", humanReference: "WIH-2026-000402", animal: { group: "mammal", species: "Red fox", speciesConfirmed: true, count: 1, lifeStage: "adult", sex: "unknown", description: null } });
    await seed(a, b);
    renderIncidents();
    await waitFor(() => expect(document.querySelectorAll(".report-card").length).toBe(2));

    fireEvent.change(screen.getByLabelText("Search my reports"), { target: { value: "fox" } });
    await waitFor(() => expect(document.querySelectorAll(".report-card").length).toBe(1));
    expect(document.querySelector(".report-card")?.textContent).toContain("Red fox");

    fireEvent.change(screen.getByLabelText("Search my reports"), { target: { value: "" } });
    await waitFor(() => expect(document.querySelectorAll(".report-card").length).toBe(2));

    // Filters popover still opens with its labeled controls.
    fireEvent.click(screen.getByRole("button", { name: /Filters/ }));
    expect(await screen.findByLabelText("Status")).toBeTruthy();
    expect(screen.getByLabelText("Animal group")).toBeTruthy();
  });

  it("archive and trash segmented views still filter correctly", async () => {
    const live = makeIncident({ id: "v-1", humanReference: "WIH-2026-000501" });
    const archived = makeIncident({ id: "v-2", humanReference: "WIH-2026-000502", archivedAt: hoursAgo(1) });
    const trashed = makeIncident({ id: "v-3", humanReference: "WIH-2026-000503", deletedAt: hoursAgo(1) });
    await seed(live, archived, trashed);
    renderIncidents();
    await waitFor(() => expect(document.querySelectorAll(".report-card").length).toBe(1));
    expect(document.querySelector(".report-card")?.textContent).toContain("WIH-2026-000501");

    fireEvent.click(screen.getByRole("button", { name: "Archived (1)" }));
    await waitFor(() => expect(document.querySelectorAll(".report-card").length).toBe(1));
    expect(document.querySelector(".report-card")?.textContent).toContain("WIH-2026-000502");

    fireEvent.click(screen.getByRole("button", { name: "Trash (1)" }));
    await waitFor(() => expect(document.querySelectorAll(".report-card").length).toBe(1));
    expect(document.querySelector(".report-card")?.textContent).toContain("WIH-2026-000503");
  });

  it("compact density renders two structured rows instead of the full card body", async () => {
    await seed(makeIncident({ id: "d-1", humanReference: "WIH-2026-000601" }));
    renderIncidents();
    await waitFor(() => expect(document.querySelectorAll(".report-card").length).toBe(1));
    const before = document.querySelector(".report-card")!.querySelectorAll(".ic-meta, .ic-updates").length;

    fireEvent.click(screen.getByRole("button", { name: "Compact" }));
    const after = document.querySelector(".report-card")!.querySelectorAll(".ic-meta, .ic-updates").length;
    expect(after).toBe(2);
    expect(after).toBeLessThanOrEqual(before);
    // Structured identity row keeps the reference.
    expect(document.querySelector(".report-card")!.textContent).toContain("WIH-2026-000601");
  });
});
