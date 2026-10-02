# Security Policy

## Reporting a vulnerability

Wildlife Incident Handoff is a local-first browser application with no server component, which shrinks the attack surface considerably — but browser-side vulnerabilities still matter (script injection through imported files, unsafe attachment handling, storage manipulation, PWA/service-worker issues).

**Please report privately** via GitHub's "Report a vulnerability" (Security tab), or by opening an issue *without technical detail* asking for a private contact. Please do **not** open a public issue with exploit details.

## What matters most

- **Never include real sensitive data in reports.** No real wildlife locations (some species are poaching targets), no real personal contact details, no real case narratives. Use the fictional demo data.
- The highest-risk areas are: the backup **import** path (untrusted JSON), **attachment** handling (file names, blobs), and any future feature that renders or transmits user content.

## Supported versions

| Version | Supported |
| --- | --- |
| 0.1.x | ✅ |

## Design commitments that reduce risk

- All data stays in the browser; there is no account, server, or telemetry.
- Imports are validated and are never silently applied — ID conflicts are skipped and reported.
- User text is rendered through React's escaping; no `innerHTML` with user data anywhere.
- File names are sanitized before storage and download.
