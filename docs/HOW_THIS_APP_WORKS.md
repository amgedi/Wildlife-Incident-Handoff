# How Wildlife Incident Handoff Works

This is a plain-language tour of the current application architecture.

## Product shape

Wildlife Incident Handoff is a React and TypeScript application packaged as a Windows desktop app with Tauri 2.

The same frontend can be built as a PWA for development and testing, but the public product is the desktop application.

Core incident records are local-first. The application does not require an account or a production cloud backend.

## Main pieces

| Area | Purpose |
| --- | --- |
| `src/` | React application, workflows, maps, exports, settings, tutorials, and tests |
| `src/storage/` | IndexedDB persistence, repositories, migrations, backups, and incident mutations |
| `src/features/` | Product areas such as incidents, response operations, map, export, and network tools |
| `src-tauri/` | Native Windows shell, dialogs, file access, updates, window behavior, and LAN sync |
| `launcher/` | Separate companion launcher built with React, TypeScript, Vite, and Tauri |
| `docs/` | Product, testing, security, and architecture documentation |

## Incident data

Incident data uses a versioned schema and is stored locally in IndexedDB.

The main data model keeps current state and history together:

- current values make the app quick to open and navigate
- timeline events preserve important history
- corrections record previous and new values instead of silently replacing the past
- attachments are stored separately from the main incident record
- drafts are autosaved independently

## Unknown is a real state

Many descriptive fields allow `null` or an explicit unknown state. The interface should never force a user to guess species, age, sex, cause, diagnosis, or another fact that was not actually known.

This product rule appears in both the data model and the interface.

## Incident workflow

A typical record moves through these steps:

1. create or recover a draft
2. record what was observed
3. add location context at the appropriate privacy level
4. add hazards, actions, contacts, and attachments as needed
5. review the record
6. continue adding timeline events as the situation changes
7. record custody or responsibility handoffs
8. export a shareable or internal summary when needed

The app is designed so a record can remain incomplete without becoming invalid.

## Timeline and corrections

Meaningful actions create timeline events.

A correction is not treated as erasing the old value. The correction stores enough context to show what changed and, when supplied, why it changed.

This is important because the current value and the historical record answer different questions.

## Handoffs

Handoff records track changes in responsibility and context, including information such as:

- who or what organization context was involved
- when the transfer occurred
- condition at transfer
- items that moved with the animal
- notes needed by the next person

The app does not treat a locally entered role as proof of professional authority or licensure.

## Privacy and exports

Shareable exports are conservative by default.

They can exclude:

- precise coordinates
- private contact details
- private notes
- other fields not needed by the recipient

Internal exports can include more information only through an explicit user choice.

Backups are different from shareable summaries. Backups are intended to preserve local application data and are validated before restore.

## Maps

The map uses MapLibre and can display online map, satellite, terrain, clustering, selection, measurement, and privacy-aware incident locations.

Map and geocoding features can contact external providers. Local-first storage does not mean every map request is offline. See [NETWORK_ARCHITECTURE.md](NETWORK_ARCHITECTURE.md).

## Optional LAN sync

Desktop builds can opt into experimental local-network sync with a paired device.

The protocol uses explicit pairing, persistent device identities, authenticated encryption, replay counters, and trust revocation. It is not a cloud sync service.

See [LAN_SYNC_SECURITY.md](LAN_SYNC_SECURITY.md).

## Desktop shell

Tauri provides native Windows behavior such as:

- desktop window management
- native file dialogs
- safe file-system access exposed through configured capabilities
- signed application updates
- local network services for optional LAN sync
- single-instance behavior

The desktop shell has its own Rust tests in addition to the frontend test suite.

## Companion launcher

The launcher is a separate Tauri application. Normal mode focuses on launching, update state, diagnostics, and basic settings. Developer tools appear only when a source checkout is detected.

Generated launcher and application binaries are distributed through GitHub Releases instead of being committed to the source tree.

## Network boundaries

Network activity can occur for:

- online map or geocoding providers
- GitHub update checks
- explicitly enabled LAN sync with a paired device

There is no analytics or telemetry service in the current public release.

## Testing

The project uses:

- Vitest for frontend and service tests
- fake IndexedDB for isolated storage tests
- Rust tests for the Tauri application and launcher
- GitHub Actions for typecheck, builds, tests, dependency auditing, and CodeQL analysis

## Good places to start reading

1. `src/types/incident.ts` for the incident vocabulary
2. `src/storage/incidentService.ts` for mutation and history rules
3. `src/features/incidents/` for incident workflows
4. `src/features/network/` for operations, map, and sync-related UI
5. `src-tauri/src/main.rs` for the desktop shell and updater bridge
6. `src-tauri/src/lan_sync.rs` and `lan_crypto.rs` for the experimental LAN protocol
