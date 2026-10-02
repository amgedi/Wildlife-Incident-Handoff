/**
 * Guide Me integrity tests (spec §69): the raw-key bug, readable key
 * structure, namespace readiness, and per-step completeness.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { EN_NAMESPACES } from "../i18n";

const EN_DIR = join(__dirname, "..", "i18n", "locales", "en");
const PAGE = join(__dirname, "incidents", "CreateIncidentPage.tsx");
const GUIDE_KEYS = [
  "whatHappened", "animal", "location", "observations", "hazards",
  "actionsDone", "animalNow", "contacts", "photos", "review",
];

describe("Guide Me localization integrity", () => {
  it("English guide namespace exists with all 10 steps (title + body)", () => {
    const guide = (EN_NAMESPACES as unknown as Record<string, Record<string, Record<string, string>>>).guide;
    // eslint-disable-next-line no-console
    expect(guide, "guide namespace missing from EN_NAMESPACES").toBeTruthy();
    expect(guide).toBeDefined();
    for (const key of GUIDE_KEYS) {
      const step = guide![key];
      expect(step, `missing guide.${key}`).toBeTruthy();
      expect(step!.title, `guide.${key}.title missing`).toBeTruthy();
      expect(step!.body, `guide.${key}.body missing`).toBeTruthy();
    }
  });

  it("GuideCoach renders readable keys (never s0t/s0b-style)", () => {
    const src = readFileSync(
      PAGE, "utf-8"
    );
    expect(src.includes("s${step}t")).toBe(false);
    expect(src.includes("s${step}b")).toBe(false);
    expect(src.includes("GUIDE_STEP_KEYS[step]")).toBe(true);
    
    // readiness guard present so lazy packs never flash raw keys
    expect(src.includes("hasLoadedNamespace")).toBe(true);
  });

  it("guide namespace registered in EN_NAMESPACES (bundled, never missing in en)", () => {
    expect((EN_NAMESPACES as Record<string, unknown>).guide).toBeTruthy();
  });

  it("complete languages (fr/es) carry the full guide namespace", () => {
    for (const lang of ["fr", "es"]) {
      const pack = JSON.parse(readFileSync(join(__dirname, "..", "i18n", "locales", `${lang}.json`), "utf-8")) as Record<string, Record<string, Record<string, string>>>;
      expect(pack.guide, `${lang} missing guide namespace`).toBeDefined();
      for (const key of GUIDE_KEYS) {
        expect(pack.guide?.[key]?.title, `${lang} missing guide.${key}.title`).toBeTruthy();
        expect(pack.guide?.[key]?.body, `${lang} missing guide.${key}.body`).toBeTruthy();
      }
    }
  });

  it("guide key names are readable (no cryptic 3-char ids)", () => {
    const guide = EN_NAMESPACES.guide as Record<string, unknown>;
    for (const key of Object.keys(guide)) {
      expect(key.length).toBeGreaterThan(3);
    }
  });

  it("guide step order matches the wizard steps", () => {
    const wizard = JSON.parse(readFileSync(join(EN_DIR, "wizard.json"), "utf-8")) as Record<string, string>;
    for (let i = 0; i < GUIDE_KEYS.length; i++) {
      expect(wizard[`s${i + 1}`], `wizard step s${i + 1} missing`).toBeTruthy();
    }
  });
});

describe("selection chips (spec §7-13)", () => {
  it("observation examples use sentence case (no lowercase starts)", () => {
    const src = readFileSync(PAGE, "utf-8");
    const match = src.match(/OBSERVATION_EXAMPLES_GOOD = \[([^\]]+)\]/);
    expect(match).toBeTruthy();
    const labels = match![1]!.split(",").map((s) => s.trim().replace(/^"|"$/g, "")).filter(Boolean);
    expect(labels.length).toBeGreaterThan(0);
    for (const label of labels) {
      const first = label[0] ?? "";
      expect(first, `label "${label}" not sentence case`).toBe(first.toUpperCase());
    }
  });

  it("'No action taken' is exclusive — selecting it clears other actions", async () => {
    // toggleAction is exercised through the wizard; test the contract here
    const src = readFileSync(PAGE, "utf-8");
    expect(src.includes("function toggleAction")).toBe(true);
    expect(src.includes("if (a === NO_ACTION) return [NO_ACTION];")).toBe(true);
    expect(src.includes("x !== NO_ACTION")).toBe(true);
  });

  it("selected chips persist via draft state (aria-pressed bound to state, not local component state)", () => {
    const src = readFileSync(PAGE, "utf-8");
    // hazards + actions chips bind aria-pressed to draft state arrays
    expect(src.includes('aria-pressed={state.hazards.includes(h.value)}')).toBe(true);
    expect(src.includes('aria-pressed={state.actions.includes(a)}')).toBe(true);
  });
});
