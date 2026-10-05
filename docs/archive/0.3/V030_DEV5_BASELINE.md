# 0.3.0-dev.5 Baseline (captured 2026-10-04)

## Source of truth confirmed

| Item | Value |
| --- | --- |
| Last reported version | **0.3.0-dev.4** — confirmed in `package.json`, `src-tauri/tauri.conf.json`, `src/version.ts`, git tag `v0.3.0-dev.4` |
| HEAD commit | `da3a0a3` (fix(0.3.0-dev.4): final parity) — matches reported |
| Reported frontend build id | `befa38842948` — confirmed: `src/build-identity.ts` (generated at build time) carries `BUILD_COMMIT da3a0a3`, `FRONTEND_BUILD_ID befa38842948`, built `2026-10-04 22:42` |
| Packaged artifacts | `release/desktop/Wildlife-Incident-Handoff-Portable-0.3.0-dev.4.exe`, `release/desktop/Wildlife-Incident-Handoff-Setup-0.3.0-dev.4.exe` |

Uncommitted working-tree noise at session start: regenerated `src/build-identity.ts`
(reflects the packaged dev.4 identity — benign) and two re-captured
`screenshots/archive/v030-dev4-after/*.png` binaries.

## Baseline verification performed this session

- Frontend tests: **585/585 passed** (57 files, vitest).
- Rust tests: **7/7 passed** (`cargo test` in `src-tauri`).
- Typecheck: **clean** (`tsc --noEmit`, exit 0).
- Packaged dev.4 portable EXE launched with CDP (`WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9222`, profile `qa-dev5-base`).
- Desktop smoke against the **packaged EXE**: **7/7 PASS**
  (wizard reaches review; incident created + detail opens WIH-2026-000001; summary preserved; About version 0.3.0-dev.4; About build id; About schema v1; Guide Me entry).
- Runtime About identity = source identity (dev.4 @ `da3a0a3`). Build is not stale.
- Baseline screenshots captured to `screenshots/archive/v030-dev5-before/`.

## Regression found during baseline (owner report #27, confirmed)

Onboarding **Next button on the privacy screen is dead** — reproduced in the
packaged dev.4 EXE: 20 DOM clicks on Next stayed on the same step.

Root cause in source: `src/features/onboarding/OnboardingPage.tsx` stage 4
(privacy/local-first screen) rendered
`onClick={() => setStage(4)}` — the Next button set the stage to itself and
could never advance to stage 5 ("You're ready"). **Fixed** at baseline (now
`setStage(5)`); fix will be verified in the rebuilt EXE. The running dev.4 EXE
still exhibits the bug (worked around in QA by "Skip setup").

Also noted: onboarding theme picker lists stale pre-0.3.0 theme names
(Forest Dark / Midnight / Warm Field …) — Part XIV scope.

## Baseline test profile

QA profile `qa-dev5-base` was onboarded (via Skip) and contains smoke incident
WIH-2026-000001. Fresh-profile onboarding runs for dev.5 QA must use new
`WIH_PROFILE` values.
