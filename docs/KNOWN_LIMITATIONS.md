# KNOWN LIMITATIONS — 0.3.0-rc.1

This is a release candidate for external testing. It is not the finished
product. The limitations below are current as of this build.

## Safety first

- **Use fictional / non-critical test data.** Do not use active emergency
  data, sensitive protected-species coordinates, personally sensitive
  information, or critical operational records with this release candidate.

## Platform & trust

- **Unsigned release candidate.** The installer and standalone EXE are not
  code-signed (no certificate). Windows SmartScreen may show a warning;
  see TESTER_README.md for what to expect.
- **No signed auto-update.** There is no in-app update installer in this
  release. Updates will be distributed as new downloads. The app never
  silently installs binaries.

## Features deferred to a later release

- LAN media transfer (photos/videos over LAN sync) — sync currently covers
  incident records, not media blobs.
- Encrypted backups (backups are integrity-manifested but not encrypted).
- Offline downloadable map packs (the offline basemap is a device-rendered
  vector view, not full offline street tiles).
- Profile transfer between devices.
- Connected external professional verification — role evidence is prepared
  locally and is clearly labeled "not externally verified".
- Elevation profile tool.
- Some translations are incomplete or preview quality (English is complete).

## Environment requirements

- Terrain 3D, Satellite view and online street basemaps require an internet
  connection. The incident list, records, backups and exports work fully
  offline.
- Map tiles are © OpenStreetMap contributors; attribution is shown on the map.

## Manual validation items pending (honestly not yet done)

- Real screen-reader (NVDA) pass against the packaged EXE.
- Real Windows display-scaling (125% / 150%) pass on external hardware.
- Two-physical-machine LAN acceptance (automated crypto/replay/pairing tests
  pass; two-machine field test pending).
