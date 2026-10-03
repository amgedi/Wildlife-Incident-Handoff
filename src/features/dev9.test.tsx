/** 0.2.0-dev.9 tests: map provider registry (P18/P19), dashboard
 *  customization (P80), saved views (P81), bounded list rendering (P82). */
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { readFileSync } from "fs";
import { join } from "path";
import {
  MAP_PROVIDERS, getMapProviderDescriptor, listMapProviderDescriptors,
  styleForProvider,
} from "./network/mapProvider";
import { AppProvider } from "../app/AppContext";
import { NetworkPage } from "./network/NetworkPage";
import { IncidentListPage } from "./incidents/IncidentListPage";
import { putIncident, getSetting } from "../storage/repositories";
import { makeIncident } from "./export/exportService.test";
import { i18n } from "../i18n";
import type { Incident } from "../types/incident";

const root = "C:/Users/jiggy/Desktop/Wildlife Incident Handoff";

// ---------- P18/P19: map provider registry ----------

describe("map provider registry", () => {
  it("declares at least one online and one offline provider", () => {
    const ids = MAP_PROVIDERS.map((p) => p.id);
    expect(ids).toContain("osm-raster");
    expect(ids).toContain("offline-basemap");
    const offline = getMapProviderDescriptor("offline-basemap");
    expect(offline.kind).toBe("offline");
    expect(offline.requiresNetwork).toBe(false);
    expect(offline.tiles).toEqual([]);
    expect(offline.healthCheckUrl).toBeNull();
  });

  it("every descriptor carries attribution, usage policy and health-check metadata", () => {
    for (const p of listMapProviderDescriptors()) {
      expect(p.label.length).toBeGreaterThan(0);
      expect(typeof p.attribution).toBe("string");
      expect(p.usageNote.length).toBeGreaterThan(10);
      expect(p.maxZoom).toBeGreaterThan(0);
      if (p.kind === "raster-tiles") {
        expect(p.tiles.length).toBeGreaterThan(0);
        expect(p.healthCheckUrl).toBeTruthy();
      }
    }
  });

  it("descriptors never embed incident data or coordinates", () => {
    const serialized = JSON.stringify(MAP_PROVIDERS);
    expect(serialized).not.toMatch(/\d{1,3}\.\d{3,}/); // no precise coordinates
    for (const p of MAP_PROVIDERS) {
      expect(Object.keys(p)).not.toContain("latitude");
      expect(Object.keys(p)).not.toContain("longitude");
    }
  });

  it("unknown provider ids fall back to the first (default) descriptor", () => {
    expect(getMapProviderDescriptor("does-not-exist").id).toBe(MAP_PROVIDERS[0]!.id);
    expect(getMapProviderDescriptor(null).id).toBe(MAP_PROVIDERS[0]!.id);
  });

  it("offline style has zero network sources; raster style declares tiles + attribution", () => {
    const offline = styleForProvider(getMapProviderDescriptor("offline-basemap"));
    expect(Object.keys(offline.sources)).toEqual([]);
    expect(offline.layers.some((l) => l.type === "background")).toBe(true);

    const osm = styleForProvider(getMapProviderDescriptor("osm-raster"));
    const src = osm.sources.basemap as { tiles: string[]; attribution: string };
    expect(src.tiles[0]).toContain("{z}/{x}/{y}");
    expect(src.attribution).toContain("OpenStreetMap");
  });

  it("the map settings UI reads provider metadata from the registry (not hard-coded text)", () => {
    const src = readFileSync(join(root, "src/features/settings/SettingsPage.tsx"), "utf-8");
    expect(src).toContain("getMapProviderDescriptor");
    expect(src).not.toContain('fetch("https://tile.openstreetmap.org');
  });
});

// ---------- P80: dashboard customization ----------

function renderNetwork() {
  return render(
    <AppProvider>
      <MemoryRouter initialEntries={["/network"]}>
        <Routes>
          <Route path="/network" element={<NetworkPage />} />
        </Routes>
      </MemoryRouter>
    </AppProvider>
  );
}

describe("dashboard customization (P80)", () => {
  it("customize dialog lists widgets, hides non-critical ones without a warning", async () => {
    renderNetwork();
    fireEvent.click(await screen.findByTestId("customize-dashboard"));
    const list = await screen.findByTestId("customize-widget-list");
    expect(list.textContent).toContain("Service area map");
    expect(list.textContent).toContain("Needs attention");

    // Hide "Response flow" — no confirmation required for optional widgets.
    const flowLabel = screen.getByText("Response flow").closest("label")!;
    fireEvent.click(flowLabel.querySelector("input[type='checkbox']")!);
    await waitFor(async () => {
      const saved = await getSetting<{ hidden: string[] }>("network-dashboard-layout");
      expect(saved?.hidden).toContain("pipeline");
    });
  });

  it("hiding Needs Attention requires an explicit confirmation (never silent)", async () => {
    renderNetwork();
    fireEvent.click(await screen.findByTestId("customize-dashboard"));
    const attnLabel = screen.getByText("Needs attention").closest("label")!;
    fireEvent.click(attnLabel.querySelector("input[type='checkbox']")!);
    const warn = await screen.findByText(/Hide “Needs attention”\?/);
    expect(warn).toBeTruthy();
    // Nothing persisted before confirming.
    expect(await getSetting("network-dashboard-layout")).toBeFalsy();

    fireEvent.click(screen.getByRole("button", { name: "Hide it" }));
    await waitFor(async () => {
      const saved = await getSetting<{ hidden: string[] }>("network-dashboard-layout");
      expect(saved?.hidden).toContain("attention");
    });
  });

  it("the service-area map cannot be hidden", async () => {
    renderNetwork();
    fireEvent.click(await screen.findByTestId("customize-dashboard"));
    const mapLabel = screen.getByText("Service area map").closest("label")!;
    const box = mapLabel.querySelector("input[type='checkbox']") as HTMLInputElement;
    expect(box.disabled).toBe(true);
    expect(box.checked).toBe(true);
  });

  it("restore recommended layout clears the persisted override", async () => {
    renderNetwork();
    fireEvent.click(await screen.findByTestId("customize-dashboard"));
    fireEvent.click(screen.getByRole("button", { name: "Restore recommended layout" }));
    await waitFor(async () => {
      expect(await getSetting("network-dashboard-layout")).toBeNull();
    });
  });
});

