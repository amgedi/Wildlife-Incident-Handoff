# Desktop build (Tauri 2) — requires the Rust toolchain

The web app is the product; this folder wraps it as a native desktop application
(no terminal, no localhost, no visible server). The React bundle in `../dist`
loads directly from the executable.

## Prerequisites (developer machine only, NOT needed by end users)

1. Rust (rustup) — https://rustup.rs
2. Windows: MSVC build tools (Visual Studio Build Tools with "Desktop development with C++")
3. Node.js 20+ and `npm install` in the repository root

## Commands

```bash
npm run build                       # build the web bundle first
npx tauri build                     # produces:
#   src-tauri/target/release/bundle/nsis/Wildlife-Incident-Handoff-Setup-x.y.z.exe  (installer)
#   src-tauri/target/release/wildlife-incident-handoff.exe                          (portable binary)
npx tauri dev                       # desktop window on the dev server
```

## Release checklist

- [ ] `src-tauri/icons/` generated from the canonical bear-paw mark
      (`npx @tauri-apps/cli icon ../public/icons/icon-512.png`)
- [ ] Version bumped in `tauri.conf.json`, `Cargo.toml`, `package.json`
- [ ] Installer: Start Menu shortcut, Add/Remove Programs entry (NSIS handles both)
- [ ] Single-instance behavior verified (second launch focuses the existing window)
- [ ] Uninstall does NOT delete incident data in AppData without an explicit, warned choice
- [ ] About screen shows applicationVersion + build id + data schema version
