# 0.3.0 Overhaul — Fresh Audit Baseline

Audit date: 2026-10-04 · Auditor: fresh 0.3 development session · Branch: `0.3.0-overhaul`

## Checkpoint

- dev.19 preserved at commit `0331991` on `main`, tagged **`v0.2.0-dev.19-checkpoint`** (recoverable).
- All 0.3 work happens on branch **`0.3.0-overhaul`**. dev.19 history untouched.

## Confirmed baseline (verified this session, not from the handoff prompt)

| Check | Result |
| --- | --- |
| Version | `0.2.0-dev.19` across package.json / tauri.conf.json / Cargo.toml / src/version.ts (parity OK) |
| Git status | clean, `main` at `0331991` |
| Frontend tests | **379/379 passed** (33 files, Vitest) |
| Rust tests | **7/7 passed** (LAN crypto) |
| Typecheck | clean (`tsc --noEmit`) |
| Web build | clean (`vite build`, SW generated) |
| Desktop EXE | `release/desktop/Wildlife-Incident-Handoff-Portable-0.2.0-dev.19.exe` launches; CDP QA on :9222 works |

## Before screenshots

Captured from the real dev.19 portable EXE (WebView2 CDP), stored in `screenshots/v030-before/`:
home, network (dashboard), network-map, incidents, new-intake, settings, profile, help, network-2.

Observed visual problems (confirmed from screenshots):
- Needs Attention renders as narrow cards stacked down the left column with the rest of the dashboard black/empty.
- Home is a large mostly-empty hero; profile identity shows paw avatar; duplicated "Professional Preview" badges.
- Test-view notice is a giant text slab.

## Architecture findings (source of truth for the overhaul)

1. **Routes** (`src/App.tsx:195-207`): `/` Home, `/network` (dashboard), `/network?view=map` (Map), `/incidents`, `/incidents/new`, `/incidents/:id`, `/help`, `/settings`, `/settings?section=profile`. Sidebar inline in App.tsx; active-state for Map vs Network manually parsed from `location.search` (`navIsActive`, App.tsx:124-128).
2. **Map navigation bug root cause**: `NetworkPage.tsx` keeps `tab` state initialized once from searchParams (line ~76) and syncs via an effect depending on the whole `searchParams` object (lines ~109-117) — state and URL fight each other; navigating to `/network?view=map` from within `/network` can leave tab on "list".
3. **Response-flow count/list divergence (the correctness bug)**:
   - Stage counts: `analytics.getPipelineCounts(filtered)` (`src/features/network/incidentAnalytics.ts:403`) — applies its own `!deletedAt && !archivedAt && !isDemo` filter and hardcodes stages.
   - Stage list: inline `StageCaseList` (`NetworkPage.tsx:1005-1045`) re-queries via `useIncidents()` with its own duplicate filter copy.
   - They disagree on dashboard filters (counts respect `filtered`, list ignores them) and on demo inclusion (Test View mixes demo incidents into `filtered` with `isDemo:false` faked, but `getPipelineCounts` re-filters `!isDemo`). Hence "Pickup shows 3 → selecting shows 0 cases".
4. **No shared incident store**: every widget/page re-fetches via `useIncidents()` → `getAllIncidents()`; refactoring opportunity during rebuild.
5. **Profile**: `src/components/ProfilePhoto.tsx` falls back to paw (`BearPawMark`); ring styles `none|leaves|wood|rope|stars` in ProfilePhoto; profile UI in `SettingsPage.tsx` (`ProfileSection`, line ~934). Fields duplicate "(optional)" labels.
6. **Themes**: `src/styles/tokens.css` (~800 lines) — 10 themes; density/motion/ambient via `data-*` attributes applied in `AppContext.tsx:249-253`. No window material (mica/acrylic) support yet. `mono-dark` needs legibility fix.
7. **Desktop shell**: custom TitleBar (`src/components/TitleBar.tsx`), frameless window created in Rust (`main.rs:43-48`); icons from `branding/` via scripts; paw is the app mark (`BrandMark.tsx`).
8. **i18n**: namespaces in `src/i18n/locales/en/*.json`, lazy packs de/es/fr/pt-BR, completeness tests (`completeness.test.ts`, `localesParity.test.ts`) — any new UI string must go through namespaces.
9. **Tests**: Vitest + Testing Library, `src/**/*.test.tsx`; perf budget tests in `src/features/perf10k.test.ts`; demo data `src/features/tutorial/demoData.ts`; QA drivers `qa/cdp.mjs`, `qa/tour-qa.mjs`, `scripts/desktop-smoke.mjs` (7 checks, CDP :9222).
10. **Version**: `npm run set-version X` writes 4 surfaces + parity test.

## Overhaul plan (maps to spec items)

Pass 1 — correctness: canonical response-flow query + invariant tests (spec 3-5), map navigation fix (28), nav contract tests (29-30).
Pass 2 — professional workspace: response flow v3 UI (6-12), Needs Attention operations queue (13-17), Dashboard command center + greeting (18-23, 110-112), Response Network v3 (24-26).
Pass 3 — Incidents command center (31-40), Live Activity feed (41-45), analytics redesign (46-53).
Pass 4 — Profile overhaul (54-61), new app mark (59), Country profile (62-67), Device center (68-74).
Pass 5 — Report integrity (75-83), Recognition (84-88).
Pass 6 — Themes/materials/ambient/motion (89-98), titlebar/sidebar/command palette (99-106, 120-121), modern controls audit (122-126).
Pass 7 — Settings/Help/tutorials/demo data (113-119, 140-144), regressions (129-138), after screenshots + docs (145-154), version bump (155-156).

## Constraints carried from dev.19 (must not regress)

- LAN sync v3 security tests, backup SHA-256/staged restore, privacy rules (sensitive locations, avatar excluded from exports/diagnostics), 10k perf budgets, tour zero-auto-skip contract, localization completeness gate, honest verification wording, local-first (no fake cloud/accounts/capacity), no leaderboards / no AI urgency.
