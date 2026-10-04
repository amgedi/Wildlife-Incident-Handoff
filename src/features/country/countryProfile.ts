/**
 * CountryProfile (0.3, spec items 62–67) — a proper architecture for what
 * the country/region selection may and may not influence.
 *
 * HARD RULE (spec 64): the country NEVER changes scientific or operational
 * truth — incident meaning, animal classification, safety logic, status
 * logic, or privacy classification. It only shapes PRESENTATION and DEFAULTS:
 *   - date/time presentation (Intl locale tag)
 *   - default map viewport (only when no service area exists — the service
 *     area always wins)
 *   - phone guidance (parsing hint + example, never rejecting valid
 *     international numbers)
 *   - unit defaults (suggestions at selection time only, user can override)
 *   - language suggestions (onboarding ordering)
 *   - regional resource-directory context (future, honest)
 */

export interface CountryEntry {
  code: string;
  name: string;
  /** BCP-47 locale for date/time/number presentation. */
  locale: string;
  /** Suggested unit system at selection time (user may override). */
  units: "metric" | "imperial";
  /** Default map viewport used ONLY when no service area exists. */
  map: { lat: number; lon: number; zoom: number };
  /** Suggested interface languages (ISO codes). */
  languages: string[];
}

export const COUNTRY_CATALOG: Record<string, CountryEntry> = {
  CA: { code: "CA", name: "Canada", locale: "en-CA", units: "metric", map: { lat: 56.1, lon: -106.3, zoom: 3 }, languages: ["en", "fr"] },
  US: { code: "US", name: "United States", locale: "en-US", units: "imperial", map: { lat: 39.8, lon: -98.6, zoom: 3 }, languages: ["en"] },
  GB: { code: "GB", name: "United Kingdom", locale: "en-GB", units: "metric", map: { lat: 54.0, lon: -2.5, zoom: 5 }, languages: ["en"] },
  AU: { code: "AU", name: "Australia", locale: "en-AU", units: "metric", map: { lat: -25.3, lon: 133.8, zoom: 3 }, languages: ["en"] },
  NZ: { code: "NZ", name: "New Zealand", locale: "en-NZ", units: "metric", map: { lat: -41.5, lon: 172.8, zoom: 4 }, languages: ["en"] },
  IE: { code: "IE", name: "Ireland", locale: "en-IE", units: "metric", map: { lat: 53.3, lon: -8.0, zoom: 6 }, languages: ["en"] },
  FR: { code: "FR", name: "France", locale: "fr-FR", units: "metric", map: { lat: 46.6, lon: 2.4, zoom: 5 }, languages: ["fr"] },
  DE: { code: "DE", name: "Germany", locale: "de-DE", units: "metric", map: { lat: 51.1, lon: 10.4, zoom: 5 }, languages: ["de"] },
  NL: { code: "NL", name: "Netherlands", locale: "nl-NL", units: "metric", map: { lat: 52.2, lon: 5.5, zoom: 6 }, languages: ["de", "en"] },
  ES: { code: "ES", name: "Spain", locale: "es-ES", units: "metric", map: { lat: 40.2, lon: -3.7, zoom: 5 }, languages: ["es"] },
  IT: { code: "IT", name: "Italy", locale: "it-IT", units: "metric", map: { lat: 42.8, lon: 12.6, zoom: 5 }, languages: ["it", "en"] },
  BR: { code: "BR", name: "Brazil", locale: "pt-BR", units: "metric", map: { lat: -12.5, lon: -50.0, zoom: 3 }, languages: ["pt-BR"] },
  MX: { code: "MX", name: "Mexico", locale: "es-MX", units: "metric", map: { lat: 23.6, lon: -102.5, zoom: 4 }, languages: ["es"] },
  ZA: { code: "ZA", name: "South Africa", locale: "en-ZA", units: "metric", map: { lat: -30.6, lon: 22.9, zoom: 4 }, languages: ["en"] },
  IN: { code: "IN", name: "India", locale: "en-IN", units: "metric", map: { lat: 21.0, lon: 78.0, zoom: 3 }, languages: ["en"] },
  JP: { code: "JP", name: "Japan", locale: "ja-JP", units: "metric", map: { lat: 36.2, lon: 138.2, zoom: 4 }, languages: ["en"] },
};

export type CountryEffects = {
  /** What the selection changes — shown honestly in Settings. */
  changes: string[];
  /** What it never changes. */
  neverChanges: string[];
};

export function getCountryProfile(code: string | null | undefined): CountryEntry | null {
  const c = (code ?? "").toUpperCase();
  return COUNTRY_CATALOG[c] ?? null;
}

/** Intl locale tag for date/time presentation; null = app default. */
export function countryDateLocale(code: string | null | undefined): string | null {
  return getCountryProfile(code)?.locale ?? null;
}

/** Default map viewport — callers MUST prefer the saved service area. */
export function countryMapViewport(code: string | null | undefined): { lat: number; lon: number; zoom: number } | null {
  return getCountryProfile(code)?.map ?? null;
}

/** Deterministic, honest description of what the country selection affects. */
export function countryEffects(code: string | null | undefined): CountryEffects {
  const profile = getCountryProfile(code);
  return {
    changes: [
      "date_time_formatting",
      "phone_guidance",
      "default_map_context",
      ...(profile ? ["unit_suggestion", "language_suggestion"] : []),
    ],
    neverChanges: [
      "incident_meaning",
      "animal_classification",
      "safety_logic",
      "status_logic",
      "privacy_classification",
    ],
  };
}

/** Full display list for pickers (sorted by name). */
export const COUNTRY_LIST: CountryEntry[] = Object.values(COUNTRY_CATALOG).sort((a, b) =>
  a.name.localeCompare(b.name)
);
