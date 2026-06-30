# Gap Research Terminal (GRT)

**Professional CSV-Based Pair Spread Research Platform**

> ⚠️ **Research instrument only.** GRT is **not** a trading application. It has
> no broker connection, places no orders, and produces no buy/sell signals. It
> never predicts markets and never recommends trades. Every output is historical
> statistical evidence derived from uploaded CSV, computed entirely in your
> browser — no data leaves your machine.

---

## Vision

Transform historical spread (gap) data into **statistically reliable decision
support** using recent market behaviour. GRT turns raw `GapMonitor` CSV exports
into a layered research terminal — from raw events, through frozen calculation
engines, to a repository of completed research, ranking, probability and market
context — where every number is reproducible from the source CSV.

The project is governed by a permanent **[Project Constitution](docs/PROJECT_CONSTITUTION.md)**.
Its ten immutable rules (research only, no predictions, single source of truth,
deterministic, no hidden weighting, recent-window default, CSV-verifiable, …)
bind every module — existing and future.

## Architecture

```
CSV Upload → Data Manager → Research Engine v1.0 → Research Repository
   → Research Lab · Stop Loss Optimizer · Historical Strategy Finder
   → Strategy Ranking → Strategy Details → Replay Engine → Strategy Comparison
   → Probability Engine → Opportunity Scanner
   → Reliability Engine* → Walk Forward Validation* → Market Context
   → Reports* → AI Research Assistant* → EA Export*          (* = future)
```

Business logic lives in **pure, deterministic engines** (`src/utils/`); views are
thin (`src/components/<domain>/`); shared state lives in React contexts. See
**[ARCHITECTURE.md](docs/ARCHITECTURE.md)** for the full data flow and
**[PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md)** for the folder layout.

## Features

- **Data Manager** — multi-CSV upload, parsing, validation, day-bucketing, and
  shared analysis modes (Combined / Day-wise / Single Day / Custom Range) with
  global filters (date, session, sync, gap).
- **Classic gap analytics** — Overview, Events, Recovery Matrix, MAE Analysis,
  Stop-Loss Research, Failed Events, Event Explorer, Session Analysis.
- **Research Engine v1.0** — the frozen, CSV-validated position-model engine
  that is the single source of truth for scenario outcomes.
- **Research Lab** — single-scenario testing on the engine.
- **Stop Loss Optimizer** — sweep stop-loss levels with balanced-SL & plateau
  intelligence.
- **Historical Strategy Finder** — generate, validate and execute parameter
  grids; publish completed results to the repository.
- **Research Repository** — central, de-duplicated store of completed research.
- **Strategy Ranking** — deterministic 0–100 statistical ranking.
- **Strategy Details** — full historical dossier per strategy.
- **Replay Engine** — replay one historical occurrence sample-by-sample.
- **Strategy Comparison** — side-by-side comparison of 2–5 strategies.
- **Probability Engine** — historical compression probability per target gap.
- **Opportunity Scanner** — surfaces the statistically strongest historical
  compressions from the probability matrix.
- **Market Context** — statistical description of the current market context
  over a recent window.

See the **[Module Registry](docs/MODULE_REGISTRY.md)** for each module's
research question, inputs, outputs, dependencies and status.

## Screenshots

_Placeholder — add terminal screenshots here:_

| Overview | Probability Engine | Strategy Comparison |
|---|---|---|
| _`docs/img/overview.png`_ | _`docs/img/probability.png`_ | _`docs/img/comparison.png`_ |

## Tech stack

| Concern | Library |
|---|---|
| UI framework | React 18 + TypeScript (strict) |
| Build tool | Vite 5 |
| Styling | Tailwind CSS (institutional dark theme) |
| CSV parsing | PapaParse |
| Charts | Recharts |
| Data tables | TanStack Table v8 |

## Development workflow

```bash
npm install
npm run dev        # dev server (http://localhost:5173)
npm run build      # tsc -b && vite build  (must pass clean)
npm run preview    # preview the production build
npm run lint       # type-check only (tsc --noEmit)
```

