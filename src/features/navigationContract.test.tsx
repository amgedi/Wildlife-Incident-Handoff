/**
 * Navigation contract tests (0.3 overhaul, spec items 28–30).
 *
 * Every major sidebar destination must resolve from every major origin
 * route — including the regression where clicking "Map" while on
 * Response Network did nothing (NetworkPage mirrored ?view= into state
 * and wrote the stale tab back over the new URL).
 *
 * Settings are pre-seeded (onboarded, professional workspace) so the shell
 * renders at the requested origin instead of redirecting through onboarding.
 */
import { describe, it, expect, vi } from "vitest";

// NetworkMap pulls in maplibre-gl (WebGL) which cannot run under jsdom;
// navigation contract tests only care about routes, not the map canvas.
vi.mock("../features/network/NetworkMap", () => ({
  NetworkMap: () => <div data-testid="network-map-mock" />,
}));
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { AppProvider } from "../app/AppContext";
import { App } from "../App";
import { putIncident, setSetting } from "../storage/repositories";
import { DEFAULT_SETTINGS, type AppSettings } from "../types/settings";
import { makeIncident } from "./export/exportService.test";

let currentUrl = "";
function LocationProbe() {
  const location = useLocation();
  currentUrl = location.pathname + location.search;
  return null;
}

const SEEDED_SETTINGS: AppSettings = {
  ...DEFAULT_SETTINGS,
  onboarded: true,
  workspace: "professional",
};

async function renderApp(initial: string) {
  currentUrl = initial;
  await setSetting("app-settings", SEEDED_SETTINGS);
  await putIncident(makeIncident());
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <AppProvider>
        <LocationProbe />
        <App />
      </AppProvider>
    </MemoryRouter>
  );
}

const ORIGINS = ["/", "/network", "/network?view=map", "/incidents", "/incidents/new", "/help", "/settings", "/settings?section=profile"];
const DESTINATIONS: Array<{ label: RegExp; assert: (url: string) => void }> = [
  { label: /^Dashboard$/, assert: (url) => expect(url.split("?")[0]).toBe("/") },
  { label: /^Response network$/i, assert: (url) => expect(url.split("?")[0]).toBe("/network") },
  {
    label: /^Map$/,
    assert: (url) => {
      expect(url.split("?")[0]).toBe("/network");
      expect(new URLSearchParams(url.split("?")[1] ?? "").get("view")).toBe("map");
    },
  },
  { label: /^Incidents$/, assert: (url) => expect(url.split("?")[0]).toBe("/incidents") },
  { label: /^New intake$/, assert: (url) => expect(url.split("?")[0]).toBe("/incidents/new") },
];

function sidebarLink(label: RegExp): HTMLAnchorElement | null {
  const links = [...document.querySelectorAll("a")] as HTMLAnchorElement[];
  return links.find((a) => label.test(a.textContent?.trim() ?? "")) ?? null;
}

describe("navigation contract: every destination from every origin", () => {
  for (const origin of ORIGINS) {
    it(`origin ${origin}`, async () => {
      const { unmount } = await renderApp(origin);
      try {
        await waitFor(() => {
          expect(document.querySelectorAll("a").length).toBeGreaterThan(3);
        }, { timeout: 5000 });
        for (const dest of DESTINATIONS) {
          const link = sidebarLink(dest.label);
          expect(link, `sidebar item ${dest.label} from ${origin}`).toBeTruthy();
          fireEvent.click(link!);
          await waitFor(() => {
            dest.assert(currentUrl);
          });
        }
      } finally {
        unmount();
      }
    });
  }

  it("Map is a professional sidebar destination pointing at /network?view=map", async () => {
    const { PROFESSIONAL_NAV_ITEMS } = await import("../app/navigation");
    const map = PROFESSIONAL_NAV_ITEMS.find((i) => i.to.includes("view=map"));
    expect(map?.to).toBe("/network?view=map");
  });

  it("deep link /network?view=map renders the map view immediately", async () => {
    await renderApp("/network?view=map");
    // mapTitle is localized; assert the mocked map canvas mounted in the map tab.
    expect(await screen.findByTestId("network-map-mock")).toBeTruthy();
  });

  it("switching list→map→list from inside Response Network updates the URL each time", async () => {
    await renderApp("/network");
    const mapBtn = await screen.findByRole("button", { name: "Map" });
    fireEvent.click(mapBtn);
    await waitFor(() => expect(currentUrl.endsWith("?view=map")).toBe(true));
    const listBtn = screen.getByRole("button", { name: "List" });
    fireEvent.click(listBtn);
    await waitFor(() => expect(currentUrl).toBe("/network"));
  });
});
