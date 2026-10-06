# Updater Channel Manifests

This folder is managed by the release workflow.

- `tester.json` points release-candidate users to the newest tester build.
- `latest.json` points stable users to the newest stable build.

The manifests contain only public release metadata, download URLs, and updater signatures. Private signing keys and passwords never belong here.

Do not hand-edit channel manifests during a normal release. The tag-triggered GitHub Actions workflow regenerates and publishes them after a successful signed build.

## RC2 bootstrap note

`0.3.0-rc.2` was released before the repository-hosted channel path was wired into the desktop binary. RC2 users may need one manual upgrade to the next release candidate. Builds after that correction read channel metadata from this folder.
