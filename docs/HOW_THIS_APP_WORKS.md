# How Wildlife Incident Handoff Works

Wildlife Incident Handoff is built around the part of wildlife response that is easy to lose: **context**.

A case may begin with one person seeing an animal and end with several different people involved in reporting, transport, rehabilitation, veterinary care, conservation work, or follow-up. The app gives that information one place to stay organized as responsibility changes.

## 1. Start with what you actually know

Create a new incident and record the situation as it is known now.

You can capture things such as:

- what was observed
- approximate or precise location, depending on what is appropriate
- hazards or immediate context
- photos and attachments
- relevant contacts
- actions that have already happened
- facts that are still unknown

The app does not require a guess just to make a form look complete.

## 2. Review before you submit

The reporting flow includes a review step so obvious gaps, accidental details, and location sensitivity can be checked before the incident becomes part of the working record.

Drafts autosave during the process.

## 3. Keep the incident alive over time

An incident is not a one-time form submission.

As the situation changes, the timeline can record:

- new observations
- corrections
- status changes
- attachments
- notes
- custody changes
- handoffs

Corrections preserve what changed instead of silently rewriting the past.

## 4. Coordinate from the workspace

The operational workspace brings active incidents together so users can see what needs attention without opening every record individually.

Depending on the workspace and local data, it can surface:

- active incidents
- waiting incidents
- handoffs
- assignments
- recent activity
- response flow
- map context

The goal is clarity, not productivity scoring or competition.

## 5. Work from the map

The map can show incidents spatially with tools for filtering, clustering, selecting records, measurement, and location privacy.

Selecting an incident from the side list keeps the user on the map while opening useful incident context. A full record can still be opened when more detail is needed.

Map and geocoding features can contact external providers when those online features are used.

## 6. Hand responsibility to the next person clearly

A handoff can record information such as:

- who or what organization context is involved
- when responsibility changed
- condition at transfer
- items that moved with the animal
- notes the next person needs
- what is still pending or unknown

A locally entered role is not treated as proof of professional authority or licensure.

## 7. Export only what should be shared

Shareable exports use conservative defaults.

They can leave out:

- precise coordinates
- private contact details
- private notes
- other fields that are unnecessary for the recipient

Internal exports can include more information through an explicit user choice.

Backups are separate from shareable summaries. Backups are for preserving local application data and are validated before restore.

## 8. Practice with fictional incidents first

**Test View** fills the application with fictional incidents so the workflow can be explored without entering real wildlife or contact information.

This is the recommended place to start during the release-candidate testing period.

## What happens when information is unknown?

Unknown is a real state in Wildlife Incident Handoff.

The interface should not force someone to guess species, age, sex, cause, diagnosis, ownership, or another fact that was not actually known.

Missing information is not automatically interpreted as a negative answer.

## What stays on the device?

Core incident records are stored locally by default. The app does not require a Wildlife Incident Handoff account or production cloud backend for its main workflow.

Network activity can still occur for specific features:

- map tiles and geocoding
- GitHub update checks
- optional paired LAN sync

There is no analytics or behavioral telemetry service in the current public release.

## Optional LAN sync

Desktop builds can opt into local-network sync with a trusted paired device.

The protocol uses explicit pairing, persistent device identities, authenticated encryption, replay counters, and trust revocation. It is not a cloud sync service.

Read [LAN sync security](LAN_SYNC_SECURITY.md) before testing it with anything beyond fictional data.

## The companion launcher

The launcher is the front door for the desktop build. It provides:

- launch status
- update state
- repair and diagnostics tools
- basic launcher settings

Developer tools only appear when a source checkout is detected, so the normal launcher stays focused on using the application.

## Under the hood

For contributors, the main application uses **React, TypeScript, Vite, IndexedDB, and Tauri 2**. The companion launcher has its own React and TypeScript frontend with a Tauri backend.

Useful starting points in the source:

1. `src/types/incident.ts` for incident vocabulary
2. `src/storage/incidentService.ts` for mutation and history rules
3. `src/features/incidents/` for incident workflows
4. `src/features/network/` for operations, map, and sync-related UI
5. `src-tauri/src/main.rs` for the desktop shell and updater bridge
6. `src-tauri/src/lan_sync.rs` and `lan_crypto.rs` for the experimental LAN protocol

For security boundaries, see [SECURITY.md](../SECURITY.md) and [NETWORK_ARCHITECTURE.md](NETWORK_ARCHITECTURE.md).
