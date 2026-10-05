/** 0.3.0-dev.7 (Parts XII–XVI): map-side incident list interaction contract.
 *
 *  Single click = SHOW ME THIS INCIDENT ON THE MAP (select + camera + popup,
 *  stay on Map). Opening the record is a separate explicit action: double
 *  click, the "Open incident" button, or Ctrl+Enter. Camera decisions are
 *  privacy-safe by construction — they consume the same fuzzed position the
 *  marker uses, never the raw coordinate.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useParams } from "react-router-dom";
import { readFileSync } from "fs";
import {
  selectionCameraDecision, SELECTION_MIN_ZOOM,
} from "./network/map/mapSelection";
import { AppProvider } from "../app/AppContext";
import { putIncident } from "../storage/repositories";
import { makeIncident } from "./export/exportService.test";

// Stub the real map component: maplibre-gl needs WebGL which jsdom cannot
// provide. The list-interaction contract under test lives in NetworkPage.
vi.mock("./network/NetworkMap", () => ({
  NetworkMap: () => <div data-testid="map-stub" />,
}));

import { NetworkPage } from "./network/NetworkPage";

/** jsdom's location does not track MemoryRouter — probe the matched route. */
function RouteProbe() {
  const { id } = useParams();
  return <div data-testid="route-probe">OPENED:{id}</div>;
}

// Repo-relative so CI (any checkout path) resolves the same files.
const root = ".";

// ---------- Part XIV/XVII: camera decision logic ----------

describe("selection camera decision (pure logic)", () => {
  const wide = { north: 10, south: 0, east: 10, west: 0 };

  it("marker already comfortably in view → small pan only, zoom unchanged", () => {
    const d = selectionCameraDecision({ lat: 5, lon: 5 }, wide, 8);
    expect(d.mode).toBe("ease");
    expect(d.zoom).toBeUndefined();
  });

  it("marker outside the view → smooth flyTo with a reasonable zoom", () => {
    const d = selectionCameraDecision({ lat: 45, lon: 45 }, wide, 5);
    expect(d.mode).toBe("fly");
    expect(d.zoom).toBe(SELECTION_MIN_ZOOM);
  });

  it("never zooms absurdly close: fly zoom is capped", () => {
    const d = selectionCameraDecision({ lat: 45, lon: 45 }, wide, 13.9);
    expect(d.mode).toBe("fly");
    expect(d.zoom!).toBeLessThanOrEqual(13.5);
  });

  it("visible point inside a cluster at low zoom → zooms in to break the cluster (Part XIV)", () => {
    const d = selectionCameraDecision({ lat: 5, lon: 5 }, wide, 4, { clusterMinZoom: 12.5 });
    expect(d.mode).toBe("fly");
    expect(d.zoom).toBe(12.5);
  });

  it("visible clustered point at/above the selection zoom → small pan only", () => {
    expect(selectionCameraDecision({ lat: 5, lon: 5 }, wide, 12.5, { clusterMinZoom: 12.5 }).mode).toBe("ease");
    // clustering disabled → never force-zoom a visible marker
    expect(selectionCameraDecision({ lat: 5, lon: 5 }, wide, 4, { clusterMinZoom: 0 }).mode).toBe("ease");
  });

  it("marker just inside the edge margin still flies (needs margin, spec 47)", () => {
    const d = selectionCameraDecision({ lat: 0.5, lon: 5 }, wide, 6);
    expect(d.mode).toBe("fly");
  });

  it("degenerate/unknown bounds → fly (safe default)", () => {
    expect(selectionCameraDecision({ lat: 5, lon: 5 }, { north: 0, south: 0, east: 0, west: 0 }, 8).mode).toBe("fly");
  });
});

// ---------- Map-side list interaction ----------

function seed(id: string, ref: string, lat: number, lon: number, precision: "exact" | "approximate" | "sensitive" = "approximate") {
  return makeIncident({
    id,
    humanReference: ref,
    location: { latitude: lat, longitude: lon, precision, description: `near ${ref}` },
  } as never);
}

describe("map-side incident list interaction (0.3.0-dev.7)", () => {
  beforeEach(async () => {
    localStorage.clear();
    await putIncident(seed("inc-a", "WI-1001", 51.95, 5.5));
    await putIncident(seed("inc-b", "WI-1002", 51.96, 5.52));
  });

  function renderMapTab() {
    return render(
      <AppProvider>
        <MemoryRouter initialEntries={["/network?view=map"]}>
          <Routes>
            <Route path="/network" element={<NetworkPage />} />
            <Route path="/incidents/:id" element={<RouteProbe />} />
          </Routes>
        </MemoryRouter>
      </AppProvider>
    );
  }

  const rows = () => screen.getAllByTestId("map-side-row");

  it("single click selects the row (accent state) and does NOT navigate away from Map", async () => {
    renderMapTab();
    const row = (await waitFor(() => rows()))[0]!;
    fireEvent.click(row);
    await waitFor(() => expect(row.className).toContain("selected"));
    expect(row.closest("li")?.getAttribute("aria-selected")).toBe("true");
    expect(screen.queryByTestId("route-probe")).toBeNull();
  });

  it("double click opens the full incident record", async () => {
    renderMapTab();
    const row = (await waitFor(() => rows()))[0]!;
    fireEvent.click(row); // selection first
    fireEvent.doubleClick(row);
    await waitFor(() => expect(screen.getByTestId("route-probe").textContent).toBe("OPENED:inc-a"));
  });

  it("exposes an explicit Open incident action per row (accessible alternative)", async () => {
    renderMapTab();
    const row = (await waitFor(() => rows()))[0]!;
    const open = row.querySelector("a")!;
    expect(open.textContent).toContain("Open incident");
    fireEvent.click(open);
    await waitFor(() => expect(screen.getByTestId("route-probe").textContent).toBe("OPENED:inc-a"));
  });

  it("keyboard: Enter selects, ArrowDown moves focus, Ctrl+Enter opens the record", async () => {
    renderMapTab();
    const list = (await waitFor(() => rows())) as HTMLElement[];
    list[0]!.focus();
    fireEvent.keyDown(list[0]!.closest("ul")!, { key: "Enter" });
    await waitFor(() => expect(list[0]!.className).toContain("selected"));
    fireEvent.keyDown(list[0]!.closest("ul")!, { key: "ArrowDown" });
    expect(document.activeElement).toBe(list[1]);
    fireEvent.keyDown(list[1]!.closest("ul")!, { key: "Enter", ctrlKey: true });
    await waitFor(() => expect(screen.getByTestId("route-probe").textContent).toBe("OPENED:inc-b"));
  });

  it("camera targets the marker's privacy-safe position (source contract)", () => {
    // The selection effect must derive its camera target from
    // markerPositionFor + effectivePrivacy — the exact position the visible
    // marker uses — so selection can never reveal hidden coordinates.
    const src = readFileSync(`${root}/src/features/network/NetworkMap.tsx`, "utf-8");
    const camIdx = src.indexOf("Camera target = the exact marker position");
    const block = src.slice(camIdx - 400, camIdx + 900);
    expect(block).toContain("markerPositionFor(incident, effectivePrivacy(incident, privacy))");
  });

  it("list header documents the interaction (click shows on map, double-click opens)", async () => {
    renderMapTab();
    await waitFor(() => rows());
    expect(screen.getByText(/Click: show on map/)).toBeTruthy();
  });
});
