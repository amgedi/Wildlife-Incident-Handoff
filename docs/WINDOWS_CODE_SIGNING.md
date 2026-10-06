# Windows Code Signing

Status: the current release-candidate installer and EXE are not Authenticode signed.

Windows may therefore show a SmartScreen warning, especially for a new project with little publisher reputation.

## Authenticode and updater signing are different

Wildlife Incident Handoff already uses Tauri updater signing to verify update packages cryptographically.

Windows Authenticode signing serves a different purpose. It identifies the Windows publisher and helps Windows and organizational security tooling evaluate the executable.

One does not replace the other.

## Future release requirement

Before the project claims that Windows binaries are signed, the release process should have a real code-signing certificate or supported trusted signing service and should sign every distributed Windows executable that users are expected to launch.

The signing key or service credentials must never be committed to this repository.

A release process should also timestamp signatures using the signing provider's supported trusted timestamp service so a valid signature can remain verifiable after certificate renewal.

## Release checklist once signing is enabled

- sign the installer
- sign the portable application executable
- sign the standalone launcher if it is distributed separately
- verify signatures on a clean Windows machine
- record the expected publisher identity in release documentation
- keep signing credentials outside the repository
- continue using Tauri updater signatures for in-app update verification

Until Authenticode signing is enabled, public release notes should state clearly that the binaries are unsigned rather than implying a trusted Windows publisher signature exists.
