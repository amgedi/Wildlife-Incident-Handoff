import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { IncidentDetailPage } from "./IncidentDetailPage";
import { SpotlightTour } from "../tutorial/SpotlightTour";
import { putIncident } from "../../storage/repositories";
import { AppProvider } from "../../app/AppContext";
import { makeIncident } from "../export/exportService.test";

function renderDetail(id: string, initialEntry = `/incidents/${id}`) {
  return render(
    <AppProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/incidents/:id" element={<IncidentDetailPage />} />
        </Routes>
      </MemoryRouter>
    </AppProvider>
  );
}

describe("incident tab navigation (regression: Export tab stuck)", () => {
  it("deep link ?tab=export opens the Export tab", async () => {
    const inc = makeIncident();
    await putIncident(inc);
    renderDetail(inc.id, `/incidents/${inc.id}?tab=export`);
    await screen.findByText("Handoff summary");
    expect(screen.getByRole("tab", { selected: true }).textContent).toBe("Export");
  });

  it("clicking tabs updates the URL and never reverts the selection", async () => {
    const inc = makeIncident();
    await putIncident(inc);
    renderDetail(inc.id, `/incidents/${inc.id}?tab=export`);
    await screen.findByText("Handoff summary");

    // Export -> Timeline: the old effect would snap the selection back to export.
    fireEvent.click(screen.getByRole("tab", { name: "Timeline" }));
    expect(screen.getByRole("tab", { selected: true }).textContent).toBe("Timeline");
    await screen.findByText("Incident created");

    // Timeline -> People & handoffs
    fireEvent.click(screen.getByRole("tab", { name: "People & handoffs" }));
    expect(screen.getByRole("tab", { selected: true }).textContent).toBe("People & handoffs");

    // People -> Overview
    fireEvent.click(screen.getByRole("tab", { name: "Overview" }));
    expect(screen.getByRole("tab", { selected: true }).textContent).toBe("Overview");
    expect(await screen.findByText("What's happening now")).toBeTruthy();
  });

  it("every tab can be reached from every other tab", async () => {
    const inc = makeIncident();
    await putIncident(inc);
    renderDetail(inc.id);
    await screen.findByText("What's happening now");
    const tabs = ["Timeline", "Observations", "Attachments", "People & handoffs", "Incident details", "Export", "Overview"];
    for (const from of tabs) {
      for (const to of tabs) {
        if (from === to) continue;
        fireEvent.click(screen.getByRole("tab", { name: from }));
        fireEvent.click(screen.getByRole("tab", { name: to }));
        expect(screen.getByRole("tab", { selected: true }).textContent).toBe(to);
      }
    }
  });
});

describe("spotlight overlay cleanup", () => {
  it("removes the overlay completely when closed — no invisible element remains", async () => {
    document.body.innerHTML = '<div data-tour-id="hero">target</div>';
    const { unmount } = render(
      <AppProvider>
        <MemoryRouter>
          <SpotlightHarness />
        </MemoryRouter>
      </AppProvider>
    );
    await new Promise((r) => setTimeout(r, 150));
    expect(document.querySelector(".spotlight-overlay")).toBeTruthy();
    unmount();
    expect(document.querySelector(".spotlight-overlay")).toBeNull();
    expect(document.querySelector(".spotlight-mask")).toBeNull();
    expect(document.querySelector(".spotlight-callout")).toBeNull();
  });
});

function SpotlightHarness() {
  return <SpotlightTour steps={[{ id: "s1", tourId: "hero", title: "T", text: "x" }]} onFinish={() => undefined} />;
}
