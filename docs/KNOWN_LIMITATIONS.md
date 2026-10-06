# Known Limitations

Applies to `0.3.0-rc.2`.

This is a release candidate for external testing. It is usable, but it is not the final stable release.

## Windows trust warning

The current installer and EXE are not Authenticode signed. Windows SmartScreen may warn before launch. This is separate from Tauri updater signing, which verifies update packages cryptographically.

## Updater bootstrap

RC2 shipped before the tester-channel manifest endpoint was fully corrected. RC2 users may need one manual upgrade to the next RC. Source after RC2 uses a repository-hosted channel manifest so later builds can receive tester-channel updates normally.

## LAN sync

LAN sync is experimental.

- pairing requires explicit trust approval
- users should compare device fingerprints when pairing on an untrusted local network
- media attachments are not synchronized
- the listener can remain bound while the app is running even when sync is disabled, but disabled endpoints reject sync and pairing requests
- real-world testing across different routers, firewalls, and enterprise networks is still limited

See [LAN_SYNC_SECURITY.md](LAN_SYNC_SECURITY.md).

## Maps and external providers

Core incident records remain local, but online map, terrain, and geocoding features can contact external providers. Offline behavior is intentionally more limited.

Sensitive locations should be marked sensitive. Do not assume a third-party map provider has the same privacy guarantees as local storage.

## Accessibility validation

Keyboard and responsive behavior are covered by automated and manual checks, but the RC has not been exhaustively validated with every screen reader, Windows scaling combination, high-contrast configuration, or assistive technology setup.

Accessibility problems should be reported as bugs.

## Professional verification

Professional role and verification fields are local context. The app does not operate a live authoritative credential-verification service. A role shown in the local workspace is not proof of licensure, authority, or organizational affiliation.

## No emergency dispatch

Wildlife Incident Handoff is not emergency dispatch, law enforcement dispatch, veterinary diagnosis, or treatment software.

## Test data first

External testers should use Test View or clearly fictional data until they are comfortable with export, backup, privacy, and deletion behavior.
