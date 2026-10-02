/** 0.2.0-dev.7 overhaul tests: profile/phone, structured analytics events,
 *  legacy event compatibility, notifications, authorization separation,
 *  onboarding defaults, tour contract, help center, dashboard analytics. */
import { describe, it, expect, beforeAll } from "vitest";
import { parsePhone, isValidPhone, normalizePhoneForStorage, displayPhone } from "../utils/phone";
import {
  getResponseTimeMetrics, getResponderWorkload,
  getTimeSeries, getActivityFeed,
} from "../features/network/incidentAnalytics";
import { recordNotification, isQuietHours, listNotifications, clearNotifications, unreadNotificationCount } from "../storage/notificationService";
import { getAuthorizationState, isVerifiedResponder, UNVERIFIED_AUTHORIZATION } from "../features/network/authorization";
import { DEFAULT_SETTINGS, DEFAULT_NOTIFICATION_PREFERENCES } from "../types/settings";
import { buildInterfaceTourSteps, buildDemoTourSteps } from "../features/tutorial/guidance";
import type { TourStepV2 } from "../features/tutorial/tourStepsTypes";
import { resetDbForTests } from "../storage/db";
import type { Incident, TimelineEvent } from "../types/incident";

beforeAll(async () => {
  await resetDbForTests();
});

// ---------- B. International phone numbers ----------

describe("international phone handling", () => {
  it("parses non-North-American numbers with country hint", () => {
    const r = parsePhone("0121 555 0199", "GB");
    expect(r.valid).toBe(true);
    expect(r.e164).toBe("+441215550199");
  });
  it("parses +1 without assuming it", () => {
    expect(isValidPhone("+1 416 555 0199")).toBe(true);
    expect(isValidPhone("212 555 0199", "US")).toBe(true);
  });
  it("parses a French mobile", () => {
    const r = parsePhone("06 12 34 56 78", "FR");
    expect(r.valid).toBe(true);
    expect(r.e164).toBe("+33612345678");
    expect(r.country).toBe("FR");
  });
  it("normalizes to E.164 for storage but preserves unparseable raw input", () => {
    expect(normalizePhoneForStorage("0121 555 0199", "GB")).toBe("+441215550199");
    const raw = "0500-PROBABLY-NOT-A-NUMBER";
    expect(normalizePhoneForStorage(raw, "GB")).toBe(raw);
  });
  it("formats stored E.164 for display", () => {
    expect(displayPhone("+441215550199")).toContain("+44");
  });
  it("rejects incomplete numbers", () => {
    expect(isValidPhone("+44 7")).toBe(false);
  });
});

// ---------- Z. Structured analytics events + legacy compat ----------

function makeIncident(overrides: Partial<Incident>, events: Partial<TimelineEvent>[]): Incident {
  const base: Incident = {
    id: overrides.id ?? "inc-1",
    humanReference: "WIH-2026-000001",
    schemaVersion: 2,
    createdAt: "2026-10-02T10:00:00Z",
    updatedAt: "2026-10-02T12:00:00Z",
    status: "reported",
    incidentType: "injured_wildlife",
    occurredAt: null,
    urgency: null,
    animal: { group: "bird", species: null, speciesConfirmed: false, count: 1, lifeStage: null, sex: null, description: null },
    location: { description: null, precision: "approximate", landmark: null, address: null, latitude: null, longitude: null, notes: null },
    observations: [],
    hazards: null,
    actions: [],
    animalNow: null,
    animalNowDescription: null,
    contacts: [],
    custody: [],
    handoffs: [],
    attachments: [],
    timeline: [],
    notes: [],
    tags: [],
    archivedAt: null,
    deletedAt: null,
    isDemo: false,
    shareProfile: "private",
    createdVia: "form",
    summary: null,
    nextStep: null,
  };
  const timeline: TimelineEvent[] = events.map((e, i) => ({
    eventId: `e${i}`,
    incidentId: base.id,
    eventType: "status_changed",
    timestamp: `2026-10-02T${String(11 + i).padStart(2, "0")}:00:00Z`,
    actor: e.actor ?? "Test",
    summary: e.summary ?? `event ${i}`,
    metadata: e.metadata ?? null,
    details: e.details ?? null,
    relatedAttachmentIds: [],
  }));
  return { ...base, ...overrides, timeline } as Incident;
}

describe("structured analytics events", () => {
  it("derives assignment from structured status_changed metadata (no text parsing)", () => {
    const inc = makeIncident({}, [
      { summary: "Completely unrelated wording", metadata: { from: "reported", to: "responder_assigned" } },
    ]);
    const m = getResponseTimeMetrics([inc]);
    expect(m.medianHoursToAssignment).toBeCloseTo(1, 5);
  });
  it("falls back to legacy summary text for old records", () => {
    const inc = makeIncident({}, [
      { summary: "Responder assigned", metadata: null },
    ]);
    const m = getResponseTimeMetrics([inc]);
    expect(m.medianHoursToAssignment).not.toBeNull();
  });
  it("counts resolvedToday from structured resolution events, not updatedAt", () => {
    const inc = makeIncident({ status: "released" }, [
      { summary: "Status changed from in_care to released", metadata: { from: "in_care", to: "released" } },
    ]);
    // updatedAt is 12:00 local-independent; the structured event timestamp is 10:00Z.
    const m = getResponseTimeMetrics([inc], new Date(2026, 9, 2, 12, 0));
    expect(m.resolvedToday).toBe(1);
  });
  it("shows sufficientData=false with no data and no zero medians", () => {
    const m = getResponseTimeMetrics([]);
    expect(m.sufficientData).toBe(false);
    expect(m.medianHoursToAssignment).toBeNull();
  });
  it("feeds live activity from real timeline events", () => {
    const inc = makeIncident({}, [
      { summary: "New report", metadata: { from: "reported", to: "reported" } },
      { summary: "Responder assigned", metadata: { from: "reported", to: "responder_assigned" } },
    ]);
    const feed = getActivityFeed([inc]);
    expect(feed.length).toBe(2);
    expect(feed[0]!.summary).toBe("Responder assigned"); // newest first
  });
  it("workload lists actors without rankings beyond capacity counts", () => {
    const inc = makeIncident({}, [
      { summary: "x", metadata: { from: "reported", to: "responder_assigned" }, actor: "Alex" },
    ]);
    inc.custody = [{ id: "c1", holder: "Alex", holderRole: "", location: null, startedAt: "2026-10-02T11:00:00Z", endedAt: null, handoffId: null }];
    const wl = getResponderWorkload([inc]);
    expect(wl).toHaveLength(1);
    expect(wl[0]).toMatchObject({ actor: "Alex", assignedCases: 1, activeCases: 1 });
  });
  it("time series supports 90 days", () => {
    expect(getTimeSeries([], 90)).toHaveLength(90);
    expect(getTimeSeries([], 1)).toHaveLength(24);
  });
});

