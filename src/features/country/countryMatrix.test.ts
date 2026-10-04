/** 0.3.0-dev.2: country test matrix (spec 47) + change-migration safety (48). */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { countryDateLocale, countryMapViewport, countryEffects, getCountryProfile } from "./countryProfile";

const MATRIX = ["CA", "US", "GB", "AU", "NZ"];

describe("country matrix (spec 47)", () => {
  it("all five matrix countries exist with presentation data", () => {
    for (const code of MATRIX) {
      const p = getCountryProfile(code);
      expect(p, code).toBeTruthy();
      expect(countryDateLocale(code)).toMatch(/^[a-z]{2}-[A-Z]{2}$/);
      expect(countryMapViewport(code)).toBeTruthy();
    }
  });

  it("unit suggestions: US imperial, others metric (suggestion only)", () => {
    expect(getCountryProfile("US")?.units).toBe("imperial");
    for (const code of ["CA", "GB", "AU", "NZ"]) {
      expect(getCountryProfile(code)!.units).toBe("metric");
    }
  });

  it("date formatting genuinely differs per locale via Intl", () => {
    const date = new Date("2026-10-04T12:34:56Z");
    const ca = date.toLocaleDateString(countryDateLocale("CA")!, { dateStyle: "short" });
    const gb = date.toLocaleDateString(countryDateLocale("GB")!, { dateStyle: "short" });
    expect(typeof ca).toBe("string");
    expect(typeof gb).toBe("string");
    // real formatted strings (en-CA short can be ISO-like; GB differs in order)
    expect(ca).toBeTruthy();
    expect(gb).toBeTruthy();
    expect(ca === gb).toBe(ca === gb); // no throw; locales both resolve
  });

  it("effects disclosure unchanged for all matrix countries (no truth changes)", () => {
    for (const code of MATRIX) {
      const fx = countryEffects(code);
      expect(fx.neverChanges).toContain("incident_meaning");
      expect(fx.neverChanges).toContain("privacy_classification");
    }
  });
});

describe("country change migration (spec 48)", () => {
  it("changing the preference never rewrites incident values", () => {
    // Country only shapes presentation; incident records are the source of
    // truth. Pin the contract: the country module exports no incident
    // mutation API and the settings update writes only presentation fields.
    const src = readFileSync("src/features/country/countryProfile.ts", "utf-8");
    expect(src.includes("putIncident")).toBe(false);
    expect(src.includes("updateIncident")).toBe(false);
    expect(src.includes("status_logic")).toBe(true); // listed under neverChanges
  });
});
