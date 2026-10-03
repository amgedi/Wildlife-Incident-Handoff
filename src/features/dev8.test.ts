/** 0.2.0-dev.8 tests: languages/pseudo-locale, role architecture, map
 *  clustering + service-area fit, pipeline/delta analytics, help isolation,
 *  mobile scroll fix, dashboard structure. */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  selectableLanguages, PSEUDO_LOCALE, languageDir, changeLanguage, i18n,
} from "../i18n";
import {
  PROFESSIONAL_ROLES, ROLE_CAPABILITIES, ROLE_VERIFICATION_REQUIREMENTS,
  capabilitiesForRoles, getAuthorizationState, isVerifiedResponder,
  type ProfessionalRoleEntry,
} from "../features/network/authorization";
import { clusterPoints, getMapDiagnostics, type MapPoint } from "../features/network/mapProvider";
import { getPipelineCounts, getCountWithDelta } from "../features/network/incidentAnalytics";
import type { Incident } from "../types/incident";

const root = "C:/Users/jiggy/Desktop/Wildlife Incident Handoff";

// ---------- P20–P26: languages ----------

describe("language picker integrity", () => {
  it("normal users only see languages with complete interface coverage", () => {
    const selectable = selectableLanguages(false);
    // 0.2.0-dev.10: de and pt-BR packs were authored to full coverage.
    expect(selectable.map((l) => l.code)).toEqual(["en", "fr", "es", "de", "pt-BR"]);
  });
  it("developer preview exposes incomplete locales + pseudo-locale", () => {
    const all = selectableLanguages(true);
    expect(all.length).toBe(14); // 13 catalog + zz-ZZ
    expect(all.some((l) => l.code === PSEUDO_LOCALE)).toBe(true);
  });
  it("RTL flag for Arabic", () => {
    expect(languageDir("ar")).toBe("rtl");
    expect(languageDir("en")).toBe("ltr");
  });
  it("pseudo-locale expands strings so hard-coded/clipped UI is visible", async () => {
    await changeLanguage(PSEUDO_LOCALE);
    const expanded = i18n.t("common:appName");
    expect(expanded).toContain("[!!!");
    await changeLanguage("en");
    expect(i18n.t("common:appName")).not.toContain("[!!!");
  });
});

// ---------- P8–P12: roles ----------

describe("professional role architecture", () => {
  it("authorization remains hard-unverified (no local elevation path)", () => {
    expect(getAuthorizationState().status).toBe("unverified");
    expect(getAuthorizationState().claimsSource).toBe("none");
    expect(isVerifiedResponder()).toBe(false);
  });
  it("every role has capabilities and a verification requirement", () => {
    for (const role of PROFESSIONAL_ROLES) {
      expect(ROLE_CAPABILITIES[role]!.length).toBeGreaterThan(0);
      expect(ROLE_VERIFICATION_REQUIREMENTS[role]!.length).toBeGreaterThan(0);
    }
  });
  it("preview roles grant NO capabilities; only verified roles do", () => {
    const preview: ProfessionalRoleEntry[] = [{ role: "rehabilitator", state: "preview", addedAt: "2026-10-03T00:00:00Z" }];
    expect(capabilitiesForRoles(preview)).toEqual([]);
    const verified: ProfessionalRoleEntry[] = [{ role: "rehabilitator", state: "verified", addedAt: "2026-10-03T00:00:00Z" }];
    expect(capabilitiesForRoles(verified)).toContain("handoff.accept");
  });
  it("capability matrix document exists", () => {
    const doc = readFileSync(join(root, "docs/ROLE_CAPABILITY_MATRIX.md"), "utf-8");
    expect(doc).toContain("Connected permission");
    expect(doc).toContain("server-side only");
  });
});

// ---------- P31/P34/P35: map ----------

function pt(lat: number, lon: number): MapPoint {
  return { lat, lon, state: "new", label: "test" };
}

