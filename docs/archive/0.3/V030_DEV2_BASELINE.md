# 0.3.0-dev.2 Baseline

This archived note is retained because migration regression tests use it as the historical downgrade-honesty marker for the 0.3 transition.

Date: 2026-10-04

## Verified at pass start

| Check | Result |
| --- | --- |
| Version parity | 0.3.0-dev.1 across package.json, tauri.conf.json, Cargo.toml, and src/version.ts |
| Frontend tests | 460/460 at the dev.1 exit state |
| Rust tests | 7/7 |
| Typecheck and web build | clean |
| Desktop EXE | 0.3.0-dev.1 built; smoke 7/7; desktop QA available |

## Historical compatibility note

The 0.3 fields were designed as additive fields so earlier 0.2 builds could ignore values they did not understand. Newer documentation and behavior were not guaranteed to be readable by an older development build. This file remains in the archive to keep that migration expectation explicit and testable.

## Known validation gaps at that checkpoint

1. Official tours still needed retargeting to the 0.3 markup.
2. Portable packaging still needed a fresh 0.3 build.
3. Checksums and release manifests had not yet been produced for 0.3 artifacts.
4. NVDA was unavailable, so accessibility validation was structural rather than a claimed screen-reader pass.
5. The full physical Windows DPI matrix was unavailable, so high-scaling behavior was simulated and labeled as such.
