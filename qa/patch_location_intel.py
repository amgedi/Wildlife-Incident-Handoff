import io

p = 'src/features/network/NetworkMap.tsx'
s = io.open(p, encoding='utf-8').read()
old_import = 'import { fetchLocationIntel } from "./locationIntel";'
new_import = ('import { resolveGeocodeTarget, reverseGeocode, getExactGeocodeConsent, '
              'setExactGeocodeConsent, getActiveGeocodingProvider, peekGeocodeCache, type GeocodeOutcome } from "./geocoding";\n'
              'import { fuzzCoordinates } from "./mapProvider";')
assert old_import in s
s = s.replace(old_import, new_import)

lines = s.split('\n')
start = None
for i, ln in enumerate(lines):
    if 'Location intelligence for the map inspector' in ln:
        start = i - 1  # the docstring start "/**"
        break
assert start is not None and lines[start].strip() == '/**'
# find closing brace of function LocationIntel: last line that is exactly '}'
# after 'function LocationIntel'
fn = next(i for i, ln in enumerate(lines) if ln.startswith('function LocationIntel'))
end = None
depth = 0
for i in range(fn, len(lines)):
    depth += lines[i].count('{') - lines[i].count('}')
    if depth == 0 and i > fn:
        end = i  # closing brace line
        break
assert end is not None

