# SBOM — Software Bill of Materials (inventory + licenses)

Regenerated each release by `scripts/license-inventory.mjs` (npm production dependencies) and reviewed together with the Rust/Cargo side (`src-tauri/Cargo.toml` + `Cargo.lock`) documented at the bottom of `THIRD_PARTY_LICENSES.md`. Format: simplified SPDX-style inventory (name, version, license).

Generated 2026-10-04 (dev.19 pass) — application version 0.2.0-dev.18 → 0.2.0-dev.19.
Application license: AGPL-3.0-only. Runtime dependencies:

| Package | Version | License |
|---|---|---|
| @floating-ui/dom | 1.8.0 | MIT |
| @tauri-apps/api | 2.12.1 | Apache-2.0 OR MIT |
| @tauri-apps/plugin-notification | 2.5.1 | MIT OR Apache-2.0 |
| i18next | 26.4.2 | MIT |
| idb | 8.0.3 | ISC |
| libphonenumber-js | 1.13.14 | MIT |
| maplibre-gl | 6.11.2 | BSD-3-Clause |
| react | 18.3.1 | MIT |
| react-dom | 18.3.1 | MIT |
| react-i18next | 17.0.15 | MIT |
| react-router-dom | 6.30.6 | MIT |

Transitive packages present in node_modules: 333.

Notable runtime components and their licenses:
- React, React DOM — MIT
- MapLibre GL JS — BSD-3-Clause
- i18next, react-i18next — MIT
- idb — ISC
- libphonenumber-js — MIT
- @tauri-apps/api — Apache-2.0 OR MIT
- Floating UI (DOM) — MIT

Desktop (Rust) runtime: Tauri (Apache-2.0 OR MIT), tiny_http (MIT/Apache-2.0), ureq (MIT/Apache-2.0), serde (MIT/Apache-2.0), serde_json (MIT/Apache-2.0).

### Rust crates added in dev.19 (LAN sync protocol v3 — src-tauri)

All from the RustCrypto ecosystem, dual-licensed MIT OR Apache-2.0:

| Crate | Version | Purpose | License |
|---|---|---|---|
| p256 (+ecdsa/elliptic-curve/ecdh deps) | 0.13.2 | P-256 device identity keypair + ECDH | MIT OR Apache-2.0 |
| aes-gcm (+aead/cipher/poly1305) | 0.10.3 | AES-256-GCM envelope encryption | MIT OR Apache-2.0 |
| hkdf (+hmac/sha2/digest) | 0.12.4 | HKDF-SHA256 channel-key derivation | MIT OR Apache-2.0 |
| rand / rand_core / getrandom | 0.8.8 | OS CSPRNG (keys, nonces, pairing codes) | MIT OR Apache-2.0 |

Full transitive Cargo inventory: see `src-tauri/Cargo.lock` (committed).

