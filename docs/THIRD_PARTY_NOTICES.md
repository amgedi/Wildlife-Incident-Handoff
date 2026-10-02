# Third-party notices

Wildlife Incident Handoff is licensed **AGPL-3.0-only**. It depends on the following third-party packages (build-time and runtime); all are compatible with distribution of an AGPL application.

Generated with `npx license-checker --summary` against `package-lock.json` (0.2.0-dev.3).

| License | Count | Notable packages |
| --- | --- | --- |
| MIT | 402 | react, react-dom, react-router-dom, vite, @vitejs/plugin-react, idb, maplibre-gl, @tauri-apps/api, @tauri-apps/cli |
| ISC | 26 | node utility libraries |
| Apache-2.0 | 10 | (incl. packages dual-licensed MIT OR Apache-2.0) |
| BSD-3-Clause / BSD-2-Clause | 17 | various |
| BlueOak-1.0.0 | 8 | various (OSI-approved, permissive) |
| CC-BY-4.0 | 1 | attribution-required data/documentation asset |
| UNLICENSED | 1 | this project's own lockfile entry |

Rust/Tauri side (`src-tauri/Cargo.toml`): tauri, tauri-plugin-dialog, tauri-plugin-fs, tauri-plugin-single-instance (all MIT or Apache-2.0).

Map tiles are served by OpenStreetMap contributors under ODbL 1.0 (attribution shown in the map UI). The bundled artwork in `public/icons/` is this project's own asset.

Permissive licenses (MIT/BSD/Apache/BlueOak/ISC) impose attribution obligations that are satisfied here; they do not conflict with AGPL-3.0 for this work's distribution.
