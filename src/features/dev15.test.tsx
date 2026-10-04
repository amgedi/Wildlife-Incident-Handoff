/**
 * 0.3.0-dev.5 regression tests (Part IV / V / XIII / XVI).
 *
 * - activityCategory classification + enriched ActivityFeedEntry
 * - onboarding: every Next advances (the dev.4 privacy stage called
 *   setStage(4) while already on stage 4 — a dead release-blocking button),
 *   Back works, completion enters the workspace
 * - default theme for new profiles is Forest Night
 * - sidebar geometry contract: Pinned/Recent sit between the work nav and
 *   the footer, and the work nav no longer flex-grows (which pushed them
 *   toward the bottom on tall windows)
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useLocation } from "react-router-dom";
import { MemoryRouter } from "react-router-dom";
import { AppProvider } from "../app/AppContext";
import { OnboardingPage } from "./onboarding/OnboardingPage";
import { activityCategory, getActivityFeed, type ActivityFeedEntry } from "./network/incidentAnalytics";
import { THEME_CATALOG } from "./settings/themeCatalog";
import { DEFAULT_SETTINGS } from "../types/settings";
import { makeIncident } from "./export/exportService.test";
import type { Incident } from "../types/incident";

describe("Live Activity V5 classification", () => {
  it("classifies assignment/en-route/pickup status transitions as assignments", () => {
    expect(activityCategory("status_changed", "responder_assigned")).toBe("assignments");
    expect(activityCategory("status_changed", "in_transport")).toBe("status");
    expect(activityCategory("status_changed", "awaiting_pickup")).toBe("status");
  });
  it("classifies transfer transitions and handoff events as handoffs", () => {
    expect(activityCategory("status_changed", "transferred")).toBe("handoffs");
    expect(activityCategory("handoff_started")).toBe("handoffs");
    expect(activityCategory("handoff_completed")).toBe("handoffs");
    expect(activityCategory("custody_changed")).toBe("handoffs");
  });
  it("classifies reports, observations and system events", () => {
    expect(activityCategory("incident_created")).toBe("reports");
    expect(activityCategory("field_corrected")).toBe("reports");
    expect(activityCategory("observation_added")).toBe("observations");
    expect(activityCategory("photo_added")).toBe("observations");
    expect(activityCategory("incident_closed")).toBe("system");
    expect(activityCategory("attachment_removed")).toBe("system");
  });
  it("enriches feed entries with status transition and suppresses location for sensitive reports", () => {
    const base = makeIncident();
    const sensitive: Incident = {
      ...base,
      id: "inc-sensitive",
      location: { ...base.location, precision: "sensitive", description: "Under the old bridge" },
      timeline: [
        ...base.timeline,
        {
          eventId: "ev-status",
          incidentId: "inc-sensitive",
          eventType: "status_changed",
          timestamp: "2026-10-04T15:30:00.000Z",
          actor: "Maya Chen",
          summary: "Status changed",
          details: null,
          metadata: { from: "reported", to: "responder_assigned" },
        },
      ],
    };
    const entries: ActivityFeedEntry[] = getActivityFeed([sensitive], 50);
    const statusEntry = entries.find((e) => e.eventType === "status_changed");
    expect(statusEntry).toBeTruthy();
    expect(statusEntry!.statusFrom).toBe("reported");
    expect(statusEntry!.statusTo).toBe("responder_assigned");
    expect(statusEntry!.actor).toBe("Maya Chen");
    const sensitiveEntry = entries.find((e) => e.incidentId === "inc-sensitive" && e.eventType !== "status_changed");
    if (sensitiveEntry) expect(sensitiveEntry.locationHint).toBeNull();
  });
});

describe("onboarding Next/Back/Complete (release-blocking dev.4 bug)", () => {
  async function renderOnboarding() {
    return render(
      <MemoryRouter initialEntries={["/onboarding"]}>
        <AppProvider>
          <OnboardingPage />
        </AppProvider>
      </MemoryRouter>
    );
  }
  const next = () => fireEvent.click(screen.getByRole("button", { name: "Next" }));
  const back = () => fireEvent.click(screen.getByRole("button", { name: "Back" }));

  it("Next advances through every stage including the privacy stage", async () => {
    await renderOnboarding();
    expect(screen.getByText("Choose your language")).toBeTruthy();
    next(); // 0 language → 1 region
    expect(await screen.findByText("Where are you located?")).toBeTruthy();
    next(); // 1 → 2 profile
    expect(await screen.findByText(/save a profile on this device\?/i)).toBeTruthy();
    next(); // 2 → 3 theme
    expect(await screen.findByText("Pick a look you like")).toBeTruthy();
    next(); // 3 → 4 privacy
    expect(await screen.findByText("Your records stay on this device")).toBeTruthy();
    // THE dev.4 BUG: this Next used to call setStage(4) and never advanced.
    next(); // 4 → 5 ready
    expect(await screen.findByText("You're ready")).toBeTruthy();
  });
  it("Back returns from the privacy stage to the theme stage", async () => {
    await renderOnboarding();
    next(); next(); next();
    await screen.findByText("Pick a look you like");
    next();
    await screen.findByText("Your records stay on this device");
    back();
    expect(await screen.findByText("Pick a look you like")).toBeTruthy();
  });
  it("completes as reporter and enters the workspace", async () => {
    let path = "/onboarding";
    function Probe() { path = useLocation().pathname; return null; }
    render(
      <MemoryRouter initialEntries={["/onboarding"]}>
        <AppProvider>
          <Probe />
          <OnboardingPage />
        </AppProvider>
      </MemoryRouter>
    );
    for (let i = 0; i < 5; i++) next();
    const finish = await screen.findByRole("button", { name: "Continue as reporter" });
    fireEvent.click(finish);
    await waitFor(() => expect(path).toBe("/"));
  });
  it("onboarding theme picker offers the full shared catalog (16 themes incl. Forest Night)", async () => {
    await renderOnboarding();
    next(); next(); next();
    expect(await screen.findByText("Forest Night")).toBeTruthy();
    expect(THEME_CATALOG).toHaveLength(16);
  });
});

describe("defaults and sidebar geometry contract", () => {
  it("new profiles default to Forest Night / frosted / ambient on / motion full", () => {
    expect(DEFAULT_SETTINGS.theme).toBe("forest-night");
    expect(DEFAULT_SETTINGS.material).toBe("frosted");
    expect(DEFAULT_SETTINGS.ambient).toBe("on");
    expect(DEFAULT_SETTINGS.motion).toBe("full");
  });
  it("onboarding picker and Settings render the same catalog", () => {
    const settingsSrc = readFileSync("src/features/settings/SettingsPage.tsx", "utf-8");
    expect(settingsSrc).toContain("THEME_CATALOG");
  });
  it("work nav does not flex-grow and Pinned/Recent sit between nav and footer", () => {
    const css = readFileSync("src/styles/base.css", "utf-8");
    const navWork = css.match(/\.sidebar nav\.nav-work \{[^}]*\}/)?.[0] ?? "";
    expect(navWork).not.toContain("flex: 1");
    const appSrc = readFileSync("src/App.tsx", "utf-8");
    const navWorkPos = appSrc.indexOf('className="nav-work"');
    const contextPos = appSrc.indexOf("<SidebarContextSections />");
    const footerPos = appSrc.indexOf('className="nav-footer"');
    expect(navWorkPos).toBeGreaterThan(-1);
    expect(contextPos).toBeGreaterThan(navWorkPos);
    expect(footerPos).toBeGreaterThan(contextPos);
  });
});
