# Wildlife Incident Handoff — Feature List & Roadmap (2026-10-03, v0.2.0-dev.13)

## What the product IS

Two products over one incident data model, local-first, no backend required:

1. **Reporter** — calm, safety-first reporting for the public.
2. **Professional** (local preview) — an operations console for wildlife response teams.

Everything below is verified working; platform notes mark where a feature is desktop-only.

## Feature list (current state)

### Core records & data
- 10-step guided incident wizard (reporter and professional intake variants), autosaving drafts with resume/discard
- Incident detail with Overview / Timeline / Observations / Attachments / People & handoffs / Details / Export tabs
- Append-only timeline with structured events (status changes, corrections, custody, handoffs) — history is never overwritten
- Animal info with "Unknown" as a first-class answer; species never treated as verified
- Location model: device GPS with confirmation, manual coordinates, description; exact / approximate / sensitive precision
- Privacy model: shareable vs internal exports, redaction preview, private notes never exported, coordinates excluded from shareable output
- Soft delete: archive + trash with restore, permanent delete with backup warning
- Pin, search (`/` shortcut), filters, saved named views (persisted), deep-linkable categories
- Backups: single-file JSON export/import (includes media), storage health, duplicate-safe import
- Media: photos AND videos (capture or file), captions, thumbnails, size warnings, quota awareness

### Reporter experience
- Purpose-built home: safety card, report CTA, latest active report, status summary cards, drafts, recent reports
- Guide Me (in-context coach through a real report), guided first report, interface tour
- Report status meanings surfaced everywhere; honest "no new action recorded" states
- Report update dialog (still here / moved / gone / condition changed / observation / photo / location fix)

### Professional experience
- Operations dashboard (god's-eye): service-area map with markers, clusters, service-area ring, map inspector; Needs Attention queue (waiting >2h, unassigned, missing location, handoffs, duplicates); live activity feed; operational pulse KPIs with honest deltas; response-flow pipeline; response performance medians; case aging strip; transfers; distributions with data-quality insights; responder workload (no rankings)
- Dashboard customization: show/hide/reorder widgets, persisted, Needs Attention hide-confirmation, restore recommended layout; role-based default emphasis (dispatcher/rehabilitator/etc.)
- Response Network + Incidents queue: consistent rows, cards/table density, 50-row cap, accept action
- Full-map destination with "Incidents in view" side panel; List/Map are exclusive views
- Operations View (chrome-less, Esc exits) for dispatch desks / second monitors
- Professional role architecture: 8 roles, verification requirements, preview/pending states, active role switching, capability matrix docs — nothing authorizes locally (hard-unverified)
- Unified dashboard filters (status, animal group, type, assignment, time) applying to every widget

### Map system
- MapLibre with a provider registry (declarative descriptors: tiles, attribution, health check, usage policy)
- OpenStreetMap raster provider (default) + offline basemap provider (zero network requests)
- Explicit-height containers (fixed the historic blank-desktop-map bug), overlay re-render on load/resize/rAF
- Service-area first camera; geodesic service-area ring; click-to-zoom clusters; dense clustering (1,000+ incidents stay smooth); shape+color markers; click inspector
- Graceful failure: retry, honest reason categories, local position list fallback; non-sensitive diagnostics
- Works in the desktop EXE (production CSP fixed to allow tiles + blob workers)

### Localization & accessibility
- 5 production languages — English, French, Spanish, German, Portuguese (Brazil) — 100% key coverage, live switching, no restart
- 8 more locales behind a developer preview toggle + zz-ZZ expanding pseudo-locale for QA
- RTL architecture (Arabic catalog-ready), bidi isolation for user data
- Keyboard navigation, focus management, ARIA labeling, accessible chart fallbacks (data tables), 200% zoom safe, reduced-motion + off modes, 10 themes including monochrome and high-contrast, ambient background effects with visibility pausing

### Help & support
- Two-pane Help Center: persistent category rail (search, categories, tutorials, glossary, support), article reader with related articles, Show me tours, optional local "was this helpful"
- Reporter and Professional article sets with Q&A coverage (17 question-format articles added dev.13)
- Glossary (shared with contextual popovers); honest support composer (prepare/copy/download bundle, GitHub links — never "message sent"), privacy-safe diagnostics

### Notifications
- Local notification center (bell in sidebar footer / mobile top bar), unread badge, mark-read/clear/click-through
- Categories for reporter + professional events, quiet hours, sound preference; in-app delivery only (honest labeling)

### Desktop (Tauri 2, Windows)
- Installer + portable EXE, single-instance, custom titlebar, native save/open dialogs
- PWA/web build with service worker + installability
- **LAN sync (NEW, v1, desktop-only)**: optional device-to-device incident exchange over the local network (tiny HTTP server per device; pull+push rounds every ~5s; last-writer-wins merge by id/updatedAt; demo records excluded; peers configured by address; activity log). No internet, no cloud. v1 limits: text records only (photo/video files not synced), manual address exchange (no auto-discovery), plain-HTTP inside the LAN.

### Launcher & branding
- `Launch Wildlife Incident Handoff.cmd` (menu: desktop app / web dev)
- New scenic bear-paw brand: theme-aware in-app emblem (no wordmark), full logo in `branding/`, regenerated icon sets

## Known issues / what can be fixed (near-term)

1. **LAN sync hardening** — auto-discovery (UDP broadcast or mDNS) instead of manual addresses; conflict surfacing (show merged changes); attachment/media sync (chunked transfer); sync of archive/trash state; tests against a live two-instance setup.
2. **Notification delivery** — in-app toasts only; add native OS notifications (desktop) and a service-worker channel (PWA).
3. **Offline maps** — ship a small offline tile pack (e.g. PMTiles of a region) so the professional map works with zero connectivity.
4. **fr/es/de/pt-BR review** — packs are machine-assisted; need human linguistic review (marked as such).
5. **Arabic RTL** — architecture ready, no pack yet; needs a full translation + visual RTL pass over charts/maps.
6. **DPI scaling** — 125/150% Windows scaling untested systematically.
7. **Screen reader pass** — NVDA/VoiceOver audit of the dashboard and wizard.
8. **Performance at scale** — analytics recompute over all incidents per render; memoization/incremental aggregation for 10k+ records; virtualize the incidents table.
9. **Update checker** — currently pings GitHub releases; add in-app changelog viewer.

## What can be expanded (mid-term)

- **Response network (connected mode)** — the documented server architecture (docs/NETWORK_SECURITY_AND_AUTH_PLAN.md): real organizations, server-side verification, live assignment dispatch, multi-org handoffs. The LAN sync protocol is a stepping stone, not a replacement.
- **Professional analytics** — saved chart configurations, CSV export of dashboards, seasonal comparisons, response-time SLA alerting.
- **Reporter follow-ups** — opt-in status subscription for your own report (local notifications exist; cross-device needs the network layer).
- **Field mode** — GPS breadcrumbs, track recording, offline basemaps per region.
- **Animal welfare data** — outcome tracking post-release, banding/tagging records, vet treatment logs (schema additive).
- **Interoperability** — import/export adapters (CSV, OIE-style formats), read-only public situation page export.
- **Tutorials** — more role-specific professional tours; in-context help for every widget (Help → Show me already wired).

## Deliberate non-goals (per spec)

- No cloud, no accounts, no telemetry.
- No fake capacity metrics, no productivity scoring of responders.
- No local "verified" status — verification must be server-issued.
- No auto-merge of duplicate incidents (human review only).
