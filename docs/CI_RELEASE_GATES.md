# CI and Release Gates

## Pull requests and main branch

`.github/workflows/ci.yml` checks:

1. dependency installation with `npm ci`
2. strict TypeScript typechecking
3. the frontend test suite
4. the production frontend build
5. production npm dependency audit at high severity or above
6. Rust tests for the desktop application
7. launcher frontend build
8. Rust tests for the companion launcher

`.github/workflows/codeql.yml` also analyzes JavaScript and TypeScript code on pushes, pull requests, and a scheduled weekly run.

## Tagged releases

`.github/workflows/release.yml` runs for version tags and requires all release build steps to succeed before publishing artifacts.

The release pipeline:

- typechecks and tests the frontend
- runs desktop Rust tests
- creates the Tauri desktop bundle
- signs updater artifacts with repository secrets
- builds and tests the companion launcher
- generates SHA-256 checksums
- creates the updater channel manifest
- publishes installer, portable, launcher, signature, checksums, and manifest to GitHub Releases
- updates the repository-hosted tester or stable channel manifest

Release candidates are marked as GitHub pre-releases.

## Signing

Tauri updater signing is required for automatic update verification.

Windows Authenticode signing is a separate deployment concern and is not currently part of the RC release process. See [WINDOWS_CODE_SIGNING.md](WINDOWS_CODE_SIGNING.md).

## Before stable release

A stable release should not be promoted while CI is failing, known privacy regressions are open, updater verification is broken, or release artifacts cannot be reproduced and checksummed.
