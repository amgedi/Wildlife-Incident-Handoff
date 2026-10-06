# Reporter Testing Guide

Estimated time: 10 to 15 minutes.

Use Test View or clearly fictional data. Do not enter real personal details or sensitive wildlife locations.

## Walkthrough

1. Open Wildlife Incident Handoff and enter the reporting workflow.
2. Create a fictional incident, for example a small bird found beside a road.
3. Leave at least one animal detail unknown on purpose. Confirm the app accepts that without forcing a guess.
4. Add a location description. Test Exact, Approximate, or Sensitive location behavior with fictional coordinates if you want to review privacy handling.
5. Add one observation using plain language, such as `right wing hangs lower than left`.
6. Add a safe test image if available.
7. Review the incident before saving. Check that Known, Unknown, and Not provided are understandable.
8. Open the saved incident and inspect the timeline.
9. Make a correction or add a new observation. Confirm the history grows instead of silently replacing the earlier information.
10. Record a fictional handoff and check that responsibility and condition at transfer are understandable.
11. Create a shareable export. Confirm private contacts, private notes, and precise coordinates are excluded when they should be.
12. Create a backup and make sure the app clearly distinguishes a full backup from a shareable summary.
13. Resize the desktop window and confirm navigation remains usable.
14. Close and reopen the app. Confirm the fictional incident is still there.

## Things to notice

- Did any field make you feel like you had to guess?
- Was it obvious what would be shared in an export?
- Was it clear where to record a correction versus a new observation?
- Did the handoff flow make sense without explanation?
- Was anything visually overwhelming or too hidden?
- Did any button make you hesitate because the result was unclear?

## Report feedback

Use the [tester feedback form](https://github.com/amgedi/Wildlife-Incident-Handoff/issues/new?template=tester_feedback.yml) for general impressions or the [bug form](https://github.com/amgedi/Wildlife-Incident-Handoff/issues/new?template=bug_report.yml) for a reproducible problem.
