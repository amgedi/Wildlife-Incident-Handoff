# Changelog

This file summarizes public milestones. Detailed internal development notes and temporary QA reports are intentionally not kept in the public changelog.

## 0.3.0-rc.2

Current public release candidate.

### Added

- rebuilt companion launcher using React, TypeScript, Vite, and Tauri 2
- normal launcher mode for everyday users and separate developer tools when a source checkout is detected
- signed Tauri updater infrastructure with tester and stable channel architecture
- dedicated launcher views for updates, diagnostics, settings, and about
- responsive app sidebar that remains usable in short and narrow windows
- public GitHub release workflow, funding metadata, issue forms, citation metadata, and community files

### Improved

- launcher startup and error states no longer fall back to a blank white surface
- recent incident rows now scroll independently instead of overlapping Settings and Profile controls
- navigation selection is clearer without relying on color alone
- release packaging keeps generated binaries out of normal source history

### Security and privacy

- updater packages use Tauri signature verification
- updater private signing material remains outside the repository and is supplied to GitHub Actions through repository secrets
- public release checksums are generated for downloadable binaries
- the public repository is documented around fictional test data and conservative handling of sensitive wildlife locations

### Known release-candidate limitation

RC2 shipped before the updater channel manifest endpoint was fully corrected. Users on RC2 may need one manual upgrade to the next RC before automatic channel updates work end to end.

## 0.3.0-rc.1

First external tester release.

Highlights included:

- Windows installer and portable desktop build
- guided incident reporting workflow
- timeline, corrections, attachments, status history, and handoff tracking
- operations dashboard and map workspace
- privacy-aware exports and backups
- fictional Test View
- accessibility, responsive layout, onboarding, and guided help
- optional encrypted LAN sync preview

## 0.2.x

Major desktop and workflow expansion.

Work in this series established:

- Tauri desktop packaging
- local-first persistence and migration paths
- professional workspace concepts
- map tooling and service-area views
- backup and restore workflows
- localization architecture
- progressively hardened LAN sync design

## 0.1.0

Initial public application foundation.

This release introduced the core incident workflow, local storage, basic exports, timeline history, and early PWA support.

Versions up to and including `v0.1.0` were released under MIT. Versions from `0.2.0` onward are licensed under `AGPL-3.0-only`.
