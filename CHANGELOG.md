# Changelog

All notable changes to Wildlife Incident Handoff are documented here. Format based on [Keep a Changelog](https://keepachangelog.com/); versioning follows [SemVer](https://semver.org/).

## 0.1.0 — 2026-10-01

First public release. A complete, local-first tool for recording wildlife incidents and handing them off without losing context.

### Added

- **Guided incident creation** — a 10-step wizard (what happened → animal → location → observations → hazards → actions → current situation → contacts → photos → review) with autosaved drafts, draft recovery, and a review screen distinguishing Known / Unknown / Not provided.
- **"Unknown is valid" data model** — species, life stage, sex, counts, urgency, and location precision are all optional; observations are descriptive ("right wing hangs lower"), never diagnoses.
- **Incident workspace** — Overview (what's happening now, custody, next step), Timeline, Observations, Attachments, People & handoffs, Incident details, and Export tabs.
- **Append-only timeline** — every meaningful action becomes a chronological event; corrections record previous and new values with an optional reason; original entries are never overwritten.
- **Status system** — 14 statuses from Draft to Closed, with status-change history and inconsistency warnings (e.g. status Released but custody still at a facility).
- **Handoff / transfer workflow** — records from → to, method, condition at handoff, and items transferred; builds a full custody history chain.
- **Privacy-aware exports** — Shareable vs Internal handoff summaries; shareable excludes precise coordinates, personal contacts, and private notes; print-to-PDF via the browser, plus text and HTML downloads.
- **Backups** — versioned JSON export/import (schemaVersion 1) with validation; import never overwrites existing incidents with ID conflicts.
- **Local-first storage** — IndexedDB (incidents, attachments, drafts, settings) behind a clean repository/service abstraction; no account, no network calls; works offline; installable as a PWA.
- **Search & organization** — full-text search across references, species, locations, organizations and notes; status/type filters; Archive and Trash with restore, undo, and explicit permanent delete.
- **Learning tools** — first-run onboarding, spotlight product tour, guided first-incident tutorial, contextual help, four clearly-labeled fictional demo incidents, and beginner documentation (docs/HOW_THIS_APP_WORKS.md, docs/GIT_AND_GITHUB.md).
- **Settings** — four themes (Forest Dark/Light, Midnight, Warm Field), interface density, motion (Full/Reduced/Off, honoring prefers-reduced-motion), incident defaults, privacy, storage health & backups, about.
- **Accessibility** — keyboard navigation, focus trapping and restoration in dialogs, accessible custom listboxes, labeled forms, status never by color alone.
- **Quality** — 54 automated tests covering history preservation, privacy redaction, backup safety, and the full finder workflow.

### Safety boundary

The application records observations and supports handoff. It is not veterinary software, does not diagnose, and does not replace licensed wildlife professionals.
