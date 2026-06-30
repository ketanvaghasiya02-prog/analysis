# CODING STANDARDS — Gap Research Terminal

TypeScript strict mode is mandatory (`strict`, `noUnusedLocals`,
`noUncheckedIndexedAccess`). The build (`tsc -b && vite build`) must pass clean
with zero type errors before any change is committed.

## Naming

- **Files:** engines `camelCase.ts` (`probability.ts`); components
  `PascalCase.tsx` (`ProbabilityView.tsx`); hooks `useThing.ts`.
- **Types/interfaces:** `PascalCase` (`ProbabilityResult`, `RankingFilters`).
  Do not prefix interfaces with `I`.
- **Functions:** verbs — `computeProbability`, `buildDossier`, `rankStrategies`,
  `scanOpportunities`. Engines are named `compute* / build* / run* / scan*`.
- **Constants:** `UPPER_SNAKE_CASE` (`DEFAULT_PROBABILITY_INPUT`, `MAX_TARGETS`).
- **Booleans:** `is/has/should` (`hasData`, `isPlaceholderView`).
- **Wording:** never use trading verbs (buy/sell/enter/TP/SL) in identifiers,
  labels or comments for outputs — use *historical / evidence / compression*.

## Folder rules

- One **domain folder** per module under `components/<domain>/`.
- The module's calculation lives in `utils/<module>.ts`. If it has multiple
  concerns, split into `<module>.ts` + `<module>Intelligence.ts` (as Stop Loss
  Optimizer does), never one mega-file.
- Shared helpers (`format`, `date`, `statistics`) are imported, never copied.

## Engines (utils)

- **Pure & deterministic** (Constitution Rules 3, 8). No React, no DOM, no
  network. Inputs in, value out.
- **No `Math.random()`** in business logic. **No `Date.now()`** inside a
  calculation — only for display timestamps stamped at the edge.
- A new engine must export: its `Input` type, a `DEFAULT_*_INPUT` constant, its
  `Result` type, and a single `compute*/build*` entry point.
- **Never duplicate Research Engine logic** (Constitution Rule 2). Consume
  `computeScenario`; do not reimplement the position model.
- **Reproducibility:** any number returned must be derivable from the input
  samples. Document the formula in the file header.

## Hooks

- Co-locate a module's hook with its component
  (`useStrategyExecution.ts`, `useReplayPlayer.ts`).
- Hooks own UI/orchestration state (playback, run loops); they do not own
  business formulas — those stay in `utils`.
- Async/sequential orchestration uses refs as the source of truth and commits
  to state for rendering (see `useStrategyExecution`). Always clean up timers.

## Components / views

- **Thin.** Read engine output via `useMemo(() => engine(inputs), [inputs])` and
  render. No business formulas in JSX.
- Inputs panels hold local state; the engine runs in a memo keyed on
  `[samples/records, input]`.
- Reuse shared primitives: `StatCard`, `EmptyState`, `InfoTip`, `ChipMultiSelect`,
  the icon set, and `PageHeader`/`ModulePlaceholder`.
- Tables: sortable headers, optional filter/search, render-cap large lists
  (~500–1000 rows) with a "showing first N" note.

## Types / interfaces

- Domain types live in `types/gap.ts`; module types live with the module's
  engine and are exported from it.
- Prefer explicit result interfaces over inlined anonymous shapes.
- Respect `noUncheckedIndexedAccess`: guard array access (`?? null`, `!= null`)
  or assert (`!`) only when an invariant guarantees presence.

## Performance (see `PERFORMANCE.md` for detail)

- **Memoize** every engine call (`useMemo` keyed on the real inputs).
- **One scan, many outputs.** A single pass computes everything it can (e.g. the
  Probability Engine evaluates all targets in one scan). Never loop an engine
  per output row.
- **Reuse, don't recompute.** Presentation layers read existing results (the
  Opportunity Scanner reads the probability matrix; Ranking reads the
  repository). Re-deriving an existing number is a bug.
- **Cache** expensive repeated work where identity is stable (the Strategy
  Finder caches by parameter key so identical strategies never rerun).

## No duplicated business logic

If two modules need the same computation, it lives in **one** util and both
import it. Copy-pasted formulas are prohibited — they break determinism and
Constitution Rule 2.

## Commits / review

- Build must be green; no `any` unless unavoidable and justified.
- A change to a **frozen** module's calculation is rejected by default.
- New modules ship with a CSV verification procedure (`VALIDATION.md`).
