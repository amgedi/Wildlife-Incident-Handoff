<div align="center">

<img src="branding/wildlife-incident-handoff-emblem.png" alt="Wildlife Incident Handoff, bear-paw emblem over a mountain forest" width="160">

# Wildlife Incident Handoff

**Clear information. Safer handoffs.**

An open-source, local-first desktop app for recording wildlife incidents, built so context survives the trip from reporter to responder to rehabilitator.

> Record what was observed. Keep uncertainty visible. Don't invent what isn't known.

**Current release: 0.3.0-rc.2 (release candidate, Tester channel).** Grab the installer, portable build or launcher from [Releases](https://github.com/amgedi/Wildlife-Incident-Handoff/releases). Test with fictional data first, and check [KNOWN_LIMITATIONS.md](docs/KNOWN_LIMITATIONS.md) before you start.

[![Version](https://img.shields.io/badge/version-0.3.0--rc.2-green)](CHANGELOG.md)
[![License: AGPL-3.0-only](https://img.shields.io/badge/License-AGPL--3.0--only-blue)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-647%20passing-brightgreen)](#development)

</div>

---

Here's the problem this app exists for: someone finds an injured animal, and the important details scatter across phone calls, texts, photos, sticky notes and memory. By the time the animal actually reaches a rehabilitator or vet, half the story is gone.

**Wildlife Incident Handoff** keeps that story in one clear, chronological, traceable record that can be passed person to person without losing anything:

> **Observe · Record · Hand off · Preserve context**

## Getting the app

- **Everyone:** download the installer or portable EXE from [Releases](https://github.com/amgedi/Wildlife-Incident-Handoff/releases). No build tools, no account, nothing to sign up for.
- **The launcher:** each release also ships `wih-launcher.exe`, a little companion app that opens the workbench, keeps it up to date and switches themes. Binaries live in Releases, not in the source tree.
- **For developers:** `src/` is the frontend, `src-tauri/` the desktop shell, `launcher/` the launcher's own Tauri project. Folder map in `PROJECT_STRUCTURE.md`, docs in `docs/`.

To install: download `Wildlife-Incident-Handoff-Setup-0.3.0-rc.2.exe` from [Releases](https://github.com/amgedi/Wildlife-Incident-Handoff/releases), run it once, then open **Wildlife Incident Handoff** from the Start Menu. Prefer no install? Use the portable EXE from the same release. RC releases are labeled as pre-releases, and uninstalling never deletes your incident data.

## What it is (and isn't)

This app records **what people actually observed** and supports **responsible handoff**. It's deliberately not:

- veterinary diagnostic software or medical advice
- a replacement for licensed wildlife professionals
- a capture guide or treatment planner

It nudges safe behavior where it matters: keep your distance, don't handle the animal more than you must, keep pets away, and get a licensed pro involved.

## Highlights

- **Unknown is valid.** Species, age, sex, cause: never required, never faked. "Right wing hangs lower than left" beats "broken wing" every time.
- **A guided 10-step wizard** with autosaved drafts and a review screen that separates Known / Unknown / Not provided. Optional current-location capture, permission gated; saying no never breaks the form.
- **Append-only timeline.** Every observation, photo, status change, correction and handoff becomes history you can scroll. Nothing gets overwritten; corrections keep the old value and the reason.
- **Handoff and custody tracking.** Who had the animal, when, in what condition, and what came with it. Reporter contact is opt-in, anonymous by default.
- **An operations dashboard** with a service-area map, needs-attention queue, response flow, network pulse, live activity and analytics, all from local records. Nothing is transmitted (see [docs/NETWORK_ARCHITECTURE.md](docs/NETWORK_ARCHITECTURE.md)).
- **A map that respects location privacy.** 2D, satellite and terrain basemaps (MapLibre), incident side-list with single-click fly-to, cluster-aware camera, measure tool. Approximate reports get fuzzed to about 1 km, and sensitive reports never show a precise point anywhere.
- **Exports that know what they're for.** Shareable summaries leave out precise coordinates, contacts and private notes by default; full exports exist but are your explicit choice.
- **Local-first storage.** Everything lives on your device. No account, no cloud, no tracking. JSON backups with a safe, staged restore.
- **Test View.** Fills the workspace with realistic fictional incidents (reproducible by seed) so you can explore without touching real data. One click to reset.
- **Accessible by design.** Keyboard navigation, focus management, labeled forms, status never by color alone, reduced motion support, and layouts that survive short and narrow windows.
- **Guide me, onboarding, tour, tutorial.** Step-by-step coaching through a real report, no AI involved, plus clearly-labeled fictional demo cases.
- **Sixteen themes.** Forest Night by default, plus Aurora, Midnight Ops, Storm, Sand, Arctic, monochrome and high-contrast options. The launcher matches the app.
- **A real desktop app** (Tauri 2). No terminal, no localhost window, with signed auto-updates and the companion launcher.

## Screenshots

| Operations dashboard (desktop) | Map, incident picked from the side list |
| --- | --- |
| ![Operations dashboard](screenshots/current/rc2-app-sidebar-maximized.png) | ![Map selection](screenshots/current/v030-dev7-map/map-row-selected-camera.png) |
| **Companion launcher, Home** | **Launcher theme gallery** |
| ![Launcher home](screenshots/current/rc2-launcher-home.png) | ![Launcher themes](screenshots/current/rc2-launcher-settings-themes.png) |

*(All screenshots use fictional demo data.)*

## Privacy and data safety

- **All incident data stays on your device.** Nothing is uploaded, synced or tracked. There is no server.
- Clearing app data deletes records, so take backups (Settings → Data).
- Exports never happen automatically, and the shareable ones leave out sensitive info by design. Locations can be marked *Sensitive* and get redacted by default.
- Contact details are private by default and excluded from shareable exports unless you say otherwise.

## Support development

If this project is useful to you, you can support it here:
[GitHub Sponsors](https://github.com/sponsors/amgedi) ·
[Ko-fi](https://ko-fi.com/openfhs) ·
[Buymeacoffee](https://buymeacoffee.com/openfhs).
These links live here and in the app's About page, never inside wildlife workflows.

## Development

Requirements: **Node.js 20+** and npm, plus the Rust toolchain for the desktop build.

```bash
npm install        # install dependencies
npm run dev        # dev server (http://localhost:5173)
npm test           # test suite (Vitest)
npm run typecheck  # strict TypeScript check
npm run build      # typecheck + production build into dist/
npm run preview    # serve the production build locally
npm run launcher:deploy  # build + deploy the companion launcher to the repo root
```

The build in `dist/` is an offline-capable PWA, serve it with any static file server. Pull requests are welcome and are accepted under AGPL-3.0-only; see [CONTRIBUTING.md](CONTRIBUTING.md). Security or privacy issues go to [SECURITY.md](SECURITY.md).

## Data format

Incidents use a versioned schema (`schemaVersion: 1`) with a migration path for future versions. Backups are JSON with `schemaVersion`, `applicationVersion` and `exportedAt` metadata, and importing never silently overwrites anything (ID conflicts are skipped and reported).

For a plain-English tour of how this all works, see [docs/HOW_THIS_APP_WORKS.md](docs/HOW_THIS_APP_WORKS.md).

## Roadmap

Deliberately restrained. Possible later: richer organization workflows, optional secure sync between trusted devices, more map tools, taxonomic lookup, rescue-directory integration. Nothing here is promised, and no wildlife workflow will ever be interrupted by upsells.

## License

[AGPL-3.0-only](LICENSE) (GNU Affero General Public License v3.0 only). The license covers software rights and implies nothing about veterinary authorization.

> Historical note: versions up to and including v0.1.0 were MIT licensed; those copies remain under the license that came with them. Everything from 0.2.0 onward is AGPL-3.0-only.
