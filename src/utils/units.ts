/** Region defaults and distance display helpers. */
export function defaultUnitsFor(country: string): "metric" | "imperial" {
  return country === "US" ? "imperial" : "metric";
}

export function formatDistance(km: number, units: "metric" | "imperial"): string {
  if (units === "imperial") {
    const mi = km * 0.621371;
    return `${mi >= 10 ? Math.round(mi) : mi.toFixed(1)} mi`;
  }
  return `${km >= 10 ? Math.round(km) : km.toFixed(1)} km`;
}

/** Great-circle distance in kilometres. */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
