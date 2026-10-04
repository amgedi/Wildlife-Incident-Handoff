# Changelog

All notable changes to Wildlife Incident Handoff are documented here. Format based on [Keep a Changelog](https://keepachangelog.com/); versioning follows [SemVer](https://semver.org/).

# Changelog

All notable changes to Wildlife Incident Handoff are documented here. Format based on [Keep a Changelog](https://keepachangelog.com/); versioning follows [SemVer](https://semver.org/).

## 0.2.0-dev.18 — trust hardening pass (tours, privacy, backups, notifications)

Focus: "Would I trust this application with real wildlife incident data?" — fewer visible features, harder edges.

### Tutorial / Guide Me
- **Honest tour results**: every tour run is now recorded as `completed`, `skipped_by_user`, `auto_skipped_target_missing` or `failed`. A run that skips a missing target is NEVER counted as a clean pass, and exiting with Escape no longer marks the tour complete (only fully-completed runs do).
- **Zero-auto-skip contract (tested)**: a new test walks every built-in official tour and fails if any target element does not exist in the product — silent step-skipping in official tours is now a build failure, not a hidden behavior.
- **Auto-skip is now visible**: if an official step's target is missing, the tour shows its failure card (Retry / Skip step / Exit) instead of silently sliding forward.
- **New standalone tour: "Finding reports"** — restores the search/filters teaching removed in dev.17 as its own declarative tour (list → search → filters → saved views), workspace-aware (My Reports / Incidents). Available from Help → Tutorials.
- All tour steps are declarative (explicit route + target + text keys); the legacy dead-code step list (with the old broken Search/Filters steps) was deleted.
- Steps can declare an `openTarget` the engine clicks before measuring (used to open the Filters panel for the saved-views step).

### Professional verification — honesty fix
- The dev.17 wording "Submit verification" / "Verification submitted — pending review" was misleading: **there is no reviewer and nothing is sent anywhere.** The flow now says "Prepare verification evidence", saves notes **locally only**, and the badge reads "Evidence prepared locally — not submitted". Every string states that connected verification is not available yet.
- Only the note text and a document NAME are stored (a reminder) — the document itself is never copied, sent, exported, synced or backed up. Wording + storage contract is documented and tested.
- New design doc: `docs/PROFESSIONAL_VERIFICATION_ARCHITECTURE.md` (invitation → evidence → admin approval → signed claims → revocation; "verified" remains impossible until a real server issues it).

### Location privacy / geocoding
- **New GeocodingProvider abstraction** — provider identity, endpoint, attribution, privacy disclosure, rate limit and health in one module; no provider logic in map components.
- **Sensitive locations are never geocoded** — the inspector shows "lookup disabled", nothing is sent to any third party.
- **Approximate locations** are reverse-geocoded at the ~1 km generalized coordinate only — the stored exact coordinate is never transmitted.
- **Exact locations** now require explicit consent on first lookup ("Looking up a nearby road/place will send this location to …" with Continue/Cancel and a remember-preference checkbox).
- Reverse-geocode results are cached persistently (same marker clicked twice = one network request) and rate-limited client-side; offline / provider-down / rate-limited / no-result each show an honest message and never break the inspector.
- **Raw coordinates demoted** in the inspector to a collapsed "Technical details" section: exact coords only for exact incidents, generalized for approximate, hidden for sensitive. Operational info (description, landmark, distance/bearing, GPS accuracy) comes first.
- **Per-incident privacy is now honored on maps**: a sensitive incident renders at ~10 km fuzzing even when the surrounding view defaults to approximate (previously the view default overrode it).
- **Exports honor precision**: approximate incidents export only a generalized coordinate, sensitive incidents export "withheld (sensitive location)" — previously internal exports printed exact coordinates regardless of the incident's privacy setting (Help claimed otherwise; now true).

### Backups
- Backups now carry a **manifest with per-record SHA-256 hashes**; restore verifies structure AND integrity before writing anything, and refuses records that fail their hash ("corrupted or altered") or are missing from the manifest — corruption is reported, never silently imported.
- Staged restore: the whole batch is validated before the single atomic IndexedDB write, so a failed import cannot leave a half-imported workspace.
- Legacy manifest-less backups still import (compat tested); 100-incident round-trip tested with timings.

### LAN sync
- Now labeled **EXPERIMENTAL** in Settings with an explicit warning: traffic is not encrypted yet and device identity is not cryptographically verified; use only on fully trusted networks. Still off by default.
- New clock-skew tests: a peer with a 2027 clock or a 1999 clock can never silently overwrite a local edit — competing changes always raise an explicit conflict. Threat-model docs updated with what sync does and does not protect.

### Notifications
- **Real Windows system notifications** (Tauri notification plugin), opt-in in Settings → Notifications with a working "Send test notification" button; browser/PWA notifications behind the Web Notifications API with permission requested **only on explicit user action**.
- Delivery settings show only channels that actually function on the current platform — unavailable channels state why, instead of offering placebo toggles.

### Performance (10,000 incidents)
- New 10k-record performance suite with budgets: KPIs 2 ms, attention card 8 ms, distributions ~1 ms, search 6 ms, duplicate detection 9 ms, marker fuzzing 2 ms.
- **Trend chart fixed**: the 90-day series recomputed with O(days × records) date parsing (~610 ms per render at 10k) — now precomputed once per render: **16 ms**, 39× faster, with a CI budget so it cannot regress.

### Docs & release
- New: `docs/SBOM.md` (regenerated inventory), `docs/OFFLINE_MAPS_EVALUATION.md` (PMTiles regional packs evaluated, deferral rationale, implementation contract), `docs/PROFESSIONAL_VERIFICATION_ARCHITECTURE.md`.
- Updated: `docs/SECURITY_ARCHITECTURE.md` (dev.18 threat model: geocoding, evidence, sync, backups, notifications), `docs/LAN_SYNC_SECURITY.md`, tester guides with the short feedback form.
- 351 tests passing (up from 297).

## 0.2.0-dev.17 — operations visibility pass (map, inspector, list, roles)

### Changed
- **Map markers redesigned**: every incident status now has its own large, white-ringed, high-contrast marker (color + glyph — blue ● reported, purple ◆ assigned, amber ▲ pickup, orange ➜ transport, teal ⇄ transfer, green ♥/✓ care/released, gray ■ closed…) so each incident is individually readable on satellite imagery. Full per-status legend under the map.
- **Location intel in the map inspector**: clicking a marker now shows the stored description/landmark/address, precise coordinates with GPS accuracy, distance + compass bearing from the service-area center, and an on-demand reverse-geocoded nearest road/place (Nominatim, single cached request per position, attributed). This is the "what do I tell the responder" panel.
- **List mode upgraded**: queue rows carry a status color strip on the left edge and a bold "waiting X h" badge once a case exceeds 2 hours — the list reads as a live console, not a static table.
- **Professional roles: verification submission flow** — each role now offers "Submit verification": attach evidence (certificate photo/badge, file name kept locally) plus context notes. The role shows "Verification submitted — pending review" with an honest notice: nothing unlocks until a real organization approves it server-side.

### Fixed
- **Tutorial dead-end (user-reported, recurring)**: the Search and Filters steps have been REMOVED from the interface tour entirely — they depended on the user clicking a specific action button instead of Next, and failed whenever the list page rendered differently. Additionally, the tour now **auto-skips** any step whose target cannot be found instead of showing "We couldn't find this part of the interface." The tour can no longer dead-end.

### Tests
- 297 passing; legend sweep updated for the per-status registry.

## 0.2.0-dev.16 — tutorial content fix

### Fixed
- **Tutorial went nonsensical right after the Search/Filters steps** (user-reported). Root cause: the steps after "Filters" reused wrong translation keys — the incident-header step showed the home step's title ("Your starting point") with timeline body text, the People step and reporter Status step reused home/timeline/filters keys likewise. Every step now has its own correct title and text ("Inside an incident", "People & handoffs", "Report statuses"), with new keys translated in all five production languages. Verified live: the full 11-step professional tour reads Search → Filters → Inside an incident → Timeline → People & handoffs → Export → Guide me → Settings with zero target failures.

### Tests
- 297 passing (keys asserted per locale).

## 0.2.0-dev.15 — trust pass: sync integrity, device identity, conflicts, hardening

Focus: "Would I trust this app with real incident history on multiple devices?"

### LAN sync v2 (data-integrity rework)
- **Device identity**: every installation persists a UUID device id (never hostname-derived) used to authenticate sync traffic; friendly labels coming with it.
- **Trust gate**: the sync server answers `/wih/sync` (read/write) ONLY for explicitly trusted device ids; `/wih/ping` stays open for reachability checks but returns no data. An unknown laptop can no longer pull incident snapshots.
- **Pairing flow**: per-session pairing code; the requesting device sends address+code+identity; the request lands in an approval inbox — "Trust device" / "Deny" — never auto-trusted. Trusted-devices list supports **Remove trust** (revocation blocks future sync until re-paired).
- **Ack-based three-way merge replaces blind whole-record LWW**: a per-peer ack map records the last exchanged `updatedAt` per incident as the common ancestor. Only-peer-changed → accept. Only-local-changed → keep. BOTH changed → **SYNC CONFLICT** surfaced in Settings → LAN sync with "Use this device's / Use the peer's / Keep both" — nothing is silently overwritten, regardless of wall-clock skew (timestamps never decide conflicts; the ack ancestry does).
- **Tombstones**: deletions/archives propagate; a stale active copy from a peer can no longer resurrect a record deleted locally since the ack, and both-deleted stays deleted.
- **Timeline union**: accepting a peer record (or resolving a conflict as "theirs") preserves local-only timeline events by eventId — append-only history can never lose an event.
- **Provenance**: accepted records carry `syncSource` (device id, name, time) for audit.
- **Server hardening**: 8 MB body cap, 60 requests/minute rate limit, bounded reads, malformed payloads rejected without crashing the listener.
- Honest limits remain (docs/LAN_SYNC_SECURITY.md): text records only (media transfer deferred), plaintext HTTP inside the LAN (TLS-with-paired-certificates is the documented next step), no auto-discovery yet.

### Performance (10,000-incident dataset, measured)
- Dashboard ready: **~1.5 s** (previously froze >30 s — two O(n²) duplicate-pair loops replaced by a time-windowed near-linear detector with capped candidates).
- Incident list (first 100): ~0.5 s; language switch: ~0.3 s; map view: clustering bounds the DOM to ~120 cluster nodes at 10k.

### Added
- **Data health** (Settings → Storage & backups): incident/event/attachment counts, last backup with a two-week overdue reminder, unresolved sync-conflict count.
- **Migration fixtures & invariants tests**: legacy/sparse/malformed records merge and round-trip through IndexedDB unchanged; state invariants codified (status change appends without rewriting history, archive/unarchive append, trash preserves recoverability).
- **CI workflow** (`.github/workflows/ci.yml`): typecheck, tests, web build, license inventory on every push; desktop build on tags/dispatch.
- **docs**: LAN_SYNC_SECURITY.md (threat model + honest gaps), WINDOWS_CODE_SIGNING.md (signing requirements, no fake signing), CI_RELEASE_GATES.md, TESTING_GUIDE_REPORTER.md / TESTING_GUIDE_PROFESSIONAL.md (field test kits incl. the two-device dispatcher/responder scenario), THIRD_PARTY_LICENSES.md (SBOM-lite via scripts/license-inventory.mjs).

### Deferred (documented, not faked)
- Media/photo/video sync with resumable chunked transfer + SHA-256 verification; encrypted (TLS) LAN transport; offline map packs (PMTiles); NVDA screen-reader audit; 125/150% DPI audit.

### Tests
- 297 tests (was 274): conflict detection (including backward clock skew), tombstone no-resurrection, timeline union, demo exclusion, payload round-trips, state invariants, migration fixtures.

## 0.2.0-dev.14 — dashboard interaction pass, satellite view, onboarding & newcomer flow

### Changed
- **Map is a real-life view**: the professional map now defaults to **satellite imagery** (Esri World Imagery, attributed) with a Satellite/Streets toggle on the map itself; street tiles remain one tap away. CSP updated for the new host.
- **List/Map semantics fixed**: the List view no longer embeds a map (the full Map view is the map), and the sidebar "Map" item is only active on `/network?view=map` — clicking Response network no longer leaves Map highlighted.
- **Response flow stays in place**: clicking a stage (e.g. Reported) opens an inline, sorted case list (Earliest/Latest toggle) right in the widget instead of navigating away.
- **Needs Attention cards redesigned**: one uniform compact row (icon · count · reason · action) with the oldest-age line tucked underneath — consistent across cards.
- **Live activity is color-coded** by event kind (created / status change / handoff / custody / correction / closure).
- **Notifications moved to the top right** — the bell now lives in the desktop titlebar (right of the app name, left of the window controls); web/PWA gets a fixed top-right bell; mobile keeps the header bell. The sidebar footer is nav-only again.
- **Animations on by default**: the OS reduced-motion preference no longer silently downgrades the whole interface — it only tones down the decorative ambient background. Reduced/Off remain user choices.
- **Onboarding now includes a theme step** (language → region → profile → theme → privacy → ready) — pick your look before you start.

### Added
- **Test view** on the operations dashboard: one click mixes fictional demo incidents into every widget for training/rehearsal, with a visible banner; real records are never touched and demo labels persist in exports.
- **Reporter leaderboard** (reporter home): milestone levels (Newcomer → First Reporter → Helper → Guardian → Protector → Steward → Champion) with progress to the next level, plus friendly counts from devices you LAN-sync with. Deliberately local-network only — no global ranking exists anywhere.
- **Profile pictures with decorative circular borders**: upload a photo in Profile (auto-cropped to a circle), choose a ring style — Plain, **Leaves**, **Wood**, Rope, Stars — theme-colored; it replaces the paw in your sidebar identity.
- **Newcomer tutorial prompt**: first time on Home after onboarding, the app asks "New here?" and offers a two-minute guided tour — no Settings digging. "Maybe later" persists.
- **Analytics detail box**: click (or keyboard-activate) any dot in Reports over time for a card with the period's reported/resolved/still-open counts; the trend line is now smoothed.

### Tests
- 274 tests (was 267): leaderboard ranks/milestones/tie-breaks, satellite default provider + CSP host, photo border styles, tour-prompt gating, onboarding theme step.

## 0.2.0-dev.13 — notification fix, map views, Help Q&A, LAN sync v1

### Fixed
- **Notification panel clipped outside the window** — the popover is now positioned against the bell's viewport rect and clamped inside the window on open and on resize; no more text cut off at the screen edge.
- **Response flow looked empty** — the widget paired its pipeline with a huge blank area and a horizontal scrollbar. Stages now wrap, the content centers vertically, a hint line explains click-to-filter, and zero stages are visually quieted.
- **List/Map toggle appeared to do nothing** — the dashboard grid rendered in both modes with the map appended below the fold. List and Map are now exclusive views: Map shows the full-height map only.

### Added
- **Full-map incident panel**: the map destination now has a side panel listing every incident in view (animal, status chip, reference, age, location) with direct links — the "who/what/where" overlay requested for live operations.
- **Help Center Q&A expansion**: 17 new question-format articles across thin categories (reporter: account, immediate danger, editing after creation, unknown locations, media length, when a report resolves, who sees a report, moving computers, blank map; professional: Needs attention meaning, accepting incidents, marker shapes, "Not enough data yet", handoff contents, missing notifications, multiple roles, intake-note visibility).
- **LAN sync (v1, desktop-only)**: optional device-to-device incident exchange on the same local network. Each device runs a tiny HTTP server (`tiny_http`); peers are added by address (e.g. `http://192.168.1.20:47618`); the frontend pushes a snapshot, drains its inbox, and pull+pushes with configured peers every ~5 seconds. Merge is last-writer-wins by `updatedAt` matched by id; demo records never sync; HTTP happens in Rust (`ureq`) so CSP/mixed-content are untouched. Honest v1 limits, labeled in-UI: text records only (photo/video files not synced), manual address exchange (no auto-discovery), plain HTTP inside the LAN. Verified end-to-end in the real EXE (ping/snapshot/push→inbox round-trip).
- `withGlobalTauri` enabled for testability.

### Tests
- 267 tests (was 257): merge policy (add/newer-wins/skip/demo-exclusion), snapshot round-trip, Help Q&A presence.

## 0.2.0-dev.12 — shell feedback pass (bell, profile tab, EXE map CSP, logo toning)

Direct response to hands-on feedback from running the packaged EXE.

### Fixed
- **Map did not work in the desktop EXE (root cause: production CSP)** — the Tauri CSP (`img-src 'self' data: blob:`) blocked OpenStreetMap tile requests and MapLibre's blob workers in packaged builds while the browser dev server (no CSP) worked. CSP now explicitly allows `https://tile.openstreetmap.org` images/connections and `blob:` workers/scripts. **Verified in the real EXE**: tiles render on the dashboard map (screenshots/after/exe-map-check.png).
- **Settings and Profile both highlighted at once** — Profile lived at `/settings?section=profile`, so both nav items matched the same path. Profile is now its own destination: `/profile` renders the profile section standalone (no settings rail/search), and only one footer item is ever active.
- **Notification bell floated alone above the sidebar footer** — it now lives inside the footer navigation as a labeled "Notifications" item (Help · Notifications · Settings · Profile), badge included, keyboard/touch reachable like any nav item; the popover is unchanged.
- **Needs-attention "Review" action felt detached** (top-right corner) — the action now sits on the card's bottom row beside "Oldest: …", directly with the content it belongs to.
- Bell button inherited the browser's default gray background (first `<button>` to use the anchor-styled `nav-item` class) — background/border/font reset added.

### Changed
- **Logo toned down in-app**: the home hero brand tile and the large decorative watermark paw are gone — the product is identified by the desktop titlebar and the compact sidebar identity mark (plus onboarding/first-run), per the "brand confident, not repetitive" rule.

### Tests
- 257 passing (hero-watermark test inverted to assert the toned-down home; saved-view nav expectation updated for `/profile`).

## 0.2.0-dev.11 — new brand identity

### Added
- **New logo integrated everywhere.** The supplied artwork (bear paw filled with a mountain-forest scene) is now the product mark:
  - **In-app**: the canonical `BrandMark` paw keeps its tested geometry (4 toes, 4 claws, one pad — 257 tests still assert this) and the main pad now carries the scenic emblem drawn as theme-aware SVG (mountain ridge with snowcaps, serrated treeline, winding river). It uses only `--brand-icon-bg`/`--brand-icon-fg`, so it follows every theme and density automatically, and shows **no wordmark** inside the app. Verified in-app in dark and light themes.
  - **Outside the app**: `scripts/make-brand-assets.py` derives, from the supplied PNG (background removed, leaf of the wordmark masked): the full logo and the emblem-only mark in `branding/`, the Tauri icon set (`icon.ico` 16–256, PNG sizes, Windows Store logos), and PWA icons (`icon-192/512`, apple-touch, maskable). README header now uses the emblem.
- `branding/` folder: `wildlife-incident-handoff-logo.png` (full logo with wordmark, transparent background) and `wildlife-incident-handoff-emblem.png` (paw only).

### Changed
- PWA/favicon/desktop icons now carry the scenic emblem instead of the plain paw.

### Tests
- 257 passing — the paw geometry contract (4 toes / 4 claws / one `<path>` pad / symmetry) is unchanged by the scene, enforced by the existing tests.

## 0.2.0-dev.10 — GUI overhaul pass (judged from the rendered app)

This pass was driven by a **visual audit of the running application** (see
`docs/GUI_OVERHAUL_AUDIT.md`), not by a requirements checklist. Every major
screen was opened with realistic seeded data (11 Calgary incidents across all
response stages + a configured service area), judged, and rewritten where it
fell short of the quality bar. Map root causes are documented with
measurements in `docs/MAP_FAILURE_ANALYSIS.md`. Before/after screenshots:
`screenshots/before/`, `screenshots/after/`, narrative in
`docs/GUI_OVERHAUL_BEFORE_AFTER.md`.

### Fixed (root causes found by actually looking)
- **Blank desktop map (root cause)**: the compact dashboard map asked for `height:100%` inside an auto-height parent → 0-height canvas → nothing painted, while the identical mobile map worked. All map containers now use explicit pixel/viewport heights. Marker overlay additionally re-renders on `resize` and on a `requestAnimationFrame` pass so a missed `load` event can never leave it empty; marker clicks survive overlay re-creation via a stable `refId` select handler.
- **Duplicate map attribution** (style source + manual control both rendered).

### Professional workspace — operations console redesign
- **Grid holes eliminated**: Live activity no longer floats alone in a 12-column row; the pulse strip sits between the map row and the activity(4)+response-flow(8) pairing.
- **Map as the primary visual anchor**: dashboard map is a real 380 px panel; the "Open full map" destination is now a **real full-height map page** (`height: calc(100dvh - 240px)`) with a service-area summary, instead of a duplicate dashboard.
- **Service area ring** drawn on the map (geodesic polygon, subtle fill + dashed outline) so fit-to-area is visually verifiable.
- **Map inspector (P19)**: clicking a marker opens a lightweight in-map inspector (animal, status, age, location privacy, assignment, Open incident) — no modal.
- **Charts redesigned**: reports-over-time is now an area/line chart with gradient fill, crosshair + dot hover/focus readout and a padded x-axis (no clipped "Oct"); distributions use a stacked segmented bar plus a compact legend list; case aging is one proportional strip with 4 h+ emphasis.
- Needs-attention severity ramp (alert/warn/info left border), tighter live-activity rail with tabular clock column, wider content (`1560 px`) so the god's-eye layout breathes at 1920/1600.

### Design system & shell
- New type rhythm (stronger h1/h2/h3 contrast), thin theme-aware scrollbars, chart primitives (`.dist-row`, `.dist-dot`, aging levels), ops-panel hover states, KPI tabular numerals — appended as a coherent layer, pages no longer invent their own card/bar styling.
- Sidebar footer verified **inside bounds at 650/720/768/900/1080 px heights** (bell, Help, Settings, Profile never clip); scroll ownership re-verified by interaction at 390 px.

### Help Center — replaced
- Two-pane knowledge layout: persistent left rail (search, category nav, tutorials, glossary, support) + reading pane; articles open with related links, **Show me** tours, and an optional local "Was this helpful?" feedback. No card-grid-of-paragraphs.
- Support composer fixed: it referenced a nonexistent `support:` namespace, so the whole form fell back to English in every other language — now uses the `help` namespace (keys existed all along).

### Languages — finished, not hidden
- **German and Portuguese (Brazil) packs authored to 100% key coverage (872 keys each)** and promoted to production-selectable (5 selectable languages: en, fr, es, de, pt-BR). Machine-assisted; flagged for human review in docs.
- Pseudo-locale (zz-ZZ) sweep found and fixed hard-coded English: the Incidents/My reports heading, "Last update:" card prefix, map legend labels, dashboard duplicate notice, trend range buttons; plus the missing-key audit (13 `support:` keys) above.

### Performance (measured with 1,014 incidents on-device)
- Dashboard ready (13 widgets, analytics computed over all records): **~1.3 s**; incident list first 100 cards: **~0.46 s**; filters open: usable; language switch (lazy de pack): **~1.0 s**.
- **Dense clustering**: above 120 points, markers cluster at any zoom with a zoom-adaptive grid and singleton cells render as markers — map DOM stays bounded (1,014 points → 104 clusters + 9 markers) instead of 1,000+ marker nodes.

### Tests
- 257 tests (was 245): explicit map-height contract, overlay re-render contract, refId select handler, dense-clustering semantics + polygon ring, Help two-pane layout, 5-language catalog, and source-level sweeps asserting the pseudo-locale findings stay fixed.

## 0.2.0-dev.9 — operations customization, saved views, map provider registry

### Added
- **Dashboard customization (P80)**: every operations-dashboard widget (map, needs attention, live activity, operational pulse, response flow, performance, case aging, trend, distributions, workload) can be shown, hidden and reordered from a new **Customize** dialog; the layout persists locally (`network-dashboard-layout`). The service-area map cannot be hidden (primary operational context); **Needs Attention cannot be hidden silently** — a confirmation explains what is being turned off and how to restore it. "Restore recommended layout" resets to the role-recommended order and clears the saved override.
- **Saved views (P81)**: incident queues support named, locally-persisted filter sets. Save any combination of status/type/animal-group/date filters under a name ("New reports", "Waiting >2h", …), apply it with one click from the Saved views chip row, remove it with the chip's ×. Stored in the settings store (`incident-saved-views`), per device.
- **Map provider registry (P18/P19)**: tile providers are now declarative descriptors (`MAP_PROVIDERS`) with id, label, tile URLs, attribution, max zoom, network requirement, usage-policy note and a health-check URL — adding a provider no longer touches the MapLibre wiring. The MapLibre provider builds its style from the descriptor and exposes the descriptor on the `MapProvider` seam. Two providers ship: OpenStreetMap raster (default) and a new **offline basemap** that renders markers over a plain theme-aware background with **zero network requests** — turning online maps off in Settings now shows this proper offline map instead of a bare text list (P19: no silent hammering of public OSM tiles).
- Map settings read provider metadata from the registry; the connection test probes the descriptor's health-check URL, and the usage-policy note is displayed.

### Changed
- **Bounded incident-list rendering (P82)**: the incidents/reports list renders 100 cards at a time with an honest "Showing X of Y reports" + **Load more**, keeping the DOM bounded on very large local datasets (dashboard queue already capped at 50).
- **Live activity** is an independent dashboard widget (span 4) paired with the Response flow (span 8); Needs Attention keeps its dedicated column.
- The offline map basemap color follows the active theme instead of a hard-coded color.
- Notification panel body text wraps with `overflow-wrap:anywhere` so long content can never push the panel wide.

### Fixed
- Duplicate map attribution badges (the style source attribution plus a second manual control both rendered).

### Tests
- 243 tests (was 218): provider registry integrity (online+offline descriptors, no coordinate data, descriptor-driven styles, settings reads the registry), dashboard customization (hide without warning for optional widgets, explicit confirmation for Needs Attention, non-hideable map, restore clears persistence), saved views (save/apply/remove with local persistence), bounded rendering with Load more, and dev.9 localization keys resolving in en/fr/es (25 new keys per language).

## 0.2.0-dev.8 — product experience overhaul (coherence pass)

### Fixed
- **Mobile scrolling bug (root cause)**: at ≤860 px the shell switched to `display:block`, which removed the height constraint on `.main-area` so its `overflow-y:auto` never engaged and NOTHING could scroll. The flex column shell is preserved at every width — `.main-area` is the single bounded scroll owner. Verified scrolling at 320×568, 360×640, 390×844, 430×932.
- **Reporter tour target**: the tour's first step targeted a `hero` element removed in the dev.7 reporter home rebuild — now retargeted to the greeting heading.
- **Help-launched tours** navigate Home first so step 1 never fails (P69).

### Changed
- **Sidebar redesign (P3–P7)**: compact identity header (paw + name/organization + role + Professional Preview badge) — no repeated product name; primary navigation is work-only (reporter: Home / Report wildlife / My reports; professional: Dashboard / Response network / Map / Incidents / New intake); low-frequency destinations (Help, Settings, Profile + notification bell) moved to a sidebar footer. "Take the tour" removed from primary navigation (lives in Help → Tutorials).
- **Responsive sidebar (P5)**: below 860 px the sidebar becomes an off-canvas drawer (scrim + Esc + hamburger); bottom navigation mirrors the workspace nav.
- **Help Center redesign (P14–P19)**: categories, quick-help chips, article reading pane (no clipping), reporter/professional separation (reporters cannot switch to Professional Help; professionals can), honest support composer (prepare/copy/download bundle, GitHub links — never "message sent"), glossary retained.
- **Languages (P20–P26)**: only complete locales (en/fr/es) are selectable; the 10 partial languages are hidden behind a developer-preview toggle together with a new expanding **zz-ZZ pseudo-locale** that exposes hard-coded strings and layout clipping. Language-pack race audited (lazy packs load before switch; no reload needed).
- **Monochrome rework (P27/P28/P60)**: status glyphs complemented by border patterns (dashed = needs action, dotted = low priority) and contrast lifts for the faintest text tiers.
- **Response Network / queue (P29/P30/P63/P64)**: one consistent `IncidentQueueRow` (title + status inline, right-aligned action rail, stacked on narrow screens) plus a professional **table density** view (incident/animal/status/age/location/assignment/actions).
- **Operations dashboard (P40–P57)**: deliberate 12-column grid with the service-area map as primary context (span 8) beside Needs Attention + Live activity (span 4); command strip header (greeting, role, live badge, filters, list/map, Operations View); **Response flow pipeline** with per-stage counts and click-through; KPI tiles with honest vs-previous-period deltas (only when data supports them) and "oldest" context; data-quality card when animal group is missing for most reports; role-aware widget emphasis (dispatcher/coordinator → attention first; rehabilitator/vet → map first) — presentation only, nothing hidden, nothing authorized.
- **Map (P31–P39)**: camera auto-fits the configured service area (or the incident cluster) instead of starting at world zoom; client-side grid clustering at wide zooms (click to zoom in); redesigned offline fallback as a proper location list with privacy states and Retry; non-sensitive provider diagnostics (HTTP status/error class) surfaced in the fallback and Settings → Map.
- **Tutorials (P65–P77)**: target resolution never spotlights off-canvas drawer controls at mobile widths; Help articles launch tours directly ("Show me"); declarative step model retained (state machine was already generation-token based).
- **Modals (P81)**: dialogs cap at viewport height, scroll internally, become bottom sheets on small screens.
- Queue list renders are capped at 50 rows per group with an honest truncation note (large local datasets stay responsive).

### Added
- **Professional role architecture (P8–P12, P83–P87)**: eight roles with per-role verification requirements, local preview/pending states, active-role context, remove-with-confirmation management UI in Settings → Profile; `docs/ROLE_CAPABILITY_MATRIX.md`; authorization remains hard-unverified until a server issues claims.
- `docs/SECURITY_ARCHITECTURE.md` extended with the dev.8 threat-model notes (roles, support composer, map diagnostics, drawer scroll).

### Tests
- 218 tests (was 201): locale selectability, pseudo-locale expansion, RTL flag, role capability/verification completeness, preview-grants-nothing, capability matrix doc, map clustering (wide zoom clusters / close zoom does not), diagnostics coordinate-free, pipeline stage counts, honest KPI deltas, help isolation, mobile scroll fix, drawer CSS contract, defaults.

## 0.2.0-dev.7 — major product overhaul (two products, one data model)

### Added
- **Two genuinely different products**: Reporter (calm, safety-first) and Professional (operations command center) over one incident data model.
- **Reporter Home rebuilt**: greeting ("Welcome, [name]") up top, safety card ("Before you approach wildlife") moved to the very top BEFORE the report CTA, then Report wildlife, Latest active report (animal/status/latest update/useful next action/Continue), Your reports summary cards, drafts, recent reports, help links.
- **First-run experience rebuilt**: default path is reporter onboarding (language → country → optional profile → privacy explanation → ready). The professional path ("I work or volunteer in wildlife response") is a deliberate secondary choice and is labeled **Professional Preview** — it never claims verification.
- **Profile section fixed**: capitalized "Profile", person icon (was heart), expanded with organization, role, country/region, language context; explicit "Stored locally / pre-fills reports only / never shared automatically" notices.
- **International phone numbers** via libphonenumber-js: country-aware parsing, live validation, E.164 normalization on save with raw preservation for unparseable input; no +1 assumption.
- **Professional operations dashboard**: layered ops top bar (greeting, organization, live-indicator, honest "Network: local professional preview" badge), **Needs Attention** ops queue (unassigned, >2 h waits, handoffs awaiting acceptance, missing location, duplicates — icon/count/reason/severity/time/action, click-through), animated **KPI strip**, compact **geographic operations map** panel + Open full map, **Live activity** feed from real timeline events, response performance medians ("Not enough data yet" instead of fake zeros), visual case-aging strip, **Operations View** full-screen mode (Esc exits, never forced), unified dashboard filters (time, status, animal group, incident type, assigned/unassigned) applied to every widget.
- **Responder workload** table (assigned/active/completed-today) — capacity visibility only, explicitly no rankings or productivity scoring.
- **Reports over time modernized**: 24 h (hourly) / 7 d / 30 d / 90 d, y-axis gridlines, hover/focus value readout, accessible data-table fallback, legend; resolved series now uses structured resolution events.
- **Professional intake**: optional internal fields (source of report, organization, professional assessment, internal note) recorded as private notes — never a rewrite of public observations.
- **Photo AND video support**: MP4/WebM/MOV, capture or choose file, poster-frame thumbnails, duration badge, captions, no autoplay; large-video warnings with storage-quota awareness and a 500 MB hard limit; same attachment abstraction in wizard and incident Attachments tab.
- **Notification center**: bell icon with unread count, panel (mark read / clear / click-through to the incident), backed by a new IndexedDB `notifications` store (DB v2 migration).
- **Notification settings**: delivery (in-app), categories (reporter + professional), quiet hours (start/end, overnight-safe), sound; only features that actually exist.
- **Help Center** (replaces Examples & Tutorial in primary navigation): searchable role-aware topics (Reporter/Professional), Tutorials section, **Glossary** (single source, 15 terms) shared with contextual popovers, Support with privacy-safe diagnostics + GitHub links.
- **Reset & testing tools** (Settings → Advanced): Replay onboarding, Reset tutorial progress, Preview first-run (session-scoped, modifies nothing), Factory reset with backup-first warning and deliberate confirmation.
- **Error boundaries** around major routes: recoverable "We couldn't load this section" with Retry/Copy diagnostics.
- **Contextual help popovers rebuilt on Floating UI**: portal, flip/shift near edges, viewport-clipping-safe, scrollable.
- **Page/section animations**: 160–220 ms fade/translate, disabled under Reduced Motion/Off.
- **Reporter location confirmation**: "Use my location" now shows a preview (position, accuracy, precision choice) with Confirm / Adjust manually.
- **Map settings** (Settings → Map): provider info, connection test, online-maps toggle, tile-privacy explanation.
- **Structured analytics events**: `status_changed`, `handoff_started`, `handoff_completed`, `custody_changed` events now carry structured metadata; analytics prefers structured events with legacy text-parsing fallback; resolution timestamps derived from structured events.
- **Security documentation**: docs/SECURITY_ARCHITECTURE.md (threat model incl. future network layer) and docs/NETWORK_SECURITY_AND_AUTH_PLAN.md (server-side authorization architecture, honest no-backend labeling).

### Fixed
- **Green spotlight glow removed**: tour ring is now a neutral theme-aware 2 px outline.
- **Tutorial transition state centered**: navigating/waiting callout is centered, never anchored to stale geometry.
- **Desktop sidebar branding**: product name no longer repeats beside the native titlebar (paw + greeting/organization instead); Professional shows organization + Professional Preview badge.
- **Professional navigation priority**: Dashboard → Response network → Incidents → New incident → Help → Settings; reporters never see professional destinations.
- "Updated just now" footer now shows an actual clock tick.

### Tests
- 200 tests (was 176): international phone parsing/formatting, structured vs legacy analytics events, resolution timestamps, activity feed, workload, notifications store + quiet hours, authorization separation hard-unverifiable locally, first-run defaults, tutorial step contract (reporter/professional/demo), i18n completeness maintained (321 new keys per language, fr + es).

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
