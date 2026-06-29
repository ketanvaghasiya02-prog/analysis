# MT5 Gap Monitor — CSV Research Console

An institutional-style web application for **statistical research** on MT5
`GapMonitor` EA CSV exports.

> ⚠️ **Research tool only.** This is **not** a trading application. It has no
> broker connection, places no orders, and produces no buy/sell signals. It
> performs CSV-based statistical analysis entirely in your browser — no data
> leaves your machine.

---

## Features

The app is organised as a multi-page research console (left-sidebar
navigation). Every page reads one shared, filtered dataset, so the active
**analysis mode** (Combined / Day Wise / Single Day / Custom Range) and the
**global filters** (date range, session, SyncStatus, symbol pair, gap range)
flow through everything consistently.

- **Overview** — multi-CSV upload (drag-and-drop), parsing & validation,
  overview cards, gap-trend chart, gap distribution (histogram + zone summary),
  day-wise analysis & day comparison, research highlights, data-quality
  warnings and a virtualized sample inspector.
- **Events** — zone event detection (gap enters a zone from below), event
  quality (valid / invalid / day-ended / dataset-ended), per-zone counts.
- **Recovery Matrix** — per-zone recovery probability and a recovery-target
  matrix (time to reach each lower gap level), colour-coded.
- **MAE Analysis** — Maximum Adverse Excursion: how far recovered vs failed
  events expand before resolving (percentile tables + distribution).
- **Stop-Loss Research** — survival sweep across SL levels with suggested
  statistical SL references (P90 / P95 / P99 / worst). Evidence only.
- **Failed Events** — failed-event distribution, by-session/day breakdown,
  recovery-after-failure buckets, and a details drawer.
- **Event Explorer** — filterable event table with a replay chart (entry,
  max-adverse, recovery, SL level and day-boundary markers).
- **Session Analysis** — per-session recovery, risk, best/worst zone, sync.
- **Exports** — every report (Gap Zone Recovery, Stop-Loss Survival, Failed
  Events, Day-wise, Session, Full Summary) to CSV / JSON / printable HTML.
- **Settings** — bin size, recovery/SL steps, min events per zone and default
  session filter, persisted to `localStorage`.

> Research only — no broker connection, orders, or trading signals.

---

## Tech stack

| Concern        | Library                |
| -------------- | ---------------------- |
| UI framework   | React 18 + TypeScript  |
| Build tool     | Vite 5                 |
| Styling        | Tailwind CSS 3         |
| CSV parsing    | PapaParse              |
| Charts         | Recharts               |
| Data tables    | TanStack Table v8      |

---

## Getting started

```bash
npm install
npm run dev        # start the dev server (http://localhost:5173)
npm run build      # type-check + production build
npm run preview    # preview the production build
npm run lint       # type-check only (tsc --noEmit)
```

A trimmed real-export excerpt is included for testing:

```
samples/GapMonitor_Main_20260629.csv   # 50-row excerpt, XAUUSD vs GCQ26
```

Drag it onto the upload zone to populate the dashboard. (The parsing engine
has been verified against the full 4,167-row export.)

---

## Expected CSV format

The app expects the standard `GapMonitor` EA columns (header row required):

```
SampleID, Date, Time, ServerTime, SpotSymbol, FutureSymbol,
SpotBid, SpotAsk, FutureBid, FutureAsk, SpotMid, FutureMid,
Gap, GapBid, GapMid, SpotSpread, FutureSpread,
SpotTickTime, FutureTickTime, TickAgeDifferenceSec,
SyncStatus, CurrentSession
```

`ServerTime` is accepted in MT5 form (`2026.06.29 14:00:27`) as well as
ISO-like variants. Missing columns are reported, not fatal; unparseable rows
are counted as invalid and excluded from statistics.

---

## Project structure

```
.
├── index.html
├── vite.config.ts            # Vite config + vendor chunk splitting + @ alias
├── tailwind.config.js        # Institutional dark palette
├── tsconfig*.json
├── samples/                  # Example CSV export for testing
└── src/
    ├── main.tsx              # React entry
    ├── App.tsx               # DataProvider + Dashboard
    ├── index.css             # Tailwind layers + component classes
    ├── types/
    │   └── gap.ts            # Type-safe domain models & column constants
    ├── utils/
    │   ├── csvParser.ts      # Parse → map → merge engine (PapaParse)
    │   ├── validation.ts     # Validation report builder
    │   ├── statistics.ts     # Numeric summaries, sync quality
    │   ├── selection.ts      # Resolve active samples per analysis mode
    │   ├── date.ts           # Timestamp / filename-date normalisation
    │   └── format.ts         # Display formatters
    ├── context/
    │   └── DataContext.tsx   # App-wide store (parse, select, derive)
    ├── components/
    │   ├── layout/           # AppLayout · Sidebar · Header
    │   ├── upload/           # FileUpload (drag-and-drop)
    │   ├── overview/         # StatCard · OverviewCards · charts · tables
    │   ├── validation/       # ValidationPanel
    │   └── common/           # AnalysisModeSelector · EmptyState · icons
    └── pages/
        └── Dashboard.tsx     # R1 overview composition
```

---

## Design notes

- **No hardcoded sample data in code.** The dashboard renders nothing until you
  upload real files; the bundled CSV under `samples/` is an external fixture.
- **Type-safe end to end.** All CSV rows are mapped to a strict `GapSample`
  model; numeric cells that fail to parse become `null` rather than `NaN`.
- **Day-wise preservation.** Files are merged for combined views but each day
  remains queryable via `dataset.byDay`, powering Day Wise / Single Day modes.
- **Browser-only.** Parsing uses the `FileReader` API and runs client-side.
