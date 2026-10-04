/**
 * dev.18 — professional verification honesty (spec §6–§8).
 * There is NO connected verification service: the UI must never say
 * "submitted", "pending review" or "verified", and evidence notes must stay
 * local-only (never in backups, sync, exports, or diagnostics).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import enSettings from "../i18n/locales/en/settings.json";
import enGuidance from "../i18n/locales/en/guidance.json";

const roleCard = readFileSync(join(__dirname, "settings", "RoleCard.tsx"), "utf-8");

describe("dev.18 professional verification honesty", () => {
  it("RoleCard never uses submission/pending-review/verified wording", () => {
    const banned = /submit(ed| for review)?\s+verification|verification submitted|pending (organization )?review/i;
    // the ONLY allowed occurrences are in honest negatives ("not submitted",
    // "Connected verification is not available yet"), so require that every
    // mention of submit/review appears negated in the same string literal.
    // strip comments — the honesty check applies to real UI strings only
    const code = roleCard.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    const literals = code.match(/"[^"\n]*"/g) ?? [];
    for (const lit of literals) {
      if (banned.test(lit)) {
        expect(/not submitted|nothing was sent|no reviewer/i.test(lit), `honest negation required in: ${lit}`).toBe(true);
      }
    }
    expect(roleCard).toContain("not available yet");
  });

  it("English strings use honest preparation wording", () => {
    expect(enSettings.verifPreparedLocal).toMatch(/prepared locally — not submitted/i);
    expect(enSettings.verifSaveLocalBtn).toMatch(/on this device/i);
    expect(enSettings.verifSavedLocalToast).toMatch(/nothing was sent/i);
    expect(enSettings.verifBlurbHonest).toMatch(/not available yet/i);
    expect(enSettings.verifBlurbHonest).toMatch(/never copied, sent/i);
  });

  it("the word 'Verified' is not a badge the verification flow can produce", () => {
    expect(enSettings.verifPreparedLocal).not.toMatch(/verified/i);
  });

  it("guidance tour texts stay free of verification claims", () => {
    for (const [k, v] of Object.entries(enGuidance)) {
      if (typeof v === "string") {
        expect(v.toLowerCase(), k).not.toContain("verification submitted");
      }
    }
  });
});
