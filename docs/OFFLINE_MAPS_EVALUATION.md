# Offline maps — evaluation and decision (dev.18)

Status: **evaluated; regional offline pack deferred** to a future dev build.
This document records the decision so it is not silently re-litigated.

## What exists today (verified in dev.18)

- Online basemaps: MapLibre with satellite (default) and street styles.
- **Automatic fallback**: when tiles/providers fail, the map degrades to an
  honest offline position view (device-rendered list of incidents with
  privacy-respecting marker positions, service-area note, retry control) —
  there is never a blank map pretending to work. Covered by map failure
  analysis in `docs/MAP_FAILURE_ANALYSIS.md`.
- Offline toggle in Settings (`mapTilesEnabled === false`) forces the
  offline view explicitly.

## Decision: PMTiles regional packs — deferred, not rejected

The right long-term direction remains **PMTiles** (single-file, HTTP
range-request friendly, MapLibre-native) covering the configured service
area + buffer, with the planned UX from the spec (Settings → Map → Offline
maps: coverage, estimated download, Download / Update / Delete, "Available
offline").

Why deferred in dev.18:

1. A trustworthy pack pipeline (build, host, checksum, version, update) is
   release-infrastructure work, not a UI toggle; shipping a half-working
   download would fail the "would I trust this with real data?" bar.
2. Automatic tile caching of public OSM rasters is explicitly rejected —
   it violates OSM/OSM-FR usage policy at app scale and produces stale,
   unversioned data.
3. The existing offline fallback already keeps the field workflow usable
   (markers, statuses, list) without any download.

## Requirements when implemented (contract)

- Pack content covers the configured service area + buffer, zooms ~5–15.
- Integrity: SHA-256 in a manifest; verified before activation; a failed
  download never replaces the previous pack.
- Map mode control: Automatic (online when reachable, offline pack when not)
  / Online / Offline — "no blank map" invariant holds in all three.
- License/attribution surfaced for the pack's data sources.

## dev.19 decision: STILL DEFERRED (with reason)

Re-evaluated during 0.2.0-dev.19, which is the final hardening pass before a
release candidate. Deferred again because:

1. The pass's release-blocking budget was consumed by the LAN sync security
   rewrite (encrypted transport, cryptographic identity, pairing) — the spec
   ranks unauthenticated LAN data access as a hard blocker; offline maps does
   not block an RC.
2. A PMTiles pipeline (source selection with distribution rights, pack
   build/host/checksum/version/update infrastructure) remains feature-scale
   work and would ship untested if rushed alongside the security rewrite.
3. The "no blank map" invariant is already covered by the existing graceful
   offline fallback; the field workflow stays usable without a pack.

RC impact: recorded as DEFERRED in docs/archive/0.3/V020_RELEASE_READINESS.md, not as a
PASS. The contract above is unchanged and remains the acceptance criteria for
a future pass.
