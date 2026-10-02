# Changelog

All notable changes to Wildlife Incident Handoff are documented here. Format based on [Keep a Changelog](https://keepachangelog.com/); versioning follows [SemVer](https://semver.org/).

## 0.2.0-dev.6 — in development

### Fixed
- **Guide Me showed raw translation keys (`s0t`, `s0b`)** — root cause: the Guide Me coach used a `guideCoach` namespace that never existed in the English bundle (only partially in fr/es), so every lookup returned the key itself. Replaced with a complete `guide` namespace with readable per-step keys (`guide.whatHappened.title` …), registered in the English bundle, translated for fr/es, and with a readiness guard so a lazy language pack can never flash raw keys ("Preparing guide…" instead).

### Added
- **First-run setup expanded**: language selection (system-suggested, all 13 catalog languages) and an optional contact profile (name/phone/email/preferred method; organization for professional users). Clearly local-only — prefilled into reports but never shared automatically; share consent stays explicit at review.
- **Settings → Contact details**: edit/clear saved profile with "Stored locally on this device" notice.
- **Reporter dashboard hierarchy**: clickable summary cards (Awaiting response / In progress / Resolved) directly under the hero, deep-linking to filtered My Reports (`?category=`); zero-count cards render quieter; safety content moved to the end; "No new action recorded." replaces the misleading next-step phrasing.
- **Professional operational dashboard** (local preview, honestly labeled): KPI row (new / unassigned / assigned / in response / awaiting transfer / open total), Needs-attention queue (old unassigned, missing location, duplicates, handoffs waiting — each deep-links), aging buckets (<30 min → 4+ h), response-performance medians computed from event timestamps (median to assignment/pickup/transfer — "Not enough data yet" when insufficient), reports-over-time chart (24 h / 7 d / 30 d, lightweight SVG, accessible labels), open-by-status / animal-group / incident-type distributions, transfer metrics with receiving organizations, "Updated just now" reactive timestamps.
- **incidentAnalytics service**: all dashboard metrics derive deterministically from real records and event timestamps (timezone-safe local-day bucketing, memoized) — the same API a future network provider can feed.
- **Map reliability**: states distinguished (loading / ready / offline / provider-failed / no-coordinates), Retry-map button without leaving the page, offline position fallback listing each incident's stored coordinates subject to privacy, no third-party tile caching.
- **Selection chips**: sentence-case labels, visible ✓ selected state (fill + border + check), "No action taken" exclusivity (selecting it clears other actions and vice versa).
- **Professional incident cards**: status chip sits inline with the title (wraps gracefully), separate from Accept/Review actions.

### Tests
- 146 → 176 (+30): guide integrity, analytics determinism/timezone safety, chips, distributions, needs-attention, time series.

## 0.2.0-dev.5 — 2026-10-02

### Fixed
- **CRITICAL desktop shell regression (dev.4)**: the custom title bar participated in the same horizontal flex row as the sidebar — root cause: a silently failed CSS replace left the old `.app-shell { display: flex }` (row) rule in place and never added the `.app-body` flex rules. The shell is now an explicit two-row model: `.app-shell` (100dvh, column, overflow hidden) → titlebar row (fixed 38px, full width) → `.app-body` (flex row, min-size 0) → sidebar (fixed 232px, left) + main area (fills remaining width, owns vertical scrolling). Verified geometrically in the REAL EXE across window sizes (900×650 → 1920×1080), maximized, restored, continuous resize, and a 6-page sweep (titlebar left/width = viewport, sidebar.x = 0, main.x = sidebar right, main.right = viewport, no horizontal overflow). Screenshots captured from the compiled EXE (home + settings). Window controls verified: minimize/maximize/restore/close via titlebar buttons.
- Shell structure + CSS contract regression tests added (src/shell.test.ts); real-EXE geometry verifier added (scripts/shell-verify.mjs).

## 0.2.0-dev.4 — 2026-10-02

### Fixed
- **Desktop title bar spans the full window width** — it was nested inside the flex row; the shell is now titlebar-above-body (sidebar + content below it), with window controls at the true top-right and Windows-sized hit areas.
- Title bar uses semantic `--titlebar-*` tokens per theme (no hard-coded green) and localized Minimize/Maximize/Restore/Close labels.

### Added
- **Complete localization architecture** (i18next + react-i18next): feature namespaces, lazy-loaded language packs, live switching, English fallback with dev missing-key warnings, RTL support (`dir` + language catalog), first-run language suggestion.
- **English, French, Spanish catalogs are complete** (404 keys each, enforced by tests). Ten more languages (de, pt-BR, nl, it, pl, tr, ar, zh-CN, ja, ko) are architecture-ready "beta" — partial packs fall back to English and are never labeled complete. See docs/LOCALIZATION_COVERAGE.md.
- **Ambient animation for every theme** — each of the 10 themes has a distinct atmosphere (forest drift, daylight glow, aurora, sunset, olive, ocean, graphite, and subtle grayscale for mono/high-contrast); pure CSS transform/opacity, paused automatically when the window is hidden.
- **Update report** (Reporter): quick update types (animal still here / moved / no longer present / condition changed / responder contacted) that append timeline events.
- **Drafts in My Reports**: unfinished reports listed with Continue/Discard.
- **Safety help card** on Reporter home (region-neutral, no treatment advice).
- **Check for updates** in About (queries the project's release metadata; shows result, never installs anything).
- MapLibre is lazy-loaded: Reporter users never download the map chunk (~1 MB) unless they open the professional map.

### Housekeeping
- Repository audit: generated artifacts (dist/, src-tauri/target/, release binaries) confirmed untracked; sizes documented in the completion report.
- docs/FEATURE_GAP_AUDIT.md and docs/LOCALIZATION_COVERAGE.md added.
- Dependency inventory refreshed (docs/THIRD_PARTY_NOTICES.md).

## 0.2.0-dev.3 — 2026-10-02

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