new_component = '''/**
 * Location intelligence for the map inspector — dev.18 privacy-hardened:
 *  - operational info first (description, landmark, distance/bearing,
 *    accuracy); raw coordinates demoted to a collapsed "Technical details"
 *    section, shown at the incident's own precision (generalized for
 *    approximate, hidden for sensitive);
 *  - SENSITIVE: reverse-geocode is disabled — nothing is ever sent;
 *  - APPROXIMATE: only the ~1 km generalized coordinate is ever sent;
 *  - EXACT: first lookup asks for consent (Continue/Cancel + remember);
 *  - results cached persistently, rate-limited, honest failure messages.
 */
function LocationIntel({ incident, serviceArea }: { incident: Incident; serviceArea: MapServiceArea | null }) {
  const { t } = useTranslation("professional");
  const { latitude, longitude, precision } = incident.location;
  const [intel, setIntel] = useState<{ road?: string; city?: string } | null>(() => {
    if (latitude == null || longitude == null) return null;
    const dec = resolveGeocodeTarget(precision ?? undefined, latitude, longitude, "allowed");
    if (dec.kind !== "ready") return null;
    const hit = peekGeocodeCache(dec.target.lat, dec.target.lon);
    return hit ? { road: hit.road, city: hit.city } : null;
  });
  const [state, setState] = useState<"idle" | "loading" | "ok" | "blocked" | "consent" | "rate_limited" | "no_result" | "failed">(() => {
    if (precision === "sensitive") return "blocked";
    return "idle";
  });
  const [consentTarget, setConsentTarget] = useState<{ lat: number; lon: number } | null>(null);
  const [rememberConsent, setRememberConsent] = useState(false);
  const [showTech, setShowTech] = useState(false);
  const provider = getActiveGeocodingProvider();

  useEffect(() => {
    setIntel(null);
    setConsentTarget(null);
    setState(precision === "sensitive" ? "blocked" : "idle");
  }, [latitude, longitude, precision]);

  const displayPos =
    latitude == null || longitude == null
      ? null
      : precision === "sensitive"
        ? null
        : precision === "approximate"
          ? fuzzCoordinates(latitude, longitude)
          : { lat: latitude, lon: longitude };

  const load = async (consented?: boolean) => {
    if (latitude == null || longitude == null) return;
    const consent = consented ? "allowed" : getExactGeocodeConsent();
    const decision = resolveGeocodeTarget(precision ?? undefined, latitude, longitude, consent);
    if (decision.kind === "blocked") { setState("blocked"); return; }
    if (decision.kind === "consent_required") { setConsentTarget(decision.target); setState("consent"); return; }
    setConsentTarget(null);
    setState("loading");
    const outcome = await reverseGeocode(decision);
    if (outcome.kind === "ok") { setIntel({ road: outcome.result.road, city: outcome.result.city }); setState("ok"); }
    else if (outcome.kind === "no_result") setState("no_result");
    else if (outcome.kind === "rate_limited") setState("rate_limited");
    else setState("failed");
  };

  const acceptConsent = () => {
    if (rememberConsent) setExactGeocodeConsent("allowed");
    setRememberConsent(false);
    void load(true);
  };

  let distanceBearing: string | null = null;
  if (serviceArea?.centerLat != null && serviceArea.centerLon != null && latitude != null && longitude != null) {
    const dLat = (latitude - serviceArea.centerLat) * 110.574;
    const dLon = (longitude - serviceArea.centerLon) * 111.32 * Math.cos((serviceArea.centerLat * Math.PI) / 180);
    const dist = Math.round(Math.sqrt(dLat * dLat + dLon * dLon) * 10) / 10;
    const bearing = (Math.atan2(longitude - serviceArea.centerLon, latitude - serviceArea.centerLat) * 180) / Math.PI;
    distanceBearing = dist + " km " + bearingToCompass(bearing) + " of " + (serviceArea.label ?? "center");
  }

  if (latitude == null || longitude == null) {
    return (
      <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--c-warn)" }}>
        {t("intelNoCoordinates", { defaultValue: "No coordinates recorded — ask the reporter for a location pin." })}
      </p>
    );
  }

  return (
    <div style={{ borderTop: "1px solid var(--c-border)", paddingTop: 6, display: "grid", gap: 4, fontSize: "0.8rem" }}>
      <strong style={{ fontSize: "0.72rem", letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--c-ink-faint)" }}>
        {t("intelTitle", { defaultValue: "Location intel" })}
      </strong>
      {incident.location.description && <span>\\ud83d\\udccd {incident.location.description}</span>}
      {incident.location.landmark && <span>\\ud83e\\udded {incident.location.landmark}</span>}
      {incident.location.address && <span>\\ud83c\\udfe0 {incident.location.address}</span>}
      {distanceBearing && <span>\\ud83d\\udcf0 {distanceBearing}</span>}
      {incident.location.accuracyMeters != null && (
        <span>{t("intelAccuracy", { defaultValue: "GPS accuracy" })} \±{incident.location.accuracyMeters} m</span>
      )}

      {state === "blocked" && (
        <span className="hint" style={{ margin: 0 }}>
          {t("intelBlockedSensitive", { defaultValue: "Nearest-place lookup is disabled for sensitive locations — nothing is sent to third parties." })}
        </span>
      )}

      {state === "consent" && consentTarget && (
        <div role="dialog" aria-label={t("intelConsentTitle", { defaultValue: "Send this location?" })} style={{ border: "1px solid var(--c-border)", borderRadius: "var(--radius-sm)", padding: 8, display: "grid", gap: 6 }}>
          <span>
            {t("intelConsentBody", {
              defaultValue: "Looking up a nearby road/place will send this location to {{provider}}.",
              provider: provider.displayName,
              interpolation: { escapeValue: false },
            })}
          </span>
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: "0.75rem" }}>
            <input type="checkbox" checked={rememberConsent} onChange={(e) => setRememberConsent(e.target.checked)} />
            {t("intelConsentRemember", { defaultValue: "Remember this preference" })}
          </label>
          <div className="row" style={{ gap: 6 }}>
            <button className="btn btn-primary btn-sm" onClick={acceptConsent}>{t("intelConsentContinue", { defaultValue: "Continue" })}</button>
            <button className="btn btn-quiet btn-sm" onClick={() => { setConsentTarget(null); setState("idle"); }}>{t("intelConsentCancel", { defaultValue: "Cancel" })}</button>
          </div>
        </div>
      )}

      {state === "idle" && (
        <button className="btn btn-secondary btn-sm" style={{ alignSelf: "start" }} onClick={() => void load()}>
          {t("intelLookup", { defaultValue: "Look up nearest road/place" })}
        </button>
      )}
      {state === "loading" && <span className="hint" style={{ margin: 0 }}>{t("intelLoading", { defaultValue: "Looking up…" })}</span>}
      {state === "ok" && intel && (
        <span>
          {intel.road && <>\\ud83d\\udee3 {intel.road}</>}
          {intel.road && intel.city ? " · " : ""}
          {intel.city}
          <span className="hint" style={{ display: "block", margin: 0, fontSize: "0.68rem" }}>{provider.attribution}</span>
        </span>
      )}
      {state === "no_result" && (
        <span className="hint" style={{ margin: 0 }}>{t("intelNoResult", { defaultValue: "Nearest named place unavailable. Stored incident location remains unchanged." })}</span>
      )}
      {state === "rate_limited" && (
        <span className="hint" style={{ margin: 0 }}>{t("intelRateLimited", { defaultValue: "Lookup service is busy (rate limit). Try again in a minute." })}</span>
      )}
      {state === "failed" && (
        <span className="hint" style={{ margin: 0, color: "var(--c-warn)" }}>{t("intelFailed", { defaultValue: "Nearest named place unavailable (offline or service down). Stored incident location remains unchanged." })}</span>
      )}

      {/* Technical details — raw coordinates only for exact incidents. */}
      <button
        className="btn btn-quiet btn-sm"
        style={{ alignSelf: "start", padding: "2px 6px" }}
        aria-expanded={showTech}
        onClick={() => setShowTech((v) => !v)}
      >
        {t("intelTechDetails", { defaultValue: "Technical details" })}
      </button>
      {showTech && (
        <span style={{ color: "var(--c-ink-faint)" }}>
          {displayPos ? (
            <code>{displayPos.lat.toFixed(5)}, {displayPos.lon.toFixed(5)}</code>
          ) : (
            t("intelCoordsHidden", { defaultValue: "Exact coordinates hidden for this privacy level." })
          )}
          {precision === "approximate" && (
            <span className="hint" style={{ display: "block", margin: 0, fontSize: "0.68rem" }}>
              {t("intelGeneralizedNote", { defaultValue: "Generalized ~1 km — the stored exact coordinate is never shown or sent." })}
            </span>
          )}
        </span>
      )}
    </div>
  );
}'''

s = '\n'.join(lines[:start]) + '\n' + new_component + '\n' + '\n'.join(lines[end + 1:])
io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('replaced LocationIntel, docstring at line', start + 1, 'fn end', end + 1)