Standards every change must follow:

- **[CODING_STANDARDS.md](docs/CODING_STANDARDS.md)** — naming, engines/views,
  hooks, no duplicated business logic.
- **[UI_STANDARDS.md](docs/UI_STANDARDS.md)** — colours, typography, cards,
  tables, charts, states, wording.
- **[PERFORMANCE.md](docs/PERFORMANCE.md)** — memoization, one-scan-many-outputs,
  no duplicate calculations, caching, caps.
- **[VALIDATION.md](docs/VALIDATION.md)** — manual CSV verification, edge cases,
  acceptance checklist, regression testing.

> Frozen modules (Research Engine, Research Lab, Stop Loss Optimizer, Historical
> Strategy Finder, Research Repository, Strategy Ranking, Probability Engine)
> must not have their calculations changed. Build presentation layers on top.

## Expected CSV format

Standard `GapMonitor` EA columns (header row required):

```
SampleID, Date, Time, ServerTime, SpotSymbol, FutureSymbol,
SpotBid, SpotAsk, FutureBid, FutureAsk, SpotMid, FutureMid,
Gap, GapBid, GapMid, SpotSpread, FutureSpread,
SpotTickTime, FutureTickTime, TickAgeDifferenceSec,
SyncStatus, CurrentSession
```

`ServerTime` is accepted in MT5 form (`2026.06.29 14:00:27`) and ISO-like
variants. Missing columns are reported, not fatal; unparseable rows are counted
as invalid and excluded from statistics.

## Folder structure

```
src/
├── context/      Shared state (Data, Repository, StrategyFocus, Comparison)
├── pages/        Dashboard (view router)
├── types/        Domain types (gap.ts)
├── utils/        Engines — pure, deterministic calculations
└── components/   Views — one folder per module domain
docs/             Constitution, Architecture, Registry, Standards, Roadmap
```

Full detail in **[PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md)**.

## Roadmap

Completed/frozen: Research Engine, classic analytics, Research Lab, Stop Loss
Optimizer, Historical Strategy Finder, Repository, Ranking, Details, Replay,
Comparison, Probability Engine, Opportunity Scanner, Market Context.

Remaining: Reliability Engine, Walk Forward Validation, Reports, AI Research
Assistant, EA Export. See **[ROADMAP.md](docs/ROADMAP.md)**.

## Documentation index

| Document | Purpose |
|---|---|
| [PROJECT_CONSTITUTION.md](docs/PROJECT_CONSTITUTION.md) | Immutable project rules |
| [RESEARCH_ENGINE.md](docs/RESEARCH_ENGINE.md) | Complete frozen Research Engine reference |
| [RESEARCH_LAB.md](docs/RESEARCH_LAB.md) | Complete frozen Research Lab reference |
| [STOP_LOSS_OPTIMIZER.md](docs/STOP_LOSS_OPTIMIZER.md) | Complete frozen Stop Loss Optimizer reference |
| [HISTORICAL_STRATEGY_FINDER.md](docs/HISTORICAL_STRATEGY_FINDER.md) | Frozen Finder ecosystem (generation → execution → repository → ranking → details → replay → comparison) |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Complete data flow |
| [MODULE_REGISTRY.md](docs/MODULE_REGISTRY.md) | Per-module definitions |
| [PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md) | Folder layout |
| [CODING_STANDARDS.md](docs/CODING_STANDARDS.md) | Code conventions |
| [UI_STANDARDS.md](docs/UI_STANDARDS.md) | Visual & UX standards |
| [PERFORMANCE.md](docs/PERFORMANCE.md) | Performance rules |
| [VALIDATION.md](docs/VALIDATION.md) | Verification standard |
| [ROADMAP.md](docs/ROADMAP.md) | Release roadmap |

## License

_License placeholder — to be determined._

---

_Research only — no broker connection, orders, or trading signals. Historical
evidence, never prediction._
