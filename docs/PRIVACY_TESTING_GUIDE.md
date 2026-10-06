# Privacy Testing Guide

Applies to `0.3.0-rc.2`.

Use fictional data for privacy testing.

## Location privacy levels

Test all location modes with clearly fake incidents.

### Exact

The incident can use the precise coordinate locally. Online map or geocoding features may contact configured external providers when the user chooses those features.

### Approximate

The product should display and share a generalized position rather than exposing the precise incident point through normal map, inspection, or shareable export surfaces.

### Sensitive

The product should avoid exposing a precise point and should disable workflows that would unnecessarily send a sensitive coordinate to a geocoding provider.

## What to test

Create fictional incidents at each privacy level and check:

1. map markers do not reveal a more precise point than the selected privacy level
2. selecting an incident from the map list does not move the camera to a hidden precise location
3. technical details respect the selected privacy level
4. shareable exports do not leak precise coordinates, private contacts, or private notes
5. geocoding actions explain when an external provider may receive location data
6. diagnostics do not include incident coordinates, contacts, credentials, updater keys, or LAN private keys
7. backups are clearly different from shareable exports and are treated as full local data copies

## Network behavior to verify

The current desktop app can make network requests for:

- online map, satellite, and terrain tiles
- geocoding when the user uses a geocoding feature
- GitHub update checks when enabled
- optional paired-device LAN sync

There is no analytics or telemetry service in the current public release.

## Offline check

Disconnect the network and verify that core local incident workflows still work.

Online maps, geocoding, update checks, and LAN communication may be unavailable when their required network path is unavailable. The app should fail clearly and safely instead of losing local incident data.

## Reporting a privacy problem

A privacy leak should be treated as a high-priority bug.

Do not post the leaked real data publicly. Redact the example and follow [SECURITY.md](../SECURITY.md) if the issue exposes information that should have remained private.
