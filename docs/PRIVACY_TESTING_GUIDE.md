# PRIVACY TESTING GUIDE — 0.3.0-rc.1

Wildlife Incident Handoff is local-first: records stay on your device unless
YOU deliberately use a feature that shares them. This guide explains what to
test and what to expect.

## Location privacy levels

Every incident has a location precision:

- **Exact** — the real coordinate is used on your device.
- **Approximate** — the map shows a ~1 km generalized position; the stored
  exact coordinate is never shown or sent.
- **Sensitive** — no precise point at all: area/generalized display only, and
  nearest-place lookups are disabled entirely (nothing is sent to any
  geocoder).

## What to test (Scenario 4)

Create three fictional records, one at each precision, then check:

1. **Map markers** — approximate/sensitive incidents must never show a
   pinpoint at the real location.
2. **Map list fly-to** — clicking a list row moves the camera to the SAME
   generalized position as the marker; the camera never reveals a hidden
   coordinate.
3. **Inspector** — "Technical details" hides exact coordinates for
   approximate; sensitive never offers a nearest-place lookup.
4. **Exports** — exported files respect the same precision.
5. **Geocoder consent** — for an Exact incident, "Look up nearest road/place"
   asks for consent first and names the provider; Approximate only ever sends
   the generalized point; Sensitive offers no lookup at all.
6. **Diagnostics** — Settings → About diagnostics contain version/build info
   only: no coordinates, no keys, no contacts.

## Network features that touch the internet (and only these)

- **Map tiles** (OpenStreetMap / satellite / terrain) — tile requests go out
  when an online basemap is visible. The offline basemap makes zero tile
  requests.
- **Reverse geocoding** — only on your explicit action, only per the rules
  above, with consent for exact coordinates.
- **LAN sync** — only between devices you have explicitly paired, encrypted,
  with fingerprint approval. Nothing ever goes to a cloud server. There is no
  telemetry.

## If you are worried

The fastest honesty check: turn on the offline basemap (Settings → Map) and
use airplane mode — every non-map feature still works, and nothing is sent.

Report any behavior that contradicts this guide as a **high-priority bug**
(see FEEDBACK_GUIDE.md).
