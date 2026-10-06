# Tester Guide

Version: `0.3.0-rc.2`

Thanks for testing Wildlife Incident Handoff. You do not need programming tools to test the app.

## Start with fictional data

Please use Test View or clearly fictional information first.

Do not use real sensitive wildlife coordinates, real contact details, or private case notes in screenshots or public bug reports.

## What to try

A useful first test session looks like this:

1. install or run the portable build
2. complete onboarding
3. open Test View and load fictional incidents
4. create a new incident from the beginning
5. edit or correct something and check the timeline
6. record a handoff
7. open the map and move between incidents
8. export a shareable summary and inspect what was excluded
9. create a backup
10. close and reopen the app to confirm your local data remains

If you have two test devices on the same trusted local network, you can also try experimental LAN sync with fictional records.

## Things we especially want feedback on

- anything confusing on first launch
- anything that looks broken in a short or narrow window
- keyboard navigation problems
- focus getting lost after dialogs or navigation
- map controls that are hard to understand
- fields that feel like they force a guess
- handoff steps that are unclear
- export privacy that is surprising
- backup or restore behavior that feels risky
- updater or launcher behavior that is unclear

## Reporting a bug

Use the GitHub bug form:

https://github.com/amgedi/Wildlife-Incident-Handoff/issues/new?template=bug_report.yml

Include the app version, Windows version, steps to reproduce, expected result, actual result, and a screenshot only if it contains fictional or redacted data.

## SmartScreen

The RC installer is not Authenticode signed yet, so Windows may show a SmartScreen warning. This is expected for the current tester build.

## Updater note

RC2 has a known updater bootstrap limitation. One manual upgrade may be required before automatic tester-channel updates work end to end. See [KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md).

## Not emergency software

This tester build is not emergency dispatch, veterinary diagnosis, or treatment guidance. If a real situation involves immediate danger to people, use the appropriate local emergency or wildlife-response service instead of relying on the app.
