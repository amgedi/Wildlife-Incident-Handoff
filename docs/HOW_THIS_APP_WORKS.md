# How This App Works

A plain-English tour of Wildlife Incident Handoff for someone learning software development. No prior professional experience assumed.

---

## 1. The big picture

Wildlife Incident Handoff is a **web application that runs entirely in your browser**. There is no server, no database in the cloud, and no login. When you use it:

1. Your browser downloads the application (HTML, CSS, JavaScript) — once.
2. Everything you type is saved **inside your browser** using a browser feature called **IndexedDB**.
3. Nothing ever leaves your device unless you explicitly export a file.

The project is built with:

| Tool | What it does |
| --- | --- |
| **TypeScript** | JavaScript with types — catches mistakes before the app runs |
| **React** | A library for building interfaces from small, reusable pieces called *components* |
| **Vite** | The build tool: runs the dev server, bundles the app for production |
| **IndexedDB** | The browser's built-in database — where incidents and photos are stored |
| **Vitest** | The test runner — runs automated tests against the code |
| **vite-plugin-pwa** | Adds the "installable app" + offline service worker |

## 2. Project folder structure

```
wildlife-incident-handoff/
├── index.html              The single HTML page the whole app lives in
├── package.json            Project metadata, dependencies, and scripts
├── vite.config.ts          Build + PWA + test configuration
├── public/                 Static files copied as-is (favicon, PWA icons)
├── screenshots/            Screenshots used by this README
└── src/                    All source code
    ├── main.tsx            Entry point: starts React, mounts the app
    ├── App.tsx             The app shell: sidebar, routing, the product tour
    ├── version.ts          The current version string
    ├── app/                App-wide state (settings, toasts) shared by all screens
    ├── components/         Reusable building blocks (buttons' styling helpers,
    │                       dialogs, selects, icons, the brand mark)
    ├── features/           The big functional areas, one folder each:
    │   ├── onboarding/     First-run welcome + experience questions
    │   ├── home/           The home screen
    │   ├── incidents/      Creation wizard, list, detail workspace
    │   │   └── detail/     One file per incident tab (Overview, Timeline, …)
    │   ├── export/         Building handoff summaries (text/HTML/print)
    │   ├── settings/       The settings page
    │   └── tutorial/       Product tour, guided tutorial, demo data
    ├── storage/            Everything that touches IndexedDB:
    │   ├── db.ts           Opens the database and runs migrations
    │   ├── repositories.ts Read/write functions (the ONLY code talking to IndexedDB)
    │   ├── incidentService.ts  All incident mutations + timeline event creation
    │   └── backupService.ts    Export/import of JSON backups
    ├── types/              TypeScript descriptions of the data (Incident, Handoff, …)
    ├── utils/              Small helpers: IDs, dates, text safety, validation
    ├── styles/             Design tokens (colors, spacing, motion) and base CSS
    └── i18n/               Interface text keyed by name, ready for translations
```

## 3. What a React component is

A **component** is a function that returns part of the user interface. For example, the status badge:

```tsx
export function StatusBadge({ status }: { status: IncidentStatus }) {
  return <span className={`badge ${cls}`}>{STATUS_LABELS_BY_KEY[status]}</span>;
}
```

You can use it like an HTML tag: `<StatusBadge status={incident.status} />`. React re-runs the function when the data changes and updates the page. Screens like the home page are just bigger components made of smaller ones.

## 4. What TypeScript does

TypeScript describes the *shape* of data. For example, in `src/types/incident.ts`:

```ts
interface AnimalInfo {
  group: AnimalGroup | null;   // null = not recorded
  species: string | null;
  count: number | null;
  ...
}
```

If code tried to use `incident.animal.species` without checking for `null`, the compiler (`npm run typecheck`) would complain. That's how "Unknown is a valid answer" is enforced *by the type system*: almost every descriptive field is nullable, and the UI renders an explicit "Unknown" chip when it is.

## 5. How the app starts

