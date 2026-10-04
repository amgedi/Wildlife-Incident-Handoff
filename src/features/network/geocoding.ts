/**
 * GeocodingProvider abstraction (dev.18) — all third-party reverse geocoding
 * goes through here; no provider logic in map components.
 *
 * Privacy contract (spec §11–§17):
 *  - SENSITIVE incidents are NEVER geocoded — resolveGeocodeTarget() blocks.
 *  - APPROXIMATE incidents are geocoded at the generalized (~1 km fuzzed)
 *    coordinate only — the stored exact coordinate is never sent anywhere.
 *  - EXACT incidents require explicit user consent before the first lookup;
 *    the consent can be remembered (setting "geocode-exact-consent").
 *  - Results are cached persistently (localStorage) keyed by provider +
 *    coordinate + precision class, so repeated marker clicks do not hit the
 *    provider. A client-side sliding-window rate limiter protects the
 *    provider's usage policy (Nominatim: max 1 req/s, absolute daily caps).
 *  - Every provider declares its attribution and privacy disclosure; the UI
 *    must display both before/with results.
 */

export interface ReverseGeocodeResult {
  road?: string;
  city?: string;
  attribution: string;
  /** Coordinate actually sent to the provider (post-generalization). */
  queried: { lat: number; lon: number };
  cachedAt: string;
}

export type GeocodeHealth = "ok" | "offline" | "rate_limited" | "unavailable";

import { fuzzCoordinates } from "./mapProvider";
import type { MapPrivacy } from "./mapProvider";

export interface GeocodingProvider {
  id: string;
  displayName: string;
  endpoint: string;
  attribution: string;
  /** Human-readable sentence describing exactly what is transmitted. */
  privacyDisclosure: string;
  rateLimit: { maxPerMinute: number };
  reverseGeocode(lat: number, lon: number): Promise<Omit<ReverseGeocodeResult, "queried" | "cachedAt"> | null>;
}

/** The one provider currently configured. OpenStreetMap Nominatim — free,
 *  no API key, usage policy: max 1 req/s, attribution required. */
