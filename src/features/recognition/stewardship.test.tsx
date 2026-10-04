/** StewardshipCard tests (0.3.0-dev.3, spec 76–89, 114–115): opt-in UI,
 *  showcase pinning (max 3), milestone toast, theming via CSS variables. */
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AppProvider } from "../../app/AppContext";
import { DEFAULT_SETTINGS } from "../../types/settings";
import { setSetting } from "../../storage/repositories";
import { i18n } from "../../i18n";
import { StewardshipCard } from "./StewardshipCard";
import { stewardshipProgress } from "./recognitionService";
import type { Incident } from "../../types/incident";

let seq = 0;
function inc(overrides: Partial<Incident> = {}): Incident {
  seq += 1;
  const t = new Date(Date.parse("2026-10-04T10:00:00Z") + seq * 60_000).toISOString();
  return {
    id: `s-${seq}`,
    humanReference: `WIH-2026-${String(seq).padStart(6, "0")}`,
    status: "responder_assigned",
    incidentType: null,
    animal: { group: "mammal", species: null, description: "Juvenile rabbit", count: 1, speciesConfirmed: false, lifeStage: null, sex: null },
    location: { description: "Trail head", latitude: 52.2, longitude: 0.1, landmark: null },
    occurredAt: t,
    createdAt: t,
    updatedAt: t,
    timeline: [{ id: `t${seq}`, eventType: "incident_created", timestamp: t, actor: "Maya", summary: "created", eventId: `t${seq}`, incidentId: `s-${seq}`, details: null, metadata: null, relatedAttachmentIds: [] }],
    custody: [{ id: `c${seq}`, holder: "Jordan", holderRole: "Responder", startedAt: t, endedAt: null, location: null, handoffId: null }],
    handoffs: [],
    attachments: [],
    isDemo: false,
    deletedAt: null,
    archivedAt: null,
    shareProfile: "private",
    createdVia: "form",
    summary: null,
    nextStep: null,
    ...overrides,
  } as Incident;
}

const TWO_ACCEPTED = [inc(), inc()];
const PROGRESS = stewardshipProgress(TWO_ACCEPTED, "Maya");

beforeEach(async () => {
  await i18n.changeLanguage("en");
  // Pre-seed stored settings: recognition ON, private, named actor.
  await setSetting("app-settings", {
    ...DEFAULT_SETTINGS,
    displayName: "Maya",
    recognition: { enabled: true, privacy: "private" },
    recognitionShowcase: [],
  });
});

