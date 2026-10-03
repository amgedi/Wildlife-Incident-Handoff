# CI / Release Gates

GitHub Actions workflow: `.github/workflows/ci.yml` (added in 0.2.0-dev.15).

Gates on every push/PR:
1. `npm ci`
2. `npx tsc --noEmit` (strict typecheck)
3. `npm test` (full Vitest suite — includes localization completeness,
   sync merge, migration fixtures, state invariants)
4. `npm run build` (web/PWA production build)

Desktop (Tauri) build runs on `workflow_dispatch` / tags with a Windows
runner; artifacts upload to the run. Release signing is documented in
docs/WINDOWS_CODE_SIGNING.md and is intentionally NOT wired until a
certificate exists.

License gate: `scripts/license-inventory.mjs` writes
`docs/THIRD_PARTY_LICENSES.md` (dependency inventory / SBOM-lite) — run it
before each release and commit the result.
