/** 0.2.0-dev.10 GUI overhaul tests: map architecture fixes, Help Center
 *  layout contract, dense clustering, language catalog, hard-coded string
 *  sweeps (P56/P67/P69). */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { clusterPoints, serviceAreaPolygon, type MapPoint } from "./network/mapProvider";
import { HelpPage } from "./help/HelpPage";
import { AppProvider } from "../app/AppContext";
import { selectableLanguages } from "../i18n";

const root = "C:/Users/jiggy/Desktop/Wildlife Incident Handoff";

// ---------- P13/P15: map architecture ----------

describe("map reliability fixes", () => {
  it("map containers use explicit heights (no percentage-against-auto-height)", () => {
    const src = readFileSync(join(root, "src/features/network/NetworkMap.tsx"), "utf-8");
    expect(src).toContain('heightFor(');
    expect(src).toContain('"380px"'); // compact dashboard map
    expect(src).toContain('calc(100dvh - 240px)'); // full map page
    expect(src).not.toContain('height: compact ? "100%"');
  });

  it("the map overlay re-renders on load, resize and rAF (no empty-marker race)", () => {
    const src = readFileSync(join(root, "src/features/network/mapProvider.ts"), "utf-8");
    expect(src).toContain('map.on("resize"');
    expect(src).toContain("requestAnimationFrame");
    expect(src).toContain("addServiceAreaLayers");
  });

  it("marker clicks survive overlay re-creation (refId select handler)", () => {
    const src = readFileSync(join(root, "src/features/network/mapProvider.ts"), "utf-8");
    expect(src).toContain("setSelectHandler");
    expect(src).toContain("refId");
  });
});

// ---------- P17: dense clustering ----------

function pt(lat: number, lon: number): MapPoint {
  return { lat, lon, state: "new", label: "t" };
}

describe("dense clustering (1000-incident performance)", () => {
  const bounds = { north: 51.2, south: 50.8, east: -113.8, west: -114.2 };

  it("sparse sets behave as before (no clustering close up)", () => {
    const few = Array.from({ length: 50 }, (_, i) => pt(50.9 + (i % 10) * 0.02, -114.1 + Math.floor(i / 10) * 0.02));
    expect(clusterPoints(few, 12, bounds)).toEqual([]);
  });

  it("dense sets cluster at close zoom to bound the marker DOM", () => {
    const many = Array.from({ length: 600 }, (_, i) => pt(50.95 + (i % 40) * 0.005, -114.1 + Math.floor(i / 40) * 0.01));
    const clusters = clusterPoints(many, 12, bounds);
    expect(clusters.length).toBeGreaterThan(0);
    expect(clusters.length).toBeLessThan(many.length);
  });

  it("dense clustering still returns cells whose counts sum to the point count", () => {
    const many = Array.from({ length: 300 }, (_, i) => pt(50.95 + (i % 30) * 0.005, -114.1 + Math.floor(i / 30) * 0.01));
    const clusters = clusterPoints(many, 9, bounds);
    const total = clusters.reduce((s, c) => s + c.count, 0);
    expect(total).toBe(many.length);
  });

  it("service area polygon is a closed ring with plausible extents", () => {
    const ring = serviceAreaPolygon(51.045, -114.07, 25);
    expect(ring.length).toBe(73);
    expect(ring[0]).toEqual(ring[ring.length - 1]);
    const lons = ring.map((p) => p[0]);
    const lats = ring.map((p) => p[1]);
    expect(Math.max(...lons) - Math.min(...lons)).toBeGreaterThan(Math.max(...lats) - Math.min(...lats)); // E-W wider at 51°N
  });
});

// ---------- P36-40: Help Center ----------

describe("help center two-pane layout", () => {
  it("renders a persistent category rail and reading pane", async () => {
    render(
      <AppProvider>
        <MemoryRouter initialEntries={["/help"]}>
          <Routes>
            <Route path="/help" element={<HelpPage />} />
          </Routes>
        </MemoryRouter>
      </AppProvider>
    );
    await screen.findByRole("heading", { name: "Help center" });
    expect(screen.getByRole("navigation", { name: "Categories" })).toBeTruthy();
    expect(document.querySelector(".help-reader")).toBeTruthy();
    // topic rows, not bordered card paragraphs
    expect(document.querySelectorAll(".help-topic-row").length).toBeGreaterThan(5);
    // open an article (first topic row in the reading pane)
    fireEvent.click(document.querySelector(".help-topic-row") as HTMLElement);
    await waitFor(() => expect(document.querySelector(".help-article")).toBeTruthy());
    // helpful feedback control exists (P51: was this helpful)
    expect(screen.getByRole("button", { name: "Yes" })).toBeTruthy();
  });
});

// ---------- P44/P45: languages ----------

describe("language catalog after authoring packs", () => {
  it("ships five production-selectable languages", () => {
    expect(selectableLanguages(false).map((l) => l.code)).toEqual(["en", "fr", "es", "de", "pt-BR"]);
  });
});

// ---------- hard-coded string sweeps ----------

describe("localization sweeps found by the pseudo-locale", () => {
  it("incident list headings and card meta are no longer hard-coded English", () => {
    const src = readFileSync(join(root, "src/features/incidents/IncidentListPage.tsx"), "utf-8");
    expect(src).toContain('t("navigation:myReports")');
    expect(src).toContain('t("reports:lastUpdatePrefix")');
    expect(src).not.toContain('>Last update: {');
    expect(src).not.toContain('? "My reports" : "Incidents"');
  });

  it("support composer uses the help namespace (was a nonexistent support: ns)", () => {
    const src = readFileSync(join(root, "src/features/help/HelpPage.tsx"), "utf-8");
    expect(src).not.toContain('t("support:');
  });

  it("map legend uses per-status labels from the registry (dev.17)", () => {
    const map = readFileSync(join(root, "src/features/network/NetworkMap.tsx"), "utf-8");
    expect(map).toContain("STATUS_MARKER_STYLES");
    const page = readFileSync(join(root, "src/features/network/NetworkPage.tsx"), "utf-8");
    expect(page).toContain("range24h");
    // 0.3.0-dev.4: the duplicate wall became the grouped DuplicateReview component
    expect(page).toContain('<DuplicateReview');
    expect(page).not.toContain("Possible duplicate report{duplicates");
  });
});
