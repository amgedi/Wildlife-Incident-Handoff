# Updater Signing Setup

Wildlife Incident Handoff uses Tauri updater signing so installed clients can verify that an update package was produced by the project.

## Key handling

The private updater signing key must stay outside the repository.

A typical local location is:

```text
%USERPROFILE%\.tauri\wildlife-incident-handoff.key
```

The exact local user name or machine path should never be documented in the repository.

The public key is safe to commit and is configured in `src-tauri/tauri.conf.json`.

## GitHub Actions secrets

The release workflow expects these repository secrets:

- `TAURI_SIGNING_PRIVATE_KEY`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`

Never commit their values, paste them into issues, include them in screenshots, or expose them in diagnostics.

## Updater signing versus Windows code signing

These are different systems.

**Tauri updater signing** verifies update packages before installation.

**Windows Authenticode signing** establishes Windows publisher identity and influences SmartScreen reputation.

The project currently uses Tauri updater signing. Authenticode signing is a separate future deployment decision.

## Channel manifests

Source after RC2 uses repository-hosted updater manifests:

- tester channel: `updates/tester.json`
- stable channel: `updates/latest.json`

The release workflow updates the appropriate manifest after publishing a release.

RC2 itself was built before this endpoint correction, so RC2 users may need one manual upgrade to the next RC before automatic tester-channel updates work end to end.

## Backup warning

Losing the updater private key can prevent existing installations from accepting future updates signed by a replacement key. Store the key and its password securely, and keep backups separate from the repository.
