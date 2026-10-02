# Feature Gap Audit — 0.2.0-dev.4

Deep product audit across both workspaces. Categories: IMPLEMENTED / SHOULD ADD NOW / SHOULD ADD LATER / REJECT / OUT OF SCOPE.

## IMPLEMENTED (shipped and verified)

| Area | Notes |
| --- | --- |
| Guided report wizard (10 steps) | Unknown-valid, autosaved drafts, review screen, sharing profiles |
| My Reports (search `/`, filters popover, chips, cards, ⋯ menus, Trash/Archive) | |
| Report updates (quick update types → timeline events) | dev.4 |
| Drafts visible in My Reports with Continue/Discard | dev.4 |
| Incident workspace (Overview/Timeline/Observations/Attachments/People/Details/Export) | URL-synchronized tabs |
| Handoffs & custody history | |
| Corrections with preserved history | |
| Privacy-aware exports (shareable/internal, print/PDF, text, HTML) | |
| Backups (versioned JSON, conflict-safe import) | |
| Geolocation capture with accuracy + denial fallback | |
| Guide Me (deterministic coach) | |
| Interface tour / guided-first-incident / demo tour (3 systems, one engine) | |
| Themes (10) + ambient animation (all themes) + reduced motion | |
| Localization (en/fr/es complete, 10 beta, live switching, RTL-ready) | |
| Professional dashboard + map (local preview, clearly labeled) | |
| PWA offline + Tauri desktop (installer, portable, single instance, native dialogs) | |
| Accessibility (keyboard, focus-visible, labels, reduced motion) | |
| Settings (appearance, workspace, privacy, storage health, diagnostics) | |
| Update checker (query only, never auto-install) | |
| Safety help card (region-neutral wording) | dev.4 |

## SHOULD ADD NOW (identified gaps, real workflow value)

1. **Reporter status vocabulary applied to filters** — the filter dropdown still uses professional labels in Reporter mode (cards already use reporter wording). Small, but should ship with the localization hardening pass.
2. **EXIF stripping on shareable exports** — spec §49. Feasible via canvas re-encode on export; not yet implemented (originals untouched, as promised).
3. **Location confirmation mini-map** — spec §50. After "Use my location", show a static confirmation with accuracy radius and "Use / adjust" options.
4. **Keyboard shortcuts help screen** — only `/` and Escape exist; Help → Keyboard shortcuts should list them (spec §55).
5. **Fr/es human review** — complete catalogs are machine-assisted; a native-speaker review pass is required before claiming "verified".

## RESOLVED IN 0.2.0-dev.6 (previously "add now")

- ✅ First-run language + contact profile (onboarding steps 1 & 4, Settings → Contact details).
- ✅ Reporter dashboard hierarchy: clickable summary cards (Awaiting response / In progress / Resolved) directly under the hero, deep-linking to filtered My Reports; zero-count cards visually quieter.
- ✅ Professional operational dashboard: KPI row (new/unassigned/assigned/in response/awaiting transfer/open), Needs-attention queue, aging buckets (<30min → 4+h), response-performance medians from event timestamps, reports-over-time chart (24h/7d/30d, lightweight SVG), status/animal/type distributions, transfer metrics. All via the `incidentAnalytics` service (deterministic, timezone-safe, local-data only, honestly labeled LOCAL PREVIEW, empty state when no data).
- ✅ Map reliability: states distinguished (loading / ready / offline / provider-failed / no-coordinates), Retry map button, offline position fallback listing stored coordinates per incident (no third-party tile caching).
- ✅ Guide Me integrity: readable per-step keys, complete en/fr/es catalogs, readiness guard (never flashes raw keys while a lazy pack loads).
- ✅ Selection chips: sentence case, visible ✓ selected state, draft persistence, "No action taken" exclusivity.

## SHOULD ADD LATER (real but deferred)

- Real response-network backend (auth/orgs/consent/audit) — dedicated milestone; preview is honest local-only.
- Optional secure sync between devices.
- Species taxonomy lookup (provider abstraction documented, no network calls yet).
- Configurable intake forms for organizations.
- Structured professional outcome fields (weight, condition codes) for rehabilitators.
- Signed auto-updater for the desktop app (documented; manual download for now).
- CSV incident index export.
- Additional complete languages (de, pt-BR, ar, zh-CN, ja, ko packs).

## REJECT / OUT OF SCOPE

- Veterinary diagnosis or treatment guidance (safety boundary).
- Emergency dispatch features or region-specific emergency numbers.
- Public posting of wildlife locations (sensitive-species protection).
- Surveillance/law-enforcement intelligence features in the professional workspace.
- Feature-count padding that doesn't serve recording/handoff/history/privacy.
- Forced accounts or cloud requirement — local-first is permanent.

## Reporter workflow audit (spec §45 checklist)

| Step | State |
| --- | --- |
| Understand the app | ✅ onboarding + tour + Guide Me + safety card |
| Report wildlife | ✅ wizard |
| Leave answers unknown | ✅ core design |
| Use current location | ✅ geolocation + accuracy |
| Adjust location | ⚠️ manual edit exists; mini-map confirmation deferred (above) |
| Add photos | ✅ wizard + attachments tab |
| Save draft / resume | ✅ autosave + drafts section (dev.4) |
| Create report | ✅ |
| See status | ✅ chips + reporter wording |
| Add update later | ✅ Update report dialog (dev.4) |
| Correct location | ✅ corrections tab + update dialog |
| Report animal moved / left | ✅ quick update types (dev.4) |
| Add new photo | ✅ attachments tab |
| Share/export | ✅ shareable exports |
| Understand privacy | ✅ review screen + export panel + safety notes |
| Get help | ✅ Guide Me + Help page + contextual help |
