# MT5 Gap Monitor — CSV Research Console

An institutional-style web application for **statistical research** on MT5
`GapMonitor` EA CSV exports.

> ⚠️ **Research tool only.** This is **not** a trading application. It has no
> broker connection, places no orders, and produces no buy/sell signals. It
> performs CSV-based statistical analysis entirely in your browser — no data
> leaves your machine.

---

## Phase R1 scope

This is the **R1** foundation release. It delivers:

1. **Multi-CSV upload** — drag-and-drop or browse one or many files at once
   (e.g. `GapMonitor_Main_20260601.csv … GapMonitor_Main_20260610.csv`).
2. **Parsing engine** — parses every file, merges into one combined dataset
   while **preserving day-wise buckets**, extracts the date from both the
   filename and `ServerTime`, and safely quarantines missing/corrupt rows.
3. **Validation engine** — files uploaded, total/valid/invalid rows, missing
   columns, duplicate timestamps, `SyncStatus` distribution and the detected
   date range.
4. **Dark institutional dashboard** — left sidebar, header with the active
   date range, main content area, responsive layout.
5. **Overview cards** — total files, total samples, date range, average/max/min
   gap and sync-quality %.
6. **Analysis mode selector** — Combined · Day Wise · Single Day · Custom Date
   Range.

> Out of scope for R1 (planned later): recovery analysis, stop-loss analysis,
> event replay.

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
