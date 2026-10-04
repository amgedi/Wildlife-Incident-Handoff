/** CountryProfile behavior tests (0.3, spec items 62–67). */
import { describe, it, expect } from "vitest";
import {
  COUNTRY_CATALOG,
  COUNTRY_LIST,
  countryDateLocale,
  countryEffects,
  countryMapViewport,
  getCountryProfile,
} from "./countryProfile";

describe("country profile", () => {
  it("catalog entries carry presentation + default-map data only", () => {
    for (const entry of Object.values(COUNTRY_CATALOG)) {
      expect(entry.locale).toMatch(/^[a-z]{2}(-[A-Za-z0-9]+)?(-[A-Z]{2})?$/);
      expect(["metric", "imperial"]).toContain(entry.units);
      expect(entry.map.lat).toBeGreaterThanOrEqual(-90);
      expect(entry.map.lat).toBeLessThanOrEqual(90);
      expect(entry.map.lon).toBeGreaterThanOrEqual(-180);
      expect(entry.map.lon).toBeLessThanOrEqual(180);
      expect(entry.languages.length).toBeGreaterThan(0);
    }
  });

  it("lookup is case-insensitive and safe for empty/unknown values", () => {
    expect(getCountryProfile("ca")?.code).toBe("CA");
    expect(getCountryProfile("")).toBeNull();
    expect(getCountryProfile(null)).toBeNull();
    expect(getCountryProfile("XX")).toBeNull();
  });

  it("date locale maps to the country's Intl locale; null means app default", () => {
    expect(countryDateLocale("DE")).toBe("de-DE");
    expect(countryDateLocale("BR")).toBe("pt-BR");
    expect(countryDateLocale("")).toBeNull();
  });

  it("country default map viewport exists but is explicitly secondary to the service area", () => {
    const vp = countryMapViewport("CA");
    expect(vp).toEqual({ lat: 56.1, lon: -106.3, zoom: 3 });
    expect(countryMapViewport("OTHER")).toBeNull();
  });

  it("effects disclosure is honest: presentation + defaults, never truth", () => {
    const fx = countryEffects("US");
    expect(fx.changes).toContain("date_time_formatting");
    expect(fx.changes).toContain("phone_guidance");
    expect(fx.changes).toContain("default_map_context");
    expect(fx.neverChanges).toEqual(
      expect.arrayContaining(["incident_meaning", "animal_classification", "safety_logic", "status_logic", "privacy_classification"])
    );
  });

  it("picker list is sorted and unique", () => {
    const names = COUNTRY_LIST.map((c) => c.name);
    expect([...names].sort()).toEqual(names);
    expect(new Set(COUNTRY_LIST.map((c) => c.code)).size).toBe(COUNTRY_LIST.length);
  });

  it("units suggestion matches the country entry (selection-time only)", () => {
    expect(getCountryProfile("US")?.units).toBe("imperial");
    expect(getCountryProfile("GB")?.units).toBe("metric");
  });
});