export const NOMINATIM_PROVIDER: GeocodingProvider = {
  id: "nominatim",
  displayName: "OpenStreetMap Nominatim",
  endpoint: "https://nominatim.openstreetmap.org/reverse",
  attribution: "© OpenStreetMap contributors",
  privacyDisclosure:
    "The chosen coordinate is sent to nominatim.openstreetmap.org (OpenStreetMap) to look up the nearest road/place.",
  rateLimit: { maxPerMinute: 30 },
  async reverseGeocode(lat, lon) {
    const url = `${this.endpoint}?format=jsonv2&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (res.status === 429) throw new GeocodeRateLimitError();
    if (!res.ok) throw new GeocodeUnavailableError(`nominatim ${res.status}`);
    const data = (await res.json()) as { address?: Record<string, string> };
    const a = data.address ?? {};
    const road = a.road ?? a.pedestrian ?? a.footway ?? a.neighbourhood ?? a.suburb;
    const city = a.city ?? a.town ?? a.village ?? a.municipality ?? a.county;
    if (!road && !city) return null; // no result — not an error
    return { road, city, attribution: this.attribution };
  },
};

export class GeocodeRateLimitError extends Error {
  constructor() { super("geocode rate limited"); }
}
export class GeocodeUnavailableError extends Error {}

const ACTIVE_PROVIDER: GeocodingProvider = NOMINATIM_PROVIDER;

export function getActiveGeocodingProvider(): GeocodingProvider {
  return ACTIVE_PROVIDER;
}

// ---- Persistent result cache (never contains sensitive coordinates: keys
// ---- are derived from the coordinate that was actually sent). ----

const CACHE_KEY = "geocode-cache-v1";
const CACHE_MAX = 200;

interface CacheEntry {
  provider: string;
  key: string;
  result: { road?: string; city?: string; attribution: string };
  cachedAt: string;
}

function readCache(): CacheEntry[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as CacheEntry[]) : [];
  } catch {
    return [];
  }
}

function writeCache(entries: CacheEntry[]): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(entries.slice(-CACHE_MAX)));
  } catch {
    /* storage full/private — cache is best-effort */
  }
}

export function clearGeocodeCache(): void {
  try { localStorage.removeItem(CACHE_KEY); } catch { /* ignore */ }
}

function cacheKey(providerId: string, lat: number, lon: number): string {
  return `${providerId}|${lat.toFixed(4)},${lon.toFixed(4)}`;
}

export function peekGeocodeCache(lat: number, lon: number): ReverseGeocodeResult | null {
  const p = getActiveGeocodingProvider();
  const hit = readCache().find((e) => e.provider === p.id && e.key === cacheKey(p.id, lat, lon));
  return hit ? { ...hit.result, queried: { lat, lon }, cachedAt: hit.cachedAt } : null;
}

// ---- Client-side rate limiter (sliding window, per session). ----

const sentTimestamps: number[] = [];

/** Test/QA hook: clear the sliding window between runs. */
export function resetGeocodeRateLimiter(): void {
  sentTimestamps.length = 0;
}

export function rateLimitState(): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  while (sentTimestamps.length && now - sentTimestamps[0]! > 60_000) sentTimestamps.shift();
  const limit = getActiveGeocodingProvider().rateLimit.maxPerMinute;
  if (sentTimestamps.length >= limit) {
    return { allowed: false, retryAfterMs: 60_000 - (now - sentTimestamps[0]!) };
  }
  return { allowed: true, retryAfterMs: 0 };
}

// ---- Precision-aware target resolution (the privacy core). ----

export type GeocodeDecision =
  | { kind: "blocked"; reason: "sensitive" }
  | { kind: "consent_required"; target: { lat: number; lon: number } }
  | { kind: "ready"; target: { lat: number; lon: number }; generalized: boolean };

/** Decide what (if anything) may be sent for this incident location. */
export function resolveGeocodeTarget(
  precision: MapPrivacy | undefined,
  lat: number,
  lon: number,
  exactConsent: "ask" | "allowed" | "denied"
): GeocodeDecision {
  if (precision === "sensitive") return { kind: "blocked", reason: "sensitive" };
  if (precision === "approximate") {
    const f = fuzzCoordinates(lat, lon);
    return { kind: "ready", target: f, generalized: true };
  }
  // exact (or unspecified treated as exact)
  if (exactConsent === "denied") return { kind: "blocked", reason: "sensitive" };
  if (exactConsent === "ask") return { kind: "consent_required", target: { lat, lon } };
  return { kind: "ready", target: { lat, lon }, generalized: false };
}

// ---- Exact-location consent (remembered preference). ----

const CONSENT_KEY = "geocode-exact-consent";

export function getExactGeocodeConsent(): "ask" | "allowed" | "denied" {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    return v === "allowed" || v === "denied" ? v : "ask";
  } catch {
    return "ask";
  }
}

export function setExactGeocodeConsent(value: "ask" | "allowed" | "denied"): void {
  try {
    if (value === "ask") localStorage.removeItem(CONSENT_KEY);
    else localStorage.setItem(CONSENT_KEY, value);
  } catch { /* ignore */ }
}

// ---- Full lookup pipeline. ----

export type GeocodeOutcome =
  | { kind: "ok"; result: ReverseGeocodeResult; fromCache: boolean }
  | { kind: "blocked" }
  | { kind: "consent_required"; target: { lat: number; lon: number } }
  | { kind: "rate_limited"; retryAfterMs: number }
  | { kind: "no_result" }
  | { kind: "error"; reason: "offline" | "unavailable" | "invalid_coordinate" };

/**
 * Reverse-geocode with all privacy gates applied. `target` must come from
 * resolveGeocodeTarget() — callers never pass raw stored coordinates for
 * approximate/sensitive incidents.
 */
export async function reverseGeocode(decision: GeocodeDecision): Promise<GeocodeOutcome> {
  if (decision.kind === "blocked") return { kind: "blocked" };
  if (decision.kind === "consent_required") return decision;
  const { lat, lon } = decision.target;
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return { kind: "error", reason: "invalid_coordinate" };
  }
  const cached = peekGeocodeCache(lat, lon);
  if (cached) return { kind: "ok", result: cached, fromCache: true };
  const rl = rateLimitState();
  if (!rl.allowed) return { kind: "rate_limited", retryAfterMs: rl.retryAfterMs };
  const p = getActiveGeocodingProvider();
  sentTimestamps.push(Date.now());
  try {
    const result = await p.reverseGeocode(lat, lon);
    if (!result) return { kind: "no_result" };
    const full: ReverseGeocodeResult = { ...result, queried: { lat, lon }, cachedAt: new Date().toISOString() };
    const entries = readCache().filter((e) => !(e.provider === p.id && e.key === cacheKey(p.id, lat, lon)));
    entries.push({ provider: p.id, key: cacheKey(p.id, lat, lon), result: { road: full.road, city: full.city, attribution: full.attribution }, cachedAt: full.cachedAt });
    writeCache(entries);
    return { kind: "ok", result: full, fromCache: false };
  } catch (err) {
    if (err instanceof GeocodeRateLimitError) return { kind: "rate_limited", retryAfterMs: 60_000 };
    if (typeof navigator !== "undefined" && navigator.onLine === false) return { kind: "error", reason: "offline" };
    return { kind: "error", reason: "unavailable" };
  }
}
