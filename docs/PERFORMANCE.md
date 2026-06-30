# PERFORMANCE — Gap Research Terminal

GRT parses and analyses CSV entirely in the browser. Performance discipline is
also a **correctness** discipline: avoiding duplicate scans is how we honour
Constitution Rule 2 (no duplicated calculations).

## Rules

### 1. Memoize every engine call
Run engines inside `useMemo(() => engine(inputs), [inputs])`, keyed on the
**real** inputs (`filteredSamples`/`records` + the input object). The engine
must not run on unrelated re-renders.

### 2. One scan, many outputs
A single pass computes everything it can. Examples already in the codebase:
- **Probability Engine** evaluates **all targets together** in one forward scan
  per event — never one scan per target.
- **Stop Loss Optimizer** runs the Research Engine once per SL level and derives
  all per-level metrics from that single result.

Looping an engine to produce each output row is prohibited.

### 3. Never recompute an existing number
Presentation layers read prior results:
- **Opportunity Scanner** reads the Probability matrix; it never recomputes a
  probability.
- **Ranking / Details / Comparison** read the Repository; they never rerun the
  Research Engine.
- **Replay** reconstructs from stored samples; it never re-simulates outcomes.

### 4. Cache by stable identity
When the same expensive computation may recur, cache it by a stable key:
- The **Strategy Finder** caches execution results by parameter key
  (entry/recovery/SL/sameDay/dateRange/session) so identical strategies are
  never rerun; cache clears when the dataset changes.

### 5. Bound and cap
- Parameter grids and target ladders are **capped** (e.g. 400 steps, 20k
  combinations) with a visible truncation note — never silently unbounded.
- Large tables **render-cap** to ~500–1000 rows with "showing first N", while
  the underlying engine still processes the full set.

### 6. Keep the UI responsive during heavy work
- Use `useDeferredValue` for heavy recompute paths so input stays responsive,
  with a visible "Recalculating…" indicator (Stop Loss Optimizer pattern).
- Sequential engine runs (Strategy Finder execution) yield between items via
  scheduled ticks so the table updates live and the main thread stays free.

### 7. Stable, animation-free charts
Charts set `isAnimationActive={false}` for instant, deterministic rendering and
to avoid re-animation on every data tick.

### 8. Lazy loading (future)
As the bundle grows (Recharts is the largest chunk), future work may
code-split heavy modules via dynamic `import()` and route-level lazy loading.
Virtualized tables are the planned approach for very large repositories.

## Anti-patterns (rejected in review)

- Calling an engine inside a render without memoization.
- Recomputing a value another module already produced.
- Per-row engine calls where a single scan would do.
- Unbounded scans or unbounded DOM table rows.
- Hidden caches that aren't invalidated when the dataset changes.
