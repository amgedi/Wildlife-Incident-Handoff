# 0.3.0 Product Overhaul — Architecture Report

Version: `0.3.0-dev.1` · Branch: `0.3.0-overhaul` · dev.19 preserved at tag `v0.2.0-dev.19-checkpoint`

## What 0.3 is

A professional-experience overhaul of Wildlife Incident Handoff on top of the
dev.19 technical foundation (LAN sync v3, backup integrity, privacy rules,
10k perf budgets). The data engine was already strong; 0.3 makes the
professional experience look and feel as capable as the architecture under it
— without inventing capacity, urgency, or connectivity that does not exist.

## Home vs Dashboard (spec 112)

- **Home (`/`)** — personal entry point: greeting, continue-working list, quick
  actions, draft resume, learning/status.
- **Dashboard (`/network`, "Response network" in the sidebar)** — the
  operations command center: personalized command header, Needs Attention
  band, KPI pulse, response flow, map, analytics, live activity, integrity
  review, response network. Filters apply to every widget.

## Command header (spec 19–20)

`Welcome, {name}` / `Welcome back` (never the email), then a status line:
weekday · Local operations · N open incidents · N need assignment · N handoffs
waiting · Updated HH:MM · honest network badge
("Network: local professional preview" until a real connection exists).

## Needs Attention → operations queue (spec 13–17)

Replaced the far-left stacked cards with a responsive, prioritized band:
`Waiting >2h` (alert) → `Handoff awaiting acceptance` → `Unassigned` →
`Missing usable location` → `Possible duplicate` (info). Priorities are
deterministic operational states — no medical severity, no AI urgency. Each
tile deep-links into the filtered incident queue.

## Response flow v3 (spec 3–12)

- **One canonical query** (`RESPONSE_FLOW_STAGES` + `getPipelineStageCases`):
  stage counts and the case drawer derive from the SAME scope array
  (workspace, demo/test view, archive, trash, dashboard filters). Invariant
  tests: `count(stage) === list(stage).length` under every scope. This fixes
  the dev.19 bug where Pickup showed 3 but selecting it showed "0 case(s)".
- **Default state: nothing selected.** The drawer is not mounted until a
  stage is selected; a hint line replaces it.
- **Selection visual**: stronger node, accent ring + halo, accent underline,
  connected rail highlights — no giant filled card. Hover is subtle;
  keyboard focus is an independent ring; arrows move selection.
- **Drawer**: count, Earliest/Latest sort (hidden when ≤1 case), bounded rows
  (8 + "Show more"), designed empty state; rows open the incident.

## Incidents command center (spec 31–40)

Top summary band (Open / Unassigned / Awaiting pickup / Handoff pending /
Waiting >2h / Recently closed — each stat applies its own filter), List and
Table modes (sortable, keyboard-navigable, bounded render), fast side
inspector (status, animal, location, assignee, age, latest update, handoff,
"Open full incident"), Comfortable/Compact density, saved views preserved.

## Live activity & analytics (spec 41–53)

Activity feed entries carry time, event, incident reference, animal label.
Reports Over Time is a clean SVG area/line chart with crosshair tooltip
(date, reported, resolved), keyboard crosshair, and an accessible data table.
Case aging is a segmented band (<30m / 30–60m / 1–2h / 2–4h / 4h+) with a
hatched 4h+ bucket and a visible legend. Distributions cap at 8 ranked rows
with an "Other (n)" summary. Deterministic insights only — statistics from
records, never predictions.

## Response network (spec 24–26)

A dedicated widget derives organizations, transfer partners and handoff
backlog from real handoff records, plus LAN trusted devices. The interface
explicitly does NOT invent beds, staff, vehicles or availability
("no live capacity is invented").

## Report integrity (spec 75–83)

- Provenance recorded at creation (`known_local_profile` / `anonymous_local`;
  demo records are `demo`). Context, not identity.
- Deterministic review signals: possible duplicate, rapid repeat, repeated
  text, reused media hash, blocked source. App-generated local data only —
  no browser/device fingerprinting.
- **No automatic rejection** — ever. A review widget lists hinted reports;
  actions: review, dismiss signals (sticky), block/unblock local source with
  audit fields; previous reports are never erased. Local burst protection is
  advisory only and does not pretend to protect a network.
- Reporter follow-up marks when contact was voluntarily provided.

## Community recognition (spec 84–88)

Opt-in, private by default. Quality-based milestones only (helpful observer,
detailed reporter, location helper, follow-up contributor, clear handoff,
documentation steward, team contributor) counted after reports are accepted
into response. **No leaderboards, no speed or volume ranking** — enforced by
contract tests enumerating forbidden badges.

## Profiles & identity (spec 54–74)

- The paw is retired everywhere: a new **handoff-relay app mark** (two nodes +
  route curve) serves as window/taskbar/sidebar/installer/PWA/favicon
  identity, with a regenerated icon family.
- Avatars: initials or neutral silhouette by default; upload/remove with
  local-only storage; decorative ring/banner options removed; duplicated
  "(optional)" labels fixed.
- **Device Center** (Settings → Devices): friendly name, device type
  (auto-detected, override), OS, app version, public identity fingerprint
  (private keys never shown), LAN trusted devices with revoke, honest
  no-cloud-account disclosure. Human profile ≠ device identity.

## Country profile (spec 62–67)

A `CountryProfile` catalog drives date/time presentation (Intl locale),
country default map viewport (service area always wins), phone guidance and
unit/language suggestions. Settings states honestly what it changes and that
it **never** alters incident meaning, classification, safety/status logic or
privacy. The dropdown is now a searchable, keyboard-accessible combobox.

## Themes & desktop experience (spec 89–106)

- Four new distinct dark themes (Forest Night, Midnight Ops, Storm, Aurora —
  full status palettes + ambient character), two light themes (Sand, Arctic),
  alongside the existing ten.
- **Window materials**: Solid / Frosted / Glass. Data surfaces (tables,
  drawers) keep near-solid backgrounds in every material; the OS
  reduce-transparency preference is respected.
- Monochrome Dark legibility: deeper surface separation, stronger borders,
  shape glyphs for every status (already shape-based, now higher contrast).
- Custom titlebar gains a center search launcher (Ctrl+K command palette over
  navigation, incidents, settings, help). Window controls, snap and drag are
  unchanged and re-tested.

## What 0.3 deliberately does NOT do

No accounts/cloud/telemetry; no AI diagnosis or urgency invention; no fake
live network or capacity; no auto-merge of duplicates; no auto-rejection of
reports; no leaderboards; no private-key exposure; no weakening of the
dev.18/19 privacy rules (sensitive locations, per-incident map/export
privacy, avatar excluded from exports/diagnostics).

## Verification summary

- Frontend: 460+ tests green (incl. new response-flow invariants, navigation
  contract matrix, theme/material/monochrome contracts, integrity,
  recognition boundaries, device center, analytics v3, incidents command
  center, localization completeness in de/es/fr/pt-BR).
- Rust: 7/7 LAN crypto tests green.
- Desktop: portable EXE + NSIS installer rebuilt at 0.3.0-dev.1; smoke suite
  run against the compiled EXE (see final report).