// ---------- P81: saved views ----------

function renderIncidents() {
  return render(
    <AppProvider>
      <MemoryRouter initialEntries={["/incidents"]}>
        <Routes>
          <Route path="/incidents" element={<IncidentListPage />} />
        </Routes>
      </MemoryRouter>
    </AppProvider>
  );
}

describe("saved views (P81)", () => {
  it("saves the current filter set under a name and persists it locally", async () => {
    const a = makeIncident();
    await putIncident(a);
    renderIncidents();
    await waitFor(() => expect(document.querySelectorAll(".report-card").length).toBeGreaterThan(0));

    // Filter to one status, then save the view.
    fireEvent.click(screen.getByRole("button", { name: /Filters/ }));
    const statusSelect = await screen.findByLabelText("Status");
    fireEvent.change(statusSelect, { target: { value: a.status } });
    fireEvent.change(screen.getByPlaceholderText("View name"), { target: { value: "My view" } });
    fireEvent.click(screen.getByRole("button", { name: "Save view" }));
    await screen.findByText("View saved");

    const saved = await getSetting<{ name: string; filters: { status: string } }[]>("incident-saved-views");
    expect(saved?.[0]?.name).toBe("My view");
    expect(saved?.[0]?.filters.status).toBe(a.status);

    // Chip row appears; applying restores the filter after clearing.
    fireEvent.click(screen.getAllByRole("button", { name: "Clear all" })[0]!);
    expect((screen.getByLabelText("Status") as HTMLSelectElement).value).toBe("all");
    fireEvent.click(screen.getByRole("button", { name: "Apply view My view" }));
    expect((screen.getByLabelText("Status") as HTMLSelectElement).value).toBe(a.status);
  });

  it("saved views can be removed", async () => {
    await putIncident(makeIncident());
    renderIncidents();
    await waitFor(() => expect(document.querySelectorAll(".report-card").length).toBeGreaterThan(0));
    fireEvent.click(screen.getByRole("button", { name: /Filters/ }));
    fireEvent.change(screen.getByPlaceholderText("View name"), { target: { value: "Temp" } });
    fireEvent.click(screen.getByRole("button", { name: "Save view" }));
    await screen.findByText("View saved");
    fireEvent.click(screen.getByRole("button", { name: "Remove view Temp" }));
    await waitFor(async () => {
      expect((await getSetting("incident-saved-views")) ?? []).toEqual([]);
    });
  });
});

// ---------- P82: bounded rendering ----------

describe("incident list render cap (P82)", () => {
  it("renders a bounded window with Load more revealing the rest", async () => {
    const made: Incident[] = [];
    for (let n = 0; n < 130; n++) made.push(makeIncident({ id: `perf-${n}`, humanReference: `WI-2026-${1000 + n}` }));
    for (const inc of made) await putIncident(inc);
    renderIncidents();
    await waitFor(() => {
      expect(document.querySelectorAll(".report-card").length).toBe(100);
    });
    expect(screen.getByText("Showing 100 of 130 reports")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    await waitFor(() => {
      expect(document.querySelectorAll(".report-card").length).toBe(130);
    });
  });
});

// ---------- i18n: new keys resolve in every complete locale ----------

describe("dev.9 localization keys", () => {
  const samples: [string, string][] = [
    ["professional:customize", "Customize"],
    ["professional:attentionHideWarnBody", "Needs attention surfaces"],
    ["professional:offlineBasemapNote", "Offline basemap"],
    ["reports:savedViews", "Saved views"],
    ["reports:loadMore", "Load more"],
    ["reports:showingOf", "reports"],
    ["settings:mapProviderPolicy", "community infrastructure"],
  ];
  for (const [key, enFragment] of samples) {
    it(`${key} resolves in en, fr and es (never a raw key)`, async () => {
      for (const lang of ["en", "fr", "es"]) {
        await i18n.changeLanguage(lang);
        const value = i18n.t(key);
        expect(value).toBeTruthy();
        expect(value).not.toBe(key);
        if (lang === "en") expect(value).toContain(enFragment);
      }
      await i18n.changeLanguage("en");
    });
  }
});