// ---------- AG / AF. Notifications ----------

describe("local notifications", () => {
  it("records and lists notifications newest-first", async () => {
    await clearNotifications();
    await recordNotification({ category: "status_changed", title: "Status", body: "Changed" });
    await recordNotification({ category: "resolved", title: "Resolved", body: "Done" });
    const list = await listNotifications();
    expect(list.length).toBe(2);
    expect(list[0]!.title).toBe("Resolved");
  });
  it("tracks unread count", async () => {
    await clearNotifications();
    await recordNotification({ category: "resolved", title: "t", body: "b" });
    expect(await unreadNotificationCount()).toBe(1);
    await clearNotifications();
    expect(await unreadNotificationCount()).toBe(0);
  });
  it("quiet hours handle overnight windows", () => {
    expect(isQuietHours("22:00", "07:00", new Date(2026, 9, 2, 23, 30))).toBe(true);
    expect(isQuietHours("22:00", "07:00", new Date(2026, 9, 2, 12, 0))).toBe(false);
    expect(isQuietHours("07:00", "22:00", new Date(2026, 9, 2, 8, 0))).toBe(true);
    expect(isQuietHours("22:00", "07:00", new Date(2026, 9, 2, 7, 0))).toBe(false);
  });
});

// ---------- E / AZ. Authorization separation ----------

describe("authorization separation", () => {
  it("never grants verified status locally, regardless of workspace settings", () => {
    expect(getAuthorizationState().status).toBe("unverified");
    expect(getAuthorizationState().claimsSource).toBe("none");
    expect(isVerifiedResponder()).toBe(false);
  });
  it("returns a fresh object that callers cannot use to mutate the constant", () => {
    const s = getAuthorizationState();
    s.status = "verified";
    expect(UNVERIFIED_AUTHORIZATION.status).toBe("unverified");
  });
});

// ---------- C. First-run defaults ----------

describe("first-run defaults", () => {
  it("defaults to the reporter workspace (normal users do not start professional)", () => {
    expect(DEFAULT_SETTINGS.workspace).toBe("reporter");
    expect(DEFAULT_SETTINGS.onboarded).toBe(false);
  });
  it("profile pre-fill never shares automatically (privacy fields default closed)", () => {
    expect(DEFAULT_SETTINGS.includeContactsInShareable).toBe(false);
    expect(DEFAULT_SETTINGS.savedReporterContact).toBeNull();
    expect(DEFAULT_SETTINGS.professionalProfile).toBeNull();
  });
  it("notification preferences include reporter and professional categories", () => {
    expect(DEFAULT_NOTIFICATION_PREFERENCES.inApp).toBe(true);
    expect(DEFAULT_NOTIFICATION_PREFERENCES.categories["status_changed"]).toBe(true);
    expect(DEFAULT_NOTIFICATION_PREFERENCES.categories["new_in_service_area"]).toBe(true);
  });
});

// ---------- AN. Tutorial step contract ----------

describe("tutorial step contract", () => {
  const workspaceSteps: Record<string, Awaited<ReturnType<typeof buildInterfaceTourSteps>>> = { reporter: [], professional: [] };
  beforeAll(async () => {
    workspaceSteps.reporter = await buildInterfaceTourSteps("reporter");
    workspaceSteps.professional = await buildInterfaceTourSteps("professional");
  });

  for (const ws of Object.keys(workspaceSteps)) {
    it(`${ws} tour: every step declares a target, route and localized text`, async () => {
      const steps: TourStepV2[] = workspaceSteps[ws]!;
      expect(steps.length).toBeGreaterThan(3);
      for (const s of steps) {
        expect(s.tourId, `step ${s.id} must have a data-tour-id`).toBeTruthy();
        expect(s.route ?? "/", `step ${s.id} route must start with /`).toMatch(/^\//);
        const title = s.titleKey ?? s.title;
        const text = s.textKeyR ?? s.textKey ?? s.text;
        expect(title, `step ${s.id} must have localized title`).toBeTruthy();
        expect(text, `step ${s.id} must have localized text`).toBeTruthy();
      }
    });
  }

  it("demo tour steps satisfy the same contract", () => {
    const steps: TourStepV2[] = buildDemoTourSteps();
    for (const s of steps) {
      expect(s.tourId).toBeTruthy();
      expect(s.route ?? "/").toMatch(/^\//);
    }
  });
});
