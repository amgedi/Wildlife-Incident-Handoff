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

## Verified on the first real build (Windows x64)

- `npx tauri build` produced both the portable exe and the NSIS installer.
- Launch: native window, no terminal, no browser; bear-paw icon on exe/title bar/taskbar.
- Smoke test (scripts/desktop-smoke.mjs, via WebView2 remote debugging):
  onboarding, guided wizard incident creation, About build identity,
  Guide Me entry all pass; incidents persist across restart.
- Single instance: second launch focuses the existing window.
- Installer: Start Menu shortcut + Add/Remove Programs entry with correct
  name/version; silent install/uninstall (/S) verified; incident data
  (%LOCALAPPDATA%\org.wildlifeincidenthandoff.app) survives uninstall.

## Release checklist

- [ ] `src-tauri/icons/` generated from the canonical bear-paw mark
      (`npx @tauri-apps/cli icon ../public/icons/icon-512.png`)
- [ ] Version bumped in `tauri.conf.json`, `Cargo.toml`, `package.json`
- [ ] Installer: Start Menu shortcut, Add/Remove Programs entry (NSIS handles both)
- [ ] Single-instance behavior verified (second launch focuses the existing window)
- [ ] Uninstall does NOT delete incident data in AppData without an explicit, warned choice
- [ ] About screen shows applicationVersion + build id + data schema version
