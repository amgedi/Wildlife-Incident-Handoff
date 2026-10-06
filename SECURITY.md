# Security Policy

## Supported versions

Wildlife Incident Handoff is currently in the `0.3.x` release-candidate series.

| Version | Security support |
| --- | --- |
| 0.3.x | Yes |
| 0.2.x | Best effort only |
| 0.1.x | No active support |

## Reporting a vulnerability

Please use GitHub's private vulnerability reporting flow from the repository **Security** tab when it is available.

If private vulnerability reporting is unavailable, open a public issue that only says you need a private security contact. Do not include exploit details, private data, credentials, real wildlife locations, or proof-of-concept payloads in that issue.

## Please do not publish sensitive case data

Security reports, bug reports, screenshots, and test files must not include:

- real sensitive wildlife coordinates
- real reporter or responder contact information
- real private case notes
- credentials, API tokens, private keys, or updater signing material
- local machine paths that reveal unnecessary personal information

Use fictional or redacted data.

## Current security boundaries

Wildlife Incident Handoff is a local-first desktop application. Incident records are stored locally by default.

Network activity can still occur for specific features:

- map tiles and geocoding requests can contact configured map providers
- update checks contact GitHub when enabled
- optional LAN sync can exchange records with a paired device on the local network

The app does not include analytics or telemetry reporting.

## Areas that deserve extra scrutiny

The highest-risk code paths include:

- backup import and schema validation
- attachment names and blob handling
- export privacy filtering
- map and geocoding boundaries
- optional LAN pairing, trust, encryption, replay protection, and revocation
- signed update verification and release metadata
- file-system access exposed through the Tauri desktop shell

## Security design notes

- User-supplied text is rendered as text by React unless a component explicitly uses generated markup.
- Raw HTML is not accepted from incident fields.
- Map marker markup is generated from constrained application values, not arbitrary user HTML.
- File names are sanitized before storage or download.
- Imported backups are validated before data is applied.
- Shareable exports exclude sensitive fields by default.
- Tauri uses a restrictive content security policy for the desktop WebView.
- Tauri updater artifacts use cryptographic signatures. Windows Authenticode signing is a separate concern.
- LAN sync is opt-in and has a published threat model in [docs/LAN_SYNC_SECURITY.md](docs/LAN_SYNC_SECURITY.md).

## Disclosure expectations

Please give the project a reasonable chance to investigate and patch a vulnerability before publishing exploit details. There is no bug-bounty program or guaranteed response-time SLA at this stage.
