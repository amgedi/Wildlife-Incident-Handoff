# Project Structure

Wildlife Incident Handoff is organized so product code, desktop packaging, documentation, and test tooling stay separate.

```text
.github/                 GitHub Actions, issue forms, funding, community files
branding/                public branding and README artwork
docs/                    public product, security, testing, and architecture docs
launcher/                companion launcher frontend and Tauri shell
public/                  static web assets
qa/                      active QA and smoke-test helpers
screenshots/current/     current fictional-data product screenshots
scripts/                 build, packaging, release, and maintenance scripts
src/                     React application
src-tauri/               Tauri 2 desktop shell and native services
tests/                   additional test fixtures where applicable
updates/                 public updater channel manifests
```

## Main application

`src/` contains the React application, local storage services, incident workflows, map UI, settings, exports, tutorials, accessibility behavior, and tests.

`src-tauri/` wraps that app as a Windows desktop application and contains native services such as window management, dialogs, file access, updater integration, and optional LAN sync.

## Companion launcher

`launcher/ui/` contains the launcher interface.

`launcher/src-tauri/` contains its native shell and build logic.

The generated root launcher EXE is intentionally ignored by Git. Downloadable binaries belong in GitHub Releases instead of normal source history.

## Documentation

The public docs focus on things a tester, contributor, reviewer, or security researcher may actually need. Internal implementation scratchpads, temporary cleanup reports, and historical QA dumps are not part of the public documentation set.

## Generated files

These are not source and should remain untracked:

- `node_modules/`
- `dist/`
- Rust `target/` directories
- local release output
- root launcher binaries
- local environment files
- private signing material
