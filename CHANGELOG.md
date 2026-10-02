# Changelog

All notable changes to Wildlife Incident Handoff are documented here. Format based on [Keep a Changelog](https://keepachangelog.com/); versioning follows [SemVer](https://semver.org/).

## 0.2.0-dev.3 — in development

### Fixed
- **Canonical bear paw, done properly**: one vector geometry — exactly four toes, four attached claws, one pad, symmetric — shared by the sidebar logo, hero watermark, empty states, favicon and icon pipeline. The in-app logo adapts to the active theme via `--brand-icon-bg/-fg/-border` tokens (no hard-coded green).
- **Windows icon edges**: the desktop icon is now a proper multi-size ICO (16–256) with real alpha transparency and a transparent safe area — no square corners on taskbar/title bar.
- **Interface Tour rewritten as an explicit state machine** (navigating → waiting-for-target → showing | failed) with generation-token cancellation: stale measurements can never repaint the spotlight, route/target readiness uses real conditions instead of fixed sleeps, and target failure shows Retry / Skip / Exit with internal diagnostics.
- **Blue rectangle during tours**: the spotlight ring now uses its own `--tour-ring` token (no longer the focus color), and the tour focuses the callout heading — never the highlighted target.
- **Double-active navigation**: `/incidents/new` no longer activates "My reports"/"Incidents" (exact matching); at most one primary nav item is current per page.
- **Status colors**: explicit `--status-*-bg/fg/border` tokens for every theme and status; monochrome themes add distinct glyphs (▲ → ◆ ■ …) so status never relies on color alone.
- **My Reports cards redesigned again**: status moved to a deliberate footer row (chip bottom-left, chevron far right), secondary actions in an in-card ⋯ menu (keyboard navigable, Escape closes, doesn't trigger navigation).

### Added
- **Obvious search**: My Reports has an always-visible search field with a `/` keyboard shortcut; Filters are an explicit button with a popover (status/type/animal group/date range) and applied-filter chips with Clear all.
- **Modern checkbox** (real `<input type="checkbox">`, rounded, theme-aware, focus-visible) and a reorganized Export panel.
- **Modern date/time entry**: quick chips (Now, 5/15/30 min ago, 1 hour ago, Earlier today, Yesterday), a calendar + time popover (locale-aware 12/24h), and a manual `datetime-local` fallback. Values are always stored as unambiguous ISO instants.
- **Searchable hierarchical animal combobox** with Invertebrate and optional subgroups (Raptor, Waterfowl, Bat, Canid…); species remains free-text and unverified.
- **Surface hierarchy tokens** (`--surface-1/2/3`, hover/selected/overlay) with explicit elevation for monochrome themes.

### Changed
- **License: AGPL-3.0-only** (from MIT). Historical note: versions up to and including v0.1.0 remain available under the MIT license that accompanied them.
- Custom integrated desktop title bar (drag, snap, double-click maximize, and window controls preserved; web/PWA unaffected).
- Dependency license inventory added (docs/THIRD_PARTY_NOTICES.md).

## 0.2.0-dev.2 — 2026-10-02

### Fixed
- **Incident tabs getting stuck** (root cause): a state-from-URL effect reverted the user's tab selection; the URL query is now the single source of truth, with SPA navigation on every tab click (Back/Forward and deep links work).
- **Interface tour wiring**: "Interface tour", "Start tutorial" and demo explanations are now three architecturally separate guidance systems (own ids, step builders, entry points, persistence keys); completing one never completes another.
- **Sluggishness**: removed `backdrop-filter` from cards (continuous re-blur over the animated ambient), removed `will-change`, rAF-batched and throttled spotlight re-measurement.
- **Stray orange highlight**: spotlight ring and focus system now use one theme-aware `--focus-ring` token with `:focus-visible` semantics (keyboard focus unaffected).
- **Incident card layout**: intentional flex layout with the status chip and chevron grouped at the right edge; secondary actions moved into a labeled overflow menu.

### Added
- **Workspace modes**: Reporter (default) and Professional/responder — separate navigation, home and labels; switched in Settings and chosen during onboarding. Presentation only; never permissions.
- **10 themes** including true Monochrome Dark/Light and High Contrast Dark; distinct per-status chip identities with a side-by-side fixture in Settings → Advanced; hero contrast fixed for light themes via header-ink tokens.
- **Map view** (professional): MapLibre GL with OpenStreetMap raster tiles (no API key), per-status marker shapes + colors, privacy-aware marker positions (approximate fuzzed to ~1 km, sensitive heavily fuzzed), offline notice.
- **Copy diagnostics** in About (versions, settings, storage counts only).
- Canonical `BearPawMark` component; new forest-paw artwork across favicon, PWA, desktop and social preview.
- Service worker caches are versioned and cleaned; the service worker is never registered inside the desktop app.
- Tests: 76 → 111.

## 0.2.0-dev.1 — in development

### Added
- Real spotlight tour: SVG-mask cutout, per-step navigation (incidents list, incident Timeline / People / Export tabs), scroll-into-view, resize/scroll repositioning, guided actions.
- Guide Me: deterministic step-by-step coaching on the creation wizard with exit-anytime.
- "Use my current location": permission-gated geolocation with accuracy capture and timestamp; graceful denial fallback.
- Reporter contact choice: anonymous by default; optional remembering of contact details (off by default, clearable in Settings → Privacy).
- Report-inclusion review: explicit "Information included in this report" section and sharing profiles (Private record / Responder report / Public) that set export defaults.
- Response network local preview: service area, grouped feed, accept action, duplicate-candidate detection, map-provider abstraction; architecture documented in docs/NETWORK_ARCHITECTURE.md.
- Region & language settings: country, metric/imperial units, neutral emergency language.
- Ambient theme layer per theme with a separate ambience control; frosted surfaces with solid fallbacks.
- Pinned incidents; build identity (version/build id/data schema) on the About screen.
- Tauri 2 desktop scaffold and build documentation.

### Changed
- Canonical bear-paw brand mark across app, favicon, PWA icons and social preview; brand block alignment.
- Default motion remains Full, honoring prefers-reduced-motion at the OS level; ambience never animates under reduced motion.

### Compatibility
- Data format unchanged (schemaVersion 1); all v0.1.0 records load without migration. New fields are additive and optional.

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
