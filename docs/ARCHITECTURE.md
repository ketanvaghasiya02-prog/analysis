# ARCHITECTURE — Gap Research Terminal

This document describes the complete data flow of GRT. It is a browser-only,
client-side application: CSV is parsed and analysed entirely in the browser.
Nothing is uploaded to a server.

## High-level data flow

```
CSV Upload
   │   (one or more GapMonitor exports)
   ▼
Data Manager  ──────────────────────────────────────────────┐
   │   parse → validate → merge → day-bucket → global filters │  DataContext
   ▼                                                          │
Research Engine v1.0  (scenario.ts · computeScenario)         │  FROZEN
   │   position model → outcomes, times, adverse, confidence  │
   ▼
Research Repository  (RepositoryContext)
   │   stores COMPLETED strategy results, de-duplicated
   ▼
Research Lab ── Stop Loss Optimizer ── Historical Strategy Finder
   │                                         │ (generate → execute)
   │                                         ▼
   │                                  Strategy Ranking
   │                                         ▼
   │                                  Strategy Details (Dossier)
   │                                         ▼
   │                                  Replay Engine
   ▼
Probability Engine v1.0
   │   compression probability per target
   ▼
Opportunity Scanner   (reads the probability matrix)
   ▼
Reliability Engine          (FUTURE)
   ▼
Walk Forward Validation     (FUTURE)
   ▼
Market Context              (current statistical context)
   ▼
Reports                     (FUTURE)
   ▼
AI Research Assistant       (FUTURE)
   ▼
EA Export                   (FUTURE)
```

The pipeline above is the canonical ordering from the Constitution. Not every
arrow is a hard runtime dependency — some modules are siblings that all consume
the same upstream data — but the **direction of trust** always flows downward:
later modules read earlier outputs, never the reverse, and never recompute them.

## Layers

### 1. Data Manager (`DataContext`)
- **Parse** — `utils/csvParser.ts` (PapaParse) turns raw CSV rows into validated
  `GapSample`s; invalid rows are captured with reasons.
- **Validate** — `utils/validation.ts` builds a validation report (counts,
  date range, sync quality).
- **Merge / day-bucket** — multiple files are merged and sorted by timestamp;
  samples carry a `dayKey` (YYYY-MM-DD).
- **Select / filter** — analysis mode (combined / day-wise / single-day /
  custom-range) and global filters (session, sync, gap, date) produce
  `filteredSamples`, the canonical view set shared by all data-dependent pages.

### 2. Research Engine v1.0 — single source of truth (`utils/scenario.ts`)
`computeScenario(samples, ScenarioInput)` runs the **position model**: one
simulated position at a time; entry on first touch of the entry gap from below;
after entry, scan forward to a terminal (recovery / SL / day-end / dataset-end /
holding-expired); resume after the exit. It returns outcome counts, recovery
percentages, recovery times, adverse/favourable distributions and a confidence
score. **Frozen and CSV-validated.**

### 3. Research consumers
- **Research Lab** — single-scenario testing on the engine.
- **Stop Loss Optimizer** — sweeps stop-loss levels, one engine call per level.
- **Historical Strategy Finder** — generates valid parameter combinations
  (11A), executes the engine per READY combination (11B), and publishes
  COMPLETED results to the Repository (11C).

### 4. Research Repository (`RepositoryContext`)
The central, de-duplicated store of COMPLETED strategy research. Downstream
modules **read** the repository instead of rerunning the engine:
- **Strategy Ranking** — deterministic 0–100 scoring of stored strategies.
- **Strategy Details** — full historical dossier for one strategy.
- **Replay Engine** — replays one stored occurrence from the source samples.
- **Strategy Comparison** — side-by-side comparison of 2–5 stored strategies.

### 5. Probability layer
- **Probability Engine v1.0** (`utils/probability.ts`) — a separate engine that
  computes, per lower target gap, the historical probability that the gap
  compresses to it. One position-model scan evaluates all targets together.
- **Opportunity Scanner** (`utils/opportunity.ts`) — a presentation layer that
  reads the probability matrix, filters and deterministically scores it.

### 6. Context & reporting
- **Market Context** (`utils/marketContext.ts`) — describes the current market
  context statistically over a recent window.
- **Reliability Engine**, **Walk Forward Validation**, **Reports**,
  **AI Research Assistant**, **EA Export** — future modules (see `ROADMAP.md`).

## State / context boundaries

| Context | Responsibility |
|---|---|
| `DataContext` | Dataset, validation, selection, global filters, navigation (`view`) |
| `RepositoryContext` | COMPLETED strategy results (source of truth for downstream research) |
| `StrategyFocusContext` | Currently-selected strategy + occurrence for Details / Replay |
| `ComparisonContext` | 2–5 strategy keys selected for Comparison |

## Rendering shell

`AppLayout` = Sidebar (collapsible sections) · Header (top bar) · `PageHeader`
(module name + description + status) · scrollable main. Routing is a single
`view` value in `DataContext`; `pages/Dashboard.tsx` maps it to a view component.
