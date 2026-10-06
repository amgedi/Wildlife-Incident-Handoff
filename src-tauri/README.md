# Desktop Build

This folder wraps the React application as a Windows desktop app using Tauri 2.

End users do not need Node.js, Rust, a terminal, or a local web server. Release builds load the bundled frontend directly inside the desktop application.

## Developer prerequisites

- Node.js 20+
- npm
- Rust through rustup
- Visual Studio Build Tools with Desktop development with C++ on Windows

## Development

From the repository root:

```bash
npm install
npm run dev
npx tauri dev
```

## Production build

```bash
npm run typecheck
npm test
npm run tauri build
```

Tauri writes generated desktop artifacts under `src-tauri/target/`. Those artifacts are ignored by Git and public binaries are distributed through GitHub Releases.

## Desktop behavior to verify

Before promoting a release, verify:

- the application opens as a native window without a terminal
- a second normal launch focuses the existing instance
- install and uninstall entries use the correct product name and version
- uninstall does not silently remove incident records
- window size and position restore safely
- short and narrow windows keep navigation usable
- native file dialogs work for backup and export flows
- update checks fail safely when offline
- signed update verification is active
- fictional incidents persist across a normal restart

## App data

The desktop app stores its local data under the application data directory for `org.wildlifeincidenthandoff.app`.

Do not commit local app data, private LAN identity files, updater signing keys, or machine-specific diagnostic dumps to the repository.
