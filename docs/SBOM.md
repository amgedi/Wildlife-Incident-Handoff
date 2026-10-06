# Software Bill of Materials

Wildlife Incident Handoff depends on both JavaScript packages and Rust crates.

The authoritative version inventory lives in the committed lockfiles:

- `package-lock.json`
- `launcher/ui/package-lock.json`
- `src-tauri/Cargo.lock`
- `launcher/src-tauri/Cargo.lock`

The repository also keeps [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for dependency-license review.

## Notable runtime components

| Component | Purpose | License family |
| --- | --- | --- |
| React and React DOM | Interface | MIT |
| React Router | Application routing | MIT |
| IndexedDB helpers | Local persistence | ISC / permissive |
| MapLibre GL JS | Interactive maps | BSD-3-Clause |
| i18next and react-i18next | Localization | MIT |
| Tauri 2 | Windows desktop shell | Apache-2.0 OR MIT |
| P-256 / ECDH crates | LAN device identity and key agreement | MIT OR Apache-2.0 |
| AES-GCM | LAN payload encryption | MIT OR Apache-2.0 |
| HKDF / SHA-256 | LAN channel-key derivation | MIT OR Apache-2.0 |

## Release expectation

Dependency inventories should be regenerated and reviewed for a stable release rather than treating this overview as a frozen package list.

The project license is `AGPL-3.0-only`. Third-party dependencies retain their own licenses.
