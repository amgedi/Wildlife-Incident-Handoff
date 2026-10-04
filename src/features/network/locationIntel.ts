/**
 * Location intelligence helper (dev.17): reverse-geocode a coordinate via
 * Nominatim (OpenStreetMap) on explicit user action. One request per lookup,
 * cached in memory, attributed in the UI. Never called automatically.
 */
const cache = new Map<string, { road?: string; city?: string }>();

export async function fetchLocationIntel(lat: number, lon: number): Promise<{ road?: string; city?: string }> {
  const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`nominatim ${res.status}`);
  const data = (await res.json()) as { address?: Record<string, string> };
  const a = data.address ?? {};
  const intel = {
    road: a.road ?? a.pedestrian ?? a.footway ?? a.neighbourhood ?? a.suburb,
    city: a.city ?? a.town ?? a.village ?? a.municipality ?? a.county,
  };
  cache.set(key, intel);
  return intel;
}
