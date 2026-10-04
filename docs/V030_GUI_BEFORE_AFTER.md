# 0.3.0 GUI Before / After Report

All "before" screenshots come from the real dev.19 portable EXE; all "after"
screenshots from the compiled `0.3.0-dev.1` desktop EXE (WebView2, CDP).
Paths are relative to the repository root.

## 1. Operations dashboard

- **Problem**: dev.19 rendered "Needs Attention" as narrow cards stacked down
  the far-left beside a giant black void; the header was a generic "Live
  local operations" strip; the response flow started in a visually ambiguous
  state and its case list disagreed with its counts.
- **Before**: `screenshots/v030-before/network.png`
- **After**: `screenshots/v030-after/dashboard.png`
- **Rationale**: personalized command header (`Welcome, Amged`, weekday,
  open/assignment/handoff counters, honest network badge); attention became a
  responsive prioritized band spanning the full width; widgets fill the grid.

## 2. Response flow

- **Problem**: stage counts and the case drawer used two different data paths
  (Pickup showed 3; selecting it showed "0 case(s)"); a stage could appear
  pre-selected; selection was a heavy filled card.
- **Before**: `screenshots/v030-before/network-2.png`
- **After**: `screenshots/v030-after/dashboard.png` (rail, nothing selected)
  and `screenshots/v030-after/response-flow-selected.png` (node ring +
  underline + compact drawer whose count matches the stage).
- **Rationale**: one canonical query (invariant-tested); selection is a node
  ring + accent underline, never a giant card; drawer animates open with
  bounded rows.

## 3. Incidents

- **Problem**: a plain searchable card list; no operational context, no table,
  no fast inspection.
- **Before**: `screenshots/v030-before/incidents.png`
- **After**: `screenshots/v030-after/incidents-list.png`,
  `incidents-table.png`, `incident-inspector.png`
- **Rationale**: summary band (each stat filters), sortable table, side
  inspector, compact density — all bounded for 10k-record stores.

## 4. Profile & identity

- **Problem**: the paw was the person's default avatar and the app mark;
  decorative ring options (Leaves/Wood/Rope/Stars) added noise; "(optional)"
  labels were duplicated.
- **Before**: `screenshots/v030-before/profile.png`
- **After**: `screenshots/v030-after/profile.png`
- **Rationale**: initials/silhouette avatar with one subtle ring; new
  handoff-relay app mark in the titlebar/sidebar/icons; opt-in recognition
  card states there is no leaderboard.

## 5. Devices & country

- **Problem**: the strong cryptographic device identity was invisible; the
  country dropdown looked like a browser `<select>` and did almost nothing.
- **After**: `screenshots/v030-after/devices.png`,
  `screenshots/v030-after/appearance.png`
- **Rationale**: Settings → Devices shows friendly name, type, OS, version,
  public fingerprint, trusted peers with revoke; the country combobox is
  searchable/keyboard-accessible with an honest effects note.

## 6. Themes & materials

- **Problem**: only two genuinely distinct dark themes; Monochrome Dark
  statuses/surfaces were hard to distinguish; no window material choice.
- **After**: `screenshots/v030-after/theme-*.png` (Forest Night, Midnight
  Ops, Storm, Aurora, mono-dark, Forest Light, Sand) and
  `material-solid/frosted/glass.png`
- **Rationale**: six new themes with complete status palettes + ambient
  character; monochrome got deeper surface separation + shape glyphs;
  frosted/glass keep data surfaces near-solid and honor OS
  reduce-transparency.

## 7. Help, integrity review, home

- **After**: `screenshots/v030-after/help.png`, `integrity-review.png`,
  `home.png`
- **Rationale**: new Help articles (response flow, integrity, devices,
  recognition, country, palette, themes); integrity review is a
  dismiss-per-report queue with "never proof of fraud" wording; Home is the
  personal entry point vs the Dashboard's command center.
