# dev.19 Fresh Baseline

Recorded at the start of the 0.2.0-dev.19 pass (2026-10-03), before any hardening edits.

## Version surfaces (all in agreement at baseline)

| Surface | Value |
|---|---|
| `package.json:4` | 0.2.0-dev.18 |
| `src-tauri/tauri.conf.json:4` | 0.2.0-dev.18 |
| `src-tauri/Cargo.toml:3` | 0.2.0-dev.18 |
| `src/version.ts:2` (`APP_VERSION`) | 0.2.0-dev.18 |

No script currently syncs these; parity is manual (root cause of the dev.18 mismatch).
dev.19 adds `scripts/set-version.mjs` + a parity test.

## Git / tests at baseline

- Commit `5d6b58c` (0.2.0-dev.18), clean working tree at start.
- `npm test`: **351/351 passing** (30 files). Typecheck clean.
- One date-boundary flake found and fixed during the pass: `incidentAnalytics.test.ts`
  "counts opened/resolved today" used `hoursAgo(1)`, which crosses local midnight
  between 00:00–01:00. Now anchored to local start-of-day.

## LAN sync (measured, src-tauri/src/lan_sync.rs + src/features/sync/lanSync.ts)

- Binds `0.0.0.0:<port>` (default 47618), tiny_http listener, stop via channel.
- Endpoints: `GET /wih/ping` (unauthenticated), `POST /wih/pair`, `GET/POST /wih/sync`.
- Auth: plaintext `X-WIH-Device` header vs in-memory trusted list. **Spoofable.**
- Pairing: 6-char code from `Math.random()`; request queued for manual approval (good),
  but identity is a stored `crypto.randomUUID()` — no key, no proof of possession.
- Transport: plain HTTP, `ureq` client 4–12s timeouts. **Plaintext on the LAN.**
- Rate limit 60 req/60s (global, not per-IP); 8 MiB body cap; malformed JSON handled.
- Merge v2: ack-based three-way with timeline union by eventId; both-changed → explicit
  conflict UI (capped 50). Legacy whole-record LWW still exported but unused by the round.
- Tombstones via `deletedAt`; demo records never sync.
- Media: **not synced** (metadata-only snapshot) — documented as deferred.
- Weaknesses confirmed: spoofable identity, plaintext transport, weak pairing RNG,
  no fingerprints, trust list in-memory only on Rust side, global rate limit,
  unauthenticated ping.

## Backup (src/storage/backupService.ts)

- Versioned JSON with manifest + per-record SHA-256 (dev.18); legacy importable.
- Staged validation before writes; writes via one IndexedDB transaction; never
  overwrites existing IDs.
- Media embedded as base64 in one JSON string — not streaming (multi-GB risk).

## Map / offline

- Offline packs evaluated in dev.18 (docs/OFFLINE_MAPS_EVALUATION.md), deferred.

## Accessibility / DPI / localization

- NVDA never systematically run. 125/150% DPI never systematically tested.
- 5 production languages (en, fr, es, de, pt-BR), machine-assisted; Arabic preview.

## Fixed immediately at pass start (user-reported)

1. Ambient background no longer force-disabled by OS reduced motion (CSS + JS default
   downgrade removed); motion `full` and ambient `on` stay the defaults.
2. Settings persistence moved out of the React state updater into a proper effect
   (double-invoke/discard could drop saves); `dataset.ambient` now actually applied
   (was missing from effect deps).
3. Settings → "Sync" nav label: missing i18n key rendered raw lowercase `sync`;
   added to all 5 locales.
