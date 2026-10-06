# Network Architecture

Wildlife Incident Handoff is local-first. Incident records live on the user's device unless the user explicitly exports them or enables a feature that communicates outside the local app.

## Network activity that exists today

### Map and terrain providers

Map, terrain, and geocoding features can contact configured external providers. These requests may reveal ordinary network metadata such as IP address and the requested map area to that provider.

Sensitive wildlife information should not be treated as protected merely because the app stores the original incident locally.

### Update checks

The desktop app can contact GitHub to check for signed updates.

### Optional LAN sync

Desktop users can opt into local network sync with another paired device. This feature is experimental and is documented in [LAN_SYNC_SECURITY.md](LAN_SYNC_SECURITY.md).

The LAN path is device-to-device. It does not use a cloud relay.

## What does not exist today

The current public release does not include:

- a production cloud incident backend
- public incident broadcasting
- automatic organization submission
- live emergency dispatch
- a verified professional credential service
- silent upload of local incident records

## Local storage

Incident data is stored in local application storage. Backups and exports are user-triggered.

Shareable exports intentionally omit sensitive fields by default. Internal exports can include more information when the user explicitly chooses them.

## Future organization networking

A future hosted organization mode would require a separate security and privacy review before release. At minimum it would need:

- organization-scoped authentication
- server-side authorization
- explicit submission consent
- field-level visibility rules
- encrypted transport
- audit logging
- retention and deletion policy
- verified organization processes
- rate limiting and abuse controls
- safe offline queue semantics

The local app must remain useful without requiring such a backend.

## Privacy principle

A network feature must make it clear when information is leaving the device, what is being sent, who receives it, and whether the action can be undone.
