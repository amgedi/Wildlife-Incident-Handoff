<div align="center">

# Wildlife Incident Handoff

**An open-source, local-first tool for creating clear and traceable wildlife incident handoffs.**

[![Version](https://img.shields.io/badge/version-0.1.0-green)](CHANGELOG.md)
[![License: AGPL-3.0-only](https://img.shields.io/badge/License-AGPL--3.0--only-blue)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-54%20passing-brightgreen)](#development)

</div>

---

When someone finds injured wildlife, the important details end up scattered across phone calls, text messages, handwritten notes, photos, and memory. By the time the animal reaches a rehabilitator or vet, half the story is missing.

**Wildlife Incident Handoff** turns that scattered story into a clear, chronological, traceable incident record that can be passed from person to person without losing context:

> **Observe · Record · Hand off · Preserve context**

## What it is (and isn't)

This app records **what people actually observed** and supports **responsible handoff**. It is deliberately *not*:

- veterinary diagnostic software or medical advice
- a replacement for licensed wildlife professionals
- a capture guide or treatment planner

Where relevant, the app encourages safe behavior: observe from a distance, avoid unnecessary handling, keep people and pets away, and contact an appropriate licensed wildlife professional.

## Highlights (0.2.0-dev additions in *italics*)

- *🧭 **Real spotlight tour*** — the tour navigates into the actual screens (incident list, timeline, handoff, export), dims everything except the target through an SVG-mask cutout, and follows the interface on resize.
- *🐻 **Canonical bear-paw brand mark*** — one shape across app, favicon, PWA icons and social preview.
- *📍 **Use my current location*** — optional, permission-gated geolocation with accuracy capture; denied permission never breaks the form.
- *🙋 **Reporter contact by choice*** — anonymous by default; opt-in contact details with optional (off-by-default, clearable) remembering on this device; a review screen shows exactly what the report includes and a sharing profile (Private record / Responder report / Public).
- *🤝 **Response network (local preview)** — a professional dashboard over local incidents: service area, grouped feed (new / active / transfer / closed), accept action, possible-duplicate detection, map-provider abstraction. Nothing is transmitted; see [docs/NETWORK_ARCHITECTURE.md](docs/NETWORK_ARCHITECTURE.md).
- *🧭 **Guide me** — deterministic step-by-step coaching through a real report (no AI, no chatbot).
- *🌍 **Region & language settings*** — country, metric/imperial, and deliberately neutral emergency language.
- *🖥️ **Desktop (Tauri 2)** — scaffold + documented build for a native Windows app with no terminal and no localhost; see [src-tauri/README.md](src-tauri/README.md).
- *✨ **Ambient themes*** — very slow per-theme background movement when motion is Full, with a separate ambience control and frosted surfaces with solid fallbacks.

## Highlights

- 🪶 **Unknown is valid** — species, age, sex, cause: never required, never faked. Observations like *"right wing hangs lower than left"* are preferred over diagnoses like *"broken wing"*.
- 🧭 **Guided 10-step creation wizard** with autosaved drafts, draft recovery, and a review screen that distinguishes *Known / Unknown / Not provided*.
- 📜 **Append-only timeline** — every observation, photo, status change, correction, and handoff becomes chronological history. Original entries are never overwritten; corrections record previous and new values with an optional reason.
- 🤝 **Handoff & custody workflow** — record transfers of responsibility (from → to, method, condition, items transferred) and see the full custody chain at a glance.
- 🔒 **Privacy-aware exports** — shareable summaries exclude precise coordinates, personal contacts, and private notes by default; internal exports include everything, by explicit choice.
- 💾 **Local-first storage** — everything lives in your browser (IndexedDB). No account, no cloud, no tracking. Versioned JSON backups with safe, conflict-aware import.
- ♿ **Accessible by design** — keyboard navigation, focus management, labeled forms, status never by color alone, reduced-motion support.
- 📱 **Mobile-friendly** — genuinely usable field reporting, not a shrunken desktop.
- 🎓 **Onboarding, product tour, guided tutorial, and clearly-labeled fictional demo cases.**
- 🌲 **Four curated themes** — Forest Dark (default), Forest Light, Midnight, Warm Field.

## Screenshots

| Home | Timeline |
| --- | --- |
| ![Home](screenshots/1-home.png) | ![Timeline](screenshots/5-timeline.png) |
| **Create incident (guided wizard)** | **Privacy-aware export** |
| ![Create](screenshots/2-create-incident.png) | ![Export](screenshots/6-export.png) |

*(All screenshots use fictional data.)*

## v0.1.0 Features

- Onboarding with experience modes (presentation presets only — never permissions)
- Guided incident creation: what happened, animal, location, observations, hazards, actions taken, current situation, contacts, photos, review
- Incident workspace: Overview, Timeline, Observations, Attachments, People & handoffs, Incident details, Export
- Status system (Reported → … → Released/Closed) with status-change history
- Handoff/transfer recording with custody history and consistency warnings
- Corrections with preserved history ("append, don't erase")
- Search & filters; Archive and Trash with restore + undo
- Export: printable handoff summary (browser print → PDF), text, HTML; JSON backup export/import with validation
- Fictional demo incidents, product tour, guided tutorial, contextual help
- Settings: appearance (4 themes, density, motion), accessibility, incident defaults, privacy, storage & backups, and more
- Installable PWA; core workflows work offline

## Privacy & data safety

- **All incident data is stored locally in your browser.** Nothing is uploaded, synced, or tracked — there is no server.
- Clearing browser data can delete local records; backups are recommended (Settings → Storage & backups).
- Exports never happen automatically. Shareable exports deliberately exclude sensitive information; precise wildlife locations can be marked *Sensitive* and are redacted by default.
- Personal contact details are marked private and excluded from shareable exports unless explicitly included.

## Installing & running (normal users)

**Web / PWA:** open the deployed site or serve the `dist/` folder with any static file server; install as a PWA from your browser menu. All data stays in your browser.

**Windows desktop:** download `Wildlife-Incident-Handoff-Setup-x.y.z.exe` from Releases, install, and launch **Wildlife Incident Handoff** from the Start Menu — a native window, no terminal, no local server. Uninstalling does not delete your incident data without an explicit, warned choice. (The desktop build is prepared via Tauri 2 — see the release assets.)

## Development (developers)

Requirements: **Node.js 20+** and npm. The desktop build additionally requires the Rust toolchain.

```bash
npm install        # install dependencies
npm run dev        # start the dev server (http://localhost:5173)
npm test           # run the test suite (Vitest)
npm run typecheck  # strict TypeScript check
npm run build      # typecheck + production build into dist/
npm run preview    # serve the production build locally
```

The production build in `dist/` is a fully offline-capable PWA. Serve it with any static file server (or `npm run preview`).

## Data format

Incidents are stored under a versioned schema (`schemaVersion: 1`) with a migration path established for future versions. Backups are JSON with `schemaVersion`, `applicationVersion`, and `exportedAt` metadata. Importing never silently overwrites existing incidents — ID conflicts are skipped and reported.

See [docs/HOW_THIS_APP_WORKS.md](docs/HOW_THIS_APP_WORKS.md) for a plain-English tour of the architecture, and [docs/GIT_AND_GITHUB.md](docs/GIT_AND_GITHUB.md) for the Git commands used in this repository.

## Limitations (v0.1)

- Single-device, single-browser: no synchronization (by design; optional sync is a future consideration).
- "Current browser" storage means clearing site data deletes records without a backup.
- Species identification is never verified automatically; no taxonomic lookup yet.
- Exports are human-readable documents, not an interchange standard.
- Not a substitute for professional wildlife care — see the safety boundary above.

## Roadmap

Restrained by design. Candidate areas for v0.2+:

- richer organization workflows and configurable intake forms
- optional secure synchronization / organization accounts
- improved map tools and optional taxonomic lookup
- rescue-directory integration, structured professional outcome fields
- richer attachments and interoperability

## Contributing

Beginner-friendly contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, conventions, and the project's accessibility and privacy expectations. Security/privacy issues: [SECURITY.md](SECURITY.md).

## License

[AGPL-3.0-only](LICENSE) (GNU Affero General Public License v3.0 only). The license grants software rights only and implies nothing about veterinary authorization.

> Historical note: versions up to and including v0.1.0 were distributed under the MIT license; those historical copies remain available under the license that accompanied them. The development line from 0.2.0 onward is AGPL-3.0-only.

---

*Wildlife Incident Handoff — "I know what happened. I know who has the animal now. I can safely pass this record to the next person."*