describe("StewardshipCard", () => {
  it("renders header, level and progress bar (data-testid anchors)", async () => {
    render(
      <AppProvider>
        <StewardshipCard incidents={TWO_ACCEPTED} tutorialsCompleted={0} />
      </AppProvider>
    );
    const card = await screen.findByTestId("stewardship-card");
    expect(card).toBeTruthy();
    expect(screen.getByText(/Wildlife Stewardship/)).toBeTruthy();
    // Settings load async — wait for the opt-in state to apply.
    await screen.findByText(/Steward Level/);
    const bar = screen.getByTestId("stewardship-progress");
    expect(bar.getAttribute("role")).toBe("progressbar");
  });

  it("shows the quality-milestones-until-next-level line from stewardshipProgress", async () => {
    render(
      <AppProvider>
        <StewardshipCard incidents={TWO_ACCEPTED} />
      </AppProvider>
    );
    await screen.findByTestId("stewardship-card");
    const expected = PROGRESS.scoreForNextLevel! - PROGRESS.score;
    await screen.findByText(new RegExp(`${expected} quality milestones until next level`));
  });

  it("earned badges can be pinned to the showcase, max 3, persisted via updateSettings", async () => {
    // Give Maya enough earned badges to test the cap (3 pins max).
    const many = Array.from({ length: 3 }, () =>
      inc({
        summary: "Juvenile rabbit with visible injury, behavior observed for ten minutes before calling.",
        attachments: [{ id: "a", fileName: "p.jpg", mimeType: "image/jpeg", byteSize: 1, caption: null, addedAt: "2026-10-04T10:00:00Z", sourceAttribution: null, sensitive: false }],
        handoffs: [{ id: "h", toOrganization: "Riverside Wildlife Rescue", occurredAt: "2026-10-04T11:00:00Z", fromUserId: null } as never],
        timeline: [
          { eventType: "incident_created", timestamp: "2026-10-04T10:00:00Z", actor: "Maya", summary: "created", eventId: "t1", incidentId: "x", details: null, metadata: null, relatedAttachmentIds: [] },
          { eventType: "observation_added", timestamp: "2026-10-04T10:10:00Z", actor: "Maya", summary: "obs", eventId: "t2", incidentId: "x", details: null, metadata: null, relatedAttachmentIds: [] },
        ],
        custody: [{ id: "c", holder: "Maya", holderRole: "Responder", startedAt: "2026-10-04T10:05:00Z", endedAt: null, location: null, handoffId: null }],
      })
    );
    const progress = stewardshipProgress(many, "Maya");
    expect(progress.earned.length).toBeGreaterThanOrEqual(4);

    render(
      <AppProvider>
        <StewardshipCard incidents={many} />
      </AppProvider>
    );
    await screen.findByTestId("stewardship-card");
    const cabinet = await screen.findByTestId("stewardship-cabinet");
    const pins = Array.from(cabinet.querySelectorAll("button"));
    expect(pins.length).toBe(progress.earned.length);

    // Pin three, then the fourth click must be refused (max 3).
    fireEvent.click(pins[0]!);
    fireEvent.click(pins[1]!);
    fireEvent.click(pins[2]!);
    const fourth = pins.find((b) => b.getAttribute("aria-pressed") === "false")!;
    expect(fourth).toBeTruthy();
    fireEvent.click(fourth);

    const stored = (await import("../../storage/repositories")).getSetting;
    await waitFor(async () => {
      const saved = await stored<typeof DEFAULT_SETTINGS>("app-settings");
      expect(saved?.recognitionShowcase).toHaveLength(3);
    });
    // Pinned buttons are aria-pressed; the fourth stayed unpressed.
    const pressed = cabinet.querySelectorAll("button[aria-pressed='true']");
    expect(pressed).toHaveLength(3);
  });

  it("shows locked badges grayed with how-to-earn text, plus the honest commendations hint", async () => {
    render(
      <AppProvider>
        <StewardshipCard incidents={TWO_ACCEPTED} />
      </AppProvider>
    );
    await screen.findByTestId("stewardship-card");
    await screen.findByText("Not yet earned");
    for (const { badge, how } of PROGRESS.locked) {
      expect(screen.getAllByText((_content, el) => el?.textContent?.includes(how) ?? false).length).toBeGreaterThan(0);
      void badge;
    }
    await screen.findByText(/Organization commendations will be possible when connected mode exists/);
  });

  it("keeps recognition private-by-default with the opt-in toggle when disabled", async () => {
    await setSetting("app-settings", { ...DEFAULT_SETTINGS, displayName: "Maya", recognition: { enabled: false, privacy: "private" } });
    render(
      <AppProvider>
        <StewardshipCard incidents={TWO_ACCEPTED} />
      </AppProvider>
    );
    await screen.findByTestId("stewardship-card");
    const toggle = screen.getByRole("checkbox") as HTMLInputElement;
    expect(toggle.checked).toBe(false);
    expect(screen.queryByTestId("stewardship-cabinet")).toBeNull();
    expect(screen.getByText(/no public leaderboard/)).toBeTruthy();
  });

  it("shows one tasteful toast for a newly earned badge vs priorEarned — no confetti", async () => {
    render(
      <AppProvider>
        <StewardshipCard incidents={TWO_ACCEPTED} priorEarned={[]} />
      </AppProvider>
    );
    await screen.findByTestId("stewardship-card");
    await waitFor(() => {
      const region = document.querySelector(".toast-region");
      expect(region?.querySelectorAll(".toast")).toHaveLength(1);
    });
    const toastText = document.querySelector(".toast-region .toast")!.textContent ?? "";
    expect(toastText).toContain("Achievement unlocked —");
    // No confetti/animation artifacts anywhere in the card.
    const card = screen.getByTestId("stewardship-card") as HTMLElement;
    expect(card.innerHTML).not.toContain("confetti");
  });
});
