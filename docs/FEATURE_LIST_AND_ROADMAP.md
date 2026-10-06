# Feature List and Roadmap

This document is the public product view. It describes what the app does now and what may be explored later. It is not a promise that every idea will ship.

## Current release candidate

Version: `0.3.0-rc.2`

### Incident reporting

- guided 10-step incident workflow
- autosaved drafts and recovery
- optional location capture
- animal details with Unknown as a valid answer
- observations, hazards, actions, current situation, contacts, and attachments
- final review before saving

### Incident history

- append-only timeline
- status changes
- corrections that preserve previous values
- observations and attachments
- custody and handoff events

### Handoffs

- transfer from one person or organization context to another
- condition at handoff
- items transferred
- custody history
- consistency warnings when handoff information conflicts with incident state

### Operations workspace

- dashboard with active work and needs-attention views
- response-flow and activity context
- service-area map
- incident side list
- assignment and handoff views
- deterministic local analytics

### Mapping

- 2D, satellite, and terrain views
- clustering
- incident selection and fly-to behavior
- measurement tools
- approximate and sensitive location handling
- optional external map and geocoding providers

### Privacy and exports

- local-first incident storage
- no analytics or telemetry service
- sensitive-location mode
- shareable exports that exclude precise coordinates, private contacts, and private notes by default
- internal exports by explicit choice
- versioned JSON backup and staged restore

### Testing and training

- fictional Test View
- deterministic seeded demo incidents
- guided onboarding and tutorial flows
- resettable test workspace

### Desktop experience

- Tauri 2 Windows application
- installer and portable builds
- companion launcher
- responsive window layouts
- keyboard navigation and reduced-motion support
- signed Tauri updater artifacts

### Optional LAN sync

- device-to-device local network exchange
- explicit pairing and trust approval
- P-256 identity keys
- encrypted sync payloads
- replay protection
- trust revocation
- experimental status while wider field testing continues

## Near-term priorities

Before a stable `0.3.0` release, the project should prioritize:

1. external tester feedback
2. updater channel validation after the RC2 bootstrap fix
3. accessibility testing on more Windows configurations
4. LAN sync field testing on real networks
5. clearer installation and first-run feedback
6. issue triage from real users
7. release documentation and reproducible packaging checks

## Possible later work

Potential future work includes:

- richer organization workflows
- optional verified organization directories
- additional map and offline-map tooling
- taxonomic lookup that never forces an identification
- better cross-device sync options with explicit consent
- stronger deployment and administration tools for organizations
- additional export formats and interoperability work
- more localization coverage

## Non-goals

The project does not aim to become:

- autonomous wildlife diagnosis
- AI-generated treatment advice
- emergency-services dispatch
- surveillance or tracking software
- a system that silently shares reporter or wildlife-location data
- a leaderboard that rewards speed or volume over quality and safety

## Product rule

New features should make incident recording, understanding, coordination, handoff, history, privacy, export, accessibility, or reliability better. Feature count by itself is not a goal.
