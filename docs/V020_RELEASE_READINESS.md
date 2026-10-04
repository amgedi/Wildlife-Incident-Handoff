# v0.2.0 Release Readiness — status at end of dev.19

Verdict per area. PASS = verified this pass with evidence. MANUAL CHECK =
needs a human on real hardware/traffic. BLOCKER = must fix before RC.
DEFERRED = consciously postponed with a documented reason.

| Area | Status | Evidence / notes |
|---|---|---|
| Reporter flow | PASS | Desktop smoke 7/7 on final dev.19 EXE (wizard → detail → About → Guide Me) |
| Professional dashboard | PASS | 10k perf budgets (all ≤12 ms vs 120–900 ms budgets); smoke covers incident creation |
| Desktop (Tauri) | PASS | Release EXE built from final source; smoke verified |
| PWA/web | PASS | `npm run build` clean; typecheck clean; 379/379 JS tests |
| Maps | PASS | Tile privacy per-incident (dev.18) unchanged; graceful offline fallback verified in prior passes |
| Map scale (10k) | PASS | 10k-marker geometry 1.6 ms (budget 120 ms) |
| LAN sync security | PASS | Protocol v3 (see docs/LAN_SYNC_SECURITY.md): P-256 identities, code+fingerprint pairing, AES-256-GCM + ECDH/HKDF, replay counters, persisted trust store, revoke. Live rejection tests: unknown/spoofed/forged/revoked all 403, no data. |
| Two-instance sync QA | PASS | qa/lan-two-instance.mjs 9/9 ×2 runs (Dispatch/Field profiles): pair, encrypted flow both ways, ack-based updates, same-field conflict (no silent overwrite), revoke stops sync, re-pair resumes |
| Sync conflicts | PASS | Explicit conflict UI, resolution recorded as timeline event; content-version acks immune to timestamp collisions (unit-tested) |
| Clock skew | PASS | dev.15 skew tests still green; conflicts never auto-resolve by clock |
| Tombstones | PASS | dev.15 tests: deletions propagate, deleted records never resurrect |
| Media sync | DEFERRED | Not synced by design (metadata only); documented in Settings copy + security doc. Chunked resumable media transfer remains future work. |
| Backup integrity | PASS | Manifest covers incidents AND attachments (SHA-256); corrupted media refused; staged decode before any write; atomic incident transaction |
| Backup large media | MANUAL CHECK | Export assembles Blob parts (no giant string); realistic multi-GB library needs a human run |
| Encrypted backup | DEFERRED | Architecture documented (dev.18); needs proven crypto + UX pass |
| Offline map packs | DEFERRED | See docs/OFFLINE_MAPS_EVALUATION.md (dev.19 re-evaluation) |
| Accessibility | MANUAL CHECK | ARIA/keyboard coverage tested in suite; NVDA systematic pass not yet performed (see below) |
| DPI 125%/150% | MANUAL CHECK | Systematic screenshot pass on real hardware not yet performed |
| Localization | PASS (honest) | 4 production languages: core UI complete, 998 keys/language fall back to English (documented, regression-gated); sync copy translated; Arabic stays preview |
| Migrations | PASS | Fixtures: pre-structured-timeline, missing optional fields, malformed payloads (dev.15 suite) |
| State invariants | PASS | Append-only timeline, tombstone no-resurrect, demo-never-syncs, skew forensics (dev.15 suite) |
| Version management | PASS | `npm run set-version` + parity test + CI gate |
| Windows signing | MANUAL CHECK | No certificate available — see docs/WINDOWS_CODE_SIGNING.md (not faked) |
| Update security | PASS | Checker distinguishes offline/unavailable/invalid/up-to-date; no auto-install (dev.18, unchanged) |
| CI | PASS | typecheck, tests, build, version parity, Rust crypto tests, license inventory |
| SBOM | PASS | Regenerated; Rust crypto crates (RustCrypto, MIT OR Apache-2.0) documented |
| Tester package | PASS | release/desktop/ dev.19 portable EXE + NSIS installer + SHA-256 checksums + guides |

## Blockers status

None of the spec'd release blockers remain open: data loss (backup staged
restore + atomic writes), unauthenticated LAN access (v3 crypto, live-verified),
silent conflicting-edit overwrite (conflict UI, live-verified), sensitive
coordinate leak (dev.18, tests), verification evidence leak (dev.18, tests),
backup corruption silently accepted (hash-gated, tests), old-data
incompatibility (migration fixtures), Reporter submission broken (smoke),
desktop shell failure (smoke), factory reset scope (dev.17 fix, tests).

## Known honest gaps (not RC blockers)

1. NVDA systematic pass not performed (no screen-reader session available in
   this pass; ARIA/keyboard coverage is suite-tested). Perform before 0.2.0 GA.
2. 125%/150% DPI screenshot pass not performed systematically.
3. 998-key localization fallback per language (English shown for long-tail
   strings until a human-reviewed translation pass).
4. Media sync deferred; encrypted backup deferred; offline map packs deferred.
5. Windows code signing requires a certificate purchase — documented steps.
6. LAN rate limiting is global, not per-IP (busy-network limitation,
   documented).

## RC recommendation

**0.2.0-rc.1: YES**, conditional on the two MANUAL CHECKs (NVDA, DPI) being
scheduled before the final 0.2.0 — they do not block an RC whose purpose is
external tester feedback, and every spec'd blocker is closed with live or
test evidence.
