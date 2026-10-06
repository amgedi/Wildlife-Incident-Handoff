# Contributing to Wildlife Incident Handoff

By contributing, you agree that your contribution is licensed under `AGPL-3.0-only`.

Contributions are welcome from beginners, experienced developers, wildlife professionals, testers, accessibility reviewers, and people who simply found something confusing.

## Before you start

Please keep these rules in mind:

- use fictional or redacted incident data in tests, screenshots, and issues
- do not add real sensitive wildlife coordinates or private contact details
- do not add credentials, private keys, tokens, or machine-specific secrets
- do not turn uncertainty into a diagnosis or forced answer
- do not silently overwrite timeline history
- keep accessibility and keyboard use working

## Local setup

```bash
git clone https://github.com/YOUR-USERNAME/Wildlife-Incident-Handoff.git
cd Wildlife-Incident-Handoff
npm install
npm run dev
```

Desktop builds also require Rust and the Tauri 2 toolchain.

## Before opening a pull request

Run:

```bash
npm test
npm run typecheck
npm run build
```

If your change touches the desktop shell or LAN sync, run the relevant Rust tests too:

```bash
cargo test --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path launcher/src-tauri/Cargo.toml
```

## Product rules

### Unknown is valid

Do not force users to guess species, sex, age, cause, diagnosis, or outcome when the information is not known.

### Preserve history

Corrections should add context instead of pretending the previous value never existed.

### Observation before diagnosis

The product should help people record what they saw. It should not imply veterinary diagnosis, treatment authority, or professional verification that did not happen.

### Privacy is part of correctness

Shareable exports should remain conservative. Sensitive locations, private notes, and contact information must not leak through convenience features.

### Accessibility is a product requirement

Interactive controls need keyboard access and visible focus. Form fields need labels. Status cannot depend on color alone. Motion must respect reduced-motion preferences.

## Issues

Use the GitHub issue forms for bugs, tester feedback, and feature requests.

For a bug, include:

- app version
- Windows version
- display scaling when relevant
- steps to reproduce
- expected result
- actual result
- diagnostics that do not contain private case data

Never attach a screenshot containing real sensitive wildlife locations or personal details.

## Pull requests

Keep pull requests focused. Explain what problem is being solved, what changed, and how you tested it.

Branch naming examples:

- `feat/short-description`
- `fix/short-description`
- `docs/short-description`
- `a11y/short-description`

Short imperative commit messages are preferred, for example:

`fix: keep recent incidents above sidebar footer`

## Licensing and future commercial options

Code contributions are accepted under `AGPL-3.0-only`.

If the project ever adopts dual commercial licensing, contributor and relicensing terms should be reviewed before substantial third-party code is relicensed. This repository does not claim that contributing automatically grants rights beyond the license and contribution terms that actually apply.

## Questions

Open an issue if you are unsure where to start. Basic questions are welcome.
