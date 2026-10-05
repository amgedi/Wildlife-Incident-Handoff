# FEEDBACK GUIDE — 0.3.0-rc.1

You are the first external testers. Every report helps — including "this was
confusing" and "it worked fine".

## What to include in a bug report

1. **What you did** (e.g., "opened Map, clicked a row in the right-hand list").
2. **What you expected** vs **what happened**.
3. **Version info** — Settings → About → copy the diagnostics text and paste it
   into your report. It contains version/build identity only.
4. A screenshot if something looked broken.

There is no in-app submission (nothing is sent automatically). Send reports
through the channel the project owner gave you, or file an issue in this
project's repository using the bug template.

## High-priority categories

- Anything that looks like **data loss** or a crash.
- Anything where a **sensitive/approximate location seems to be revealed**.
- The **map appearing blank** when you open it.
- Anything that made you worry real data might be shared.
- Broken layout at your display scaling.

## Feedback questions (answer any you like)

- Could you tell what to do without instructions? Where did you get stuck?
- Was anything confusing or mislabeled?
- Did anything fail to respond when clicked?
- Did the Map ever appear blank? Did Terrain 3D work?
- Did you understand the location privacy levels (exact/approximate/sensitive)?
- Were incident statuses easy to scan?
- Did Test View feel realistic?
- Did anything feel slow?
- Did anything look broken at your display scaling?
- Was there any point where you worried real data might be shared?
- What would stop you from using this again?

## Suggested test missions

1. **Reporter**: create a fictional report (unknown species is fine,
   approximate location), add an observation and a photo, then update it.
2. **Professional operations**: enable Test View, try Dashboard, Response
   Flow, Incidents, Map, bookmarking, assignment/handoff, analytics.
3. **Map**: try Streets / Satellite / Terrain, the incident side list,
   single-click fly-to, bookmark, measure tool.
4. **Privacy**: create exact/approximate/sensitive fictional records and
   inspect the map + exports (see PRIVACY_TESTING_GUIDE.md).
5. **Backup**: create a backup from Settings → Data and restore it.
6. **Themes / accessibility**: try dark and light themes, Frosted and Solid
   materials, reduced motion if you use it.
