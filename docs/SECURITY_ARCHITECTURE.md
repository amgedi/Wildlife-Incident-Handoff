# Security Architecture

This document summarizes the security boundaries that matter in the current desktop application.

## Local data boundary

Incident records are stored locally by default. There is no required user account and no telemetry pipeline.

Data can leave the device only through an explicit user action or a feature that necessarily uses a network service, such as:

- exporting or sharing a file
- online map or geocoding requests
- GitHub update checks
- optional paired-device LAN sync

## Input handling

Imported backups and user-entered values are treated as untrusted input.

Key expectations:

- validate backup structure before applying data
- sanitize file names
- do not render arbitrary incident HTML
- keep shareable export filtering conservative
- preserve history instead of silently replacing source data

Map marker markup is generated from constrained application values rather than arbitrary user HTML.

## Desktop boundary

The Tauri application uses a content security policy and a limited capability set for dialogs, file access, notifications, window controls, updates, and native commands.

New Tauri permissions should be treated as security-sensitive changes.

## Updates

Tauri updater packages are cryptographically signed and verified by the updater plugin.

The private updater signing key must not be committed to the repository.

Windows Authenticode signing is separate and is not currently part of the RC release process.

## LAN sync

LAN sync is optional and experimental. It uses explicit pairing, persistent peer identities, encrypted payloads, replay counters, and local trust revocation.

See [LAN_SYNC_SECURITY.md](LAN_SYNC_SECURITY.md) for the full threat model and remaining limitations.

## Location privacy

Precise wildlife locations can be sensitive.

The product supports approximate and sensitive location modes, and shareable exports omit precise coordinates by default.

Online map providers are separate third parties. A local incident record does not prevent the map provider from receiving ordinary network metadata for map requests.

## Attachments

Attachments are handled as files or blobs, not executable content. File names are sanitized and application code should not evaluate attachment content.

## Release and repository hygiene

The repository should never contain:

- private updater keys
- passwords or tokens
- `.env` secrets
- real sensitive wildlife case data
- private contact records
- unnecessary local machine paths
- generated release binaries in normal source commits

Generated binaries belong in GitHub Releases.

## Reporting

Use [SECURITY.md](../SECURITY.md) for vulnerability reporting. Do not publish exploit details or sensitive case data in a normal issue.
