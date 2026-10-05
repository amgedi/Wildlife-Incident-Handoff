# 0.3.0-dev.2 Baseline (acceptance pass)

Date: 2026-10-04 · Branch `0.3.0-overhaul` · HEAD after dev.1: `40445ad` (+ dev.2 fixes)

## Verified at pass start

| Check | Result |
| --- | --- |
| Version parity | 0.3.0-dev.1 across package.json / tauri.conf.json / Cargo.toml / src/version.ts |
| Frontend tests | 460/460 (dev.1 exit state) |
| Rust tests | 7/7 |
| Typecheck / web build | clean |
| Desktop EXE | 0.3.0-dev.1 EXE built; smoke 7/7; CDP QA on :9222 working |

## dev.2 immediate fixes already applied (owner feedback)

1. **Duplicate search affordances removed** — the extra "Search" button the
   palette binding rendered under the titlebar and the stray floating
   "Ctrl+K" chip are gone. One centered Search launcher in the titlebar.
2. **External paw branding restored** — the owner clarified the paw should be
   retired only INSIDE the app. The original paw artwork
   (installer/taskbar/Start Menu/PWA/favicon icons) was restored from the
   dev.19 checkpoint; the in-app mark remains the handoff relay.
   `scripts/make-relay-icons.py` is marked deprecated so it cannot overwrite
   the paw family again.

## Known gaps carried into dev.2 (to close or honestly classify)

1. Official tours not retargeted to 0.3 markup (this pass).
2. Portable EXE not rebuilt for 0.3 (this pass; portable = built release exe
   renamed, matching the dev.19 convention — same per-user data directory as
   the installed version).
3. No checksums/manifest for 0.3 artifacts yet (this pass).
4. NVDA not available (structural audit instead; honestly classified).
5. Real Windows DPI matrix not executable here (200% WebView zoom simulation
   instead; classified SIMULATED).
