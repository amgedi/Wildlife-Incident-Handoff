# GitHub publish checklist

`gh` (GitHub CLI) was not available on this machine, so the repository could
not be created automatically. The local Git history is intact and ready.

## One-time publish (as owner `amgedi`)

1. Install GitHub CLI: `winget install GitHub.cli`, then `gh auth login`.
2. From the project root, create the public repository from the EXISTING
   local repository (do not init a second one):

   ```
   gh repo create amgedi/Wildlife-Incident-Handoff --public --source . --remote origin --push
   ```

3. Verify the description and topics on github.com:
   - Description: `Local-first, privacy-conscious software for clearer wildlife incident reporting, coordination, and handoffs.`
   - Website: none yet.

## Before pushing — security scrub (must be clean)

- No `.env`, tokens, passwords, API keys, or private keys in the tree
  (updater private key lives in `%USERPROFILE%\.tauri\`, outside the repo).
- No real sensitive wildlife coordinates, personal test records, or machine
  logs; screenshots use fictional demo data.
- `git log -p` spot-check for accidentally committed personal files.

## After publish

1. Add the two Actions secrets (see docs/UPDATER_KEY_SETUP.md).
2. Enable GitHub Sponsors (FUNDING.yml already points to amgedi).
3. Push the `v0.3.0-rc.2` tag to trigger the release workflow; label the
   release as "Pre-release — Tester release".
4. Upload/update the channel manifests (`tester.json`, later `latest.json`)
   as release assets once the workflow runs.
