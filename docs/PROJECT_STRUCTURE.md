# PROJECT STRUCTURE — Gap Research Terminal

GRT is a Vite + React + TypeScript single-page app. Business logic lives in
**pure functions** under `src/utils/` (the "engines"); presentation lives under
`src/components/<domain>/`; shared app state lives in `src/context/`.

## Canonical principles

- **Engines are pure.** Every calculation is a pure, deterministic function in
  `src/utils/`. No React, no DOM, no side effects (except explicit export/print
  helpers). This is what makes Constitution Rules 3, 8 and 10 enforceable.
- **Views are thin.** Components in `src/components/<domain>/` read engine
  outputs via `useMemo` and render them. They never contain business logic.
- **One domain folder per module.** Each module owns a component folder and one
  or more util files named for the module.

## Current layout

```
src/
├── main.tsx                 App entry
├── App.tsx                  Provider composition (Data → Repository → Focus → Comparison)
├── index.css                Tailwind layers + theme tokens
│
├── context/                 Shared React state
│   ├── DataContext.tsx          dataset, filters, selection, navigation (AppView)
│   ├── RepositoryContext.tsx    COMPLETED research results store
│   ├── StrategyFocusContext.tsx selected strategy + occurrence
│   └── ComparisonContext.tsx    2–5 strategies selected for comparison
│
├── pages/
│   └── Dashboard.tsx         Maps the active `view` to a module component
│
├── types/
│   └── gap.ts                Core domain types (GapSample, CombinedDataset, …)
│
├── utils/                   ENGINES (pure, deterministic, testable)
│   ├── scenario.ts              Research Engine v1.0 (FROZEN)
│   ├── csvParser.ts             CSV → GapSample
│   ├── validation.ts            Validation report
│   ├── filters.ts · selection.ts · histogram.ts · events.ts
│   ├── recovery.ts · mae.ts · stoploss.ts · failed.ts · sessions.ts
│   ├── slOptimizer.ts · slIntelligence.ts          Stop Loss Optimizer
│   ├── strategyFinder.ts · strategyExecution.ts    Historical Strategy Finder
│   ├── researchRepository.ts                        Repository logic
│   ├── strategyRanking.ts                           Ranking
│   ├── strategyDossier.ts                           Strategy Details
│   ├── replay.ts                                    Replay Engine
│   ├── strategyComparison.ts                        Comparison
│   ├── probability.ts                               Probability Engine v1.0
│   ├── opportunity.ts                               Opportunity Scanner
│   ├── marketContext.ts                             Market Context
│   ├── reports.ts · chartExport.ts                  Export helpers
│   └── format.ts · date.ts · statistics.ts          Shared helpers
│
└── components/             VIEWS (one folder per domain)
    ├── layout/                  Sidebar, Header, AppLayout, PageHeader, moduleMeta
    ├── common/                  EmptyState, Skeleton, icons, ModulePlaceholder, InfoTip
    ├── filters/ · upload/ · export/
    ├── overview/ · overview2/ · events/ · recovery/ · mae/ · stoploss/
    ├── failed/ · explorer/ · session/ · distribution/ · validation/
    ├── lab/                     Research Lab
    ├── sloptimizer/             Stop Loss Optimizer
    ├── strategyfinder/          Historical Strategy Finder
    ├── repository/              Research Repository
    ├── ranking/                 Strategy Ranking
    ├── details/                 Strategy Details
    ├── replay/                  Replay Engine
    ├── comparison/              Strategy Comparison
    ├── probability/             Probability Engine + Opportunity Scanner
    └── market/                  Market Context
```

## Mapping to the canonical domains

The Constitution names canonical domains (`research/`, `repository/`,
`probability/`, `reliability/`, `validation/`, `reports/`, `hooks/`,
`constants/`, `services/`). In this codebase those domains are realised as:

| Canonical domain | Realised as |
|---|---|
| `research/` | `utils/scenario.ts` + `components/lab`, `sloptimizer`, `strategyfinder` |
| `repository/` | `context/RepositoryContext.tsx` + `utils/researchRepository.ts` + `components/repository` |
| `probability/` | `utils/probability.ts` + `utils/opportunity.ts` + `components/probability` |
| `reliability/` | *future* — `utils/reliability.ts` + `components/reliability` |
| `validation/` | `utils/validation.ts` + `components/validation` |
| `reports/` | `utils/reports.ts` + *future* `components/reports` |
| `hooks/` | co-located with their module (e.g. `components/strategyfinder/useStrategyExecution.ts`) |
| `constants/` | per-module constant blocks + `components/layout/moduleMeta.ts` |
| `services/` | not required — GRT is fully client-side with no external services |

**Future modules** should follow the engine-in-`utils` / view-in-`components`
pattern. New top-level domain folders (`reliability/`, `reports/`) may be added
when those modules are built.