describe("map clustering + service-area camera", () => {
  const bounds = { north: 51.2, south: 50.8, east: -113.8, west: -114.2 };
  it("clusters many points at wide zoom", () => {
    const points = Array.from({ length: 40 }, (_, i) => pt(50.9 + (i % 5) * 0.01, -114.0 + Math.floor(i / 5) * 0.01));
    const clusters = clusterPoints(points, 5, bounds);
    expect(clusters.length).toBeGreaterThan(0);
    expect(clusters.length).toBeLessThan(points.length / 2);
    const total = clusters.reduce((s, c) => s + c.count, 0);
    expect(total).toBe(points.length);
  });
  it("does not cluster when zoomed in", () => {
    const points = Array.from({ length: 40 }, (_, i) => pt(50.9 + (i % 5) * 0.01, -114.0 + Math.floor(i / 5) * 0.01));
    expect(clusterPoints(points, 11, bounds)).toEqual([]);
  });
  it("diagnostics never contain coordinates", () => {
    const d = getMapDiagnostics();
    if (d.lastErrorMessage) {
      expect(d.lastErrorMessage).not.toMatch(/\d{2,3}\.\d{3,}/);
    }
  });
});

// ---------- P46/P45: pipeline + deltas ----------

function incident(status: Incident["status"], createdAt: string): Incident {
  return {
    id: `inc-${status}-${createdAt}`,
    humanReference: "WIH-2026-000001",
    schemaVersion: 2,
    createdAt,
    updatedAt: createdAt,
    status,
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
  } as Incident;
}

describe("response flow pipeline", () => {
  it("counts each operational stage from statuses", () => {
    const list = [
      incident("reported", "2026-10-03T10:00:00Z"),
      incident("response_requested", "2026-10-03T10:00:00Z"),
      incident("responder_assigned", "2026-10-03T10:00:00Z"),
      incident("in_transport", "2026-10-03T10:00:00Z"),
      incident("released", "2026-10-03T10:00:00Z"),
    ];
    const stages = getPipelineCounts(list);
    const byKey = Object.fromEntries(stages.map((s) => [s.key, s.count]));
    expect(byKey["reported"]).toBe(2);
    expect(byKey["assigned"]).toBe(1);
    expect(byKey["enroute"]).toBe(1);
    expect(byKey["closed"]).toBe(1);
  });
  it("KPI delta is null when the previous period has no data (never invented)", () => {
    const now = new Date(2026, 9, 3, 12, 0);
    const recent = incident("reported", "2026-10-02T10:00:00Z");
    expect(getCountWithDelta([recent], 7, now).delta).toBeNull();
    const older = incident("reported", "2026-09-20T10:00:00Z");
    const r = getCountWithDelta([older, recent], 7, now);
    expect(r.value).toBe(1);
    expect(r.delta).toBe(0); // 1 current vs 1 previous
  });
});

// ---------- P13: help isolation ----------

describe("help isolation", () => {
  it("HelpPage source keeps professional articles out of the reporter list", () => {
    const src = readFileSync(join(root, "src/features/help/HelpPage.tsx"), "utf-8");
    const reporterBlock = src.slice(src.indexOf("REPORTER_ARTICLES"), src.indexOf("PROFESSIONAL_ARTICLES"));
    expect(reporterBlock).not.toContain('id: "p-');
    // Professionals may switch tabs; reporters cannot (no tab switcher for them).
    expect(src).toContain("canSwitch = isPro");
  });
});

// ---------- P6: mobile scroll root cause stays fixed ----------

describe("mobile scroll fix", () => {
  it("mobile media query never switches the shell to display:block (scroll owner must stay bounded)", () => {
    const css = readFileSync(join(root, "src/styles/base.css"), "utf-8");
    const mobileBlock = css.slice(css.indexOf("@media (max-width: 860px)"), css.indexOf("body.drawer-open"));
    expect(mobileBlock).not.toMatch(/\.app-shell\s*{[^}]*display:\s*block/);
    expect(css).toContain("ONE page scroll owner");
  });
  it("sidebar becomes an off-canvas drawer at small widths", () => {
    const css = readFileSync(join(root, "src/styles/base.css"), "utf-8");
    const mobileBlock = css.slice(css.indexOf("@media (max-width: 860px)"), css.indexOf("body.drawer-open"));
    expect(mobileBlock).toContain("transform: translateX(-102%)");
  });
});

describe("settings role persistence shape", () => {
  it("default settings ship no roles and no active role", async () => {
    const { DEFAULT_SETTINGS } = await import("../types/settings");
    expect(DEFAULT_SETTINGS.professionalRoles).toEqual([]);
    expect(DEFAULT_SETTINGS.activeProfessionalRole).toBeNull();
    expect(DEFAULT_SETTINGS.devPreviewLocales).toBe(false);
  });
});