1. Vite serves `index.html`, which loads `src/main.tsx`.
2. `main.tsx` renders `<App />` inside a router (chooses which screen for which URL) and an `AppProvider` (holds settings and toasts).
3. `App.tsx` waits for settings to load from IndexedDB. If this is the first run, it shows **Onboarding**; otherwise it shows the main shell with a sidebar and routes:
   - `/` home, `/incidents` list, `/incidents/new` wizard, `/incidents/:id` detail, `/examples`, `/tutorial`, `/settings`.

## 6. How incident data flows

The golden rule: **the user interface never writes to the database directly.** Every change goes through `src/storage/incidentService.ts`:

```
UI (e.g. ObservationsTab)
   │  calls addObservation(incident, …)
   ▼
incidentService
   │  1. builds the new Observation
   │  2. builds a TimelineEvent describing what just happened
   │  3. updates the incident: new state + appended event
   ▼
repositories.ts  →  IndexedDB (a single "put" saves the whole incident)
```

This is how "append, don't erase" is guaranteed: functions like `correctField()` never destroy the old value — they store it inside the correction event (`previousValue` / `newValue`) so the timeline always shows the original.

**Current state + history.** The incident record holds the *current* values (status, observations, custody), so opening a screen is fast — no replaying thousands of events. The `timeline` array holds the *history*. Both are written together in one atomic save, so they can't drift apart.

## 7. How IndexedDB works (in this app)

IndexedDB is the browser's database. `src/storage/db.ts` opens (or creates) a database named `wildlife-incident-handoff` with four "object stores" (tables):

- **incidents** — one record per incident (the whole incident, including its timeline)
- **attachments** — photo blobs, stored *separately* from incident records so images never bloat the record itself
- **drafts** — the autosaved creation wizard state
- **settings** — a small key/value store for app settings

The `upgrade` callback in `db.ts` is the **migration system**: it currently creates version 1, and future versions add `if (oldVersion < 2) { … }` blocks — so existing user data can be upgraded in place without loss.

## 8. How the timeline works

Every meaningful action creates a `TimelineEvent` with: a unique `eventId`, a `timestamp`, an `eventType` (like `status_changed` or `handoff_completed`), a human-readable `summary`, optional `details`, and — for corrections — `metadata` holding the previous and new values. The Timeline tab simply sorts events by time and renders them; it can afford to be dumb because the service layer guarantees every event was created.

## 9. How exports work

`src/features/export/exportService.ts` turns an incident into *sections* (Incident, Animal, Location, Observations, Hazards, Actions, Custody, Contacts, Timeline…). The same sections feed three formats:

- **Print / PDF** — an HTML document opened in a print-friendly window
- **Text** — a plain `.txt` handoff summary
- **HTML** — a styled `.html` file

Privacy is applied *before* rendering: the options object decides whether coordinates, personal contacts, or private notes are included at all. Shareable defaults exclude them; internal defaults include them. Backups (`backupService.ts`) are a different thing: a complete JSON snapshot of all incidents + attachments, validated on import, never overwriting existing IDs.

## 10. How tests work

`npm test` runs Vitest. Tests import the real service code and run against an in-memory IndexedDB (`fake-indexeddb`), so they're fast and isolated — each test gets a fresh database. Look at `src/storage/incidentService.test.ts`: it creates incidents, corrects fields, records handoffs, and then *asserts that history was preserved*. That's the heart of the app, tested automatically.

## 11. How the build works

- `npm run dev` — Vite serves the source with instant reload. No files are written.
- `npm run build` — `tsc` type-checks everything, then Vite bundles + minifies into `dist/`, and the PWA plugin generates the service worker (`sw.js`) that precaches every file.
- `npm run preview` — serves `dist/` so you can verify the *production* build.

The service worker is what makes the app work offline: after the first visit, the browser serves the app files from its cache, and all data lives in IndexedDB — so a lost network connection changes nothing.

## 12. Where to start reading

1. `src/types/incident.ts` — the vocabulary of the whole app
2. `src/storage/incidentService.ts` — the rules of the app (history, custody, handoffs)
3. `src/features/incidents/CreateIncidentPage.tsx` — how a record is born
4. `src/features/incidents/detail/TimelineTab.tsx` — how history is shown
