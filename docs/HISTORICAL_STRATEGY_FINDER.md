# HISTORICAL STRATEGY FINDER — Ecosystem Reference (FROZEN)

> **Status: FROZEN.** This document is the authoritative specification of the
> entire Historical Strategy Finder ecosystem: parameter generation, research
> execution, the Research Repository, Strategy Ranking, Strategy Details, the
> Replay Engine and Strategy Comparison. The research methodology is immutable;
> only UI / performance / export / visualization may change (see §18).
>
> The Finder performs **no calculations** — it orchestrates the frozen
> **Research Engine v1.0**. Everything downstream **reads stored results**; the
> engine is never rerun for ranking, details, replay or comparison.
>
> **Sources:** `utils/strategyFinder.ts`, `utils/strategyExecution.ts`,
> `components/strategyfinder/*`, `context/RepositoryContext.tsx`,
> `utils/researchRepository.ts`, `utils/strategyRanking.ts`,
> `utils/strategyDossier.ts`, `utils/replay.ts`, `utils/strategyComparison.ts`,
> and the matching `components/*` folders.

---

## 1. Purpose

The Historical Strategy Finder automatically evaluates **thousands of historical
parameter combinations** to discover statistically strong **historical**
parameter sets (Entry / Recovery / Stop-Loss).

- It is a **historical parameter discovery engine**, not a trading engine.
- It never predicts future markets and never recommends trades.
- It runs the frozen Research Engine per combination and stores the results; all
  ranking, profiling, replay and comparison happen on those **stored** results.

---

## 2. Research question

> **Which historical Entry / Recovery / Stop-Loss combinations produced the
> strongest statistical outcomes?**

"Strongest" is described by explicit, deterministic statistics and a documented
ranking score — never a prediction or recommendation.

---

## 3. User inputs (the Finder page)

`StrategyFinderInput`:

| Input | Field | Notes |
|---|---|---|
| Entry Gap Range | `entry: {start, end, step}` | Ladder built start→end by step. |
| Recovery Gap Range | `recovery: {start, end, step}` | |
| Stop Loss Range | `stopLoss: {start, end, step}` | |
| Minimum Historical Events | `minTrades` | Passed to the engine as `minEvents` per combination (confidence floor). |
| Maximum Holding | `maxHoldingMinutes` | Optional; `null` = uncapped. |
| Same Day Only | `sameDayOnly` | |
| Date Range / Recent Research Window | `dateRange: {from, to}` | Pre-filters the (already globally-filtered) samples before execution. |
| Session Filter | `sessions` | Applied by the engine per combination. |

> **Minimum Recovery %** and **Research Confidence** are **not** Finder inputs —
> they are applied later, at the **Strategy Ranking** stage (§8, RankingFilters).
> The Finder discovers and executes; ranking filters and scores.

---

## 4. Generation engine (Phase 11A)

`generateStrategies(input)` builds the three ladders and takes their cartesian
product:

```
Entry:     16.00 → 16.10 → 16.20 → …
Recovery:  13.00 → 13.10 → 13.20 → …
Stop Loss: 18.00 → 18.10 → 18.20 → …
```

Each combination becomes a **parameter object** with a unique id (`SF-00001…`),
the three gaps, holding, same-day, date range, session, a `status` and a
`validationResult`.

**Validation (deterministic, before any engine call):**

| Rule | Result |
|---|---|
| Invalid numeric value | `INVALID` — "Invalid numeric value" |
| Recovery ≥ Entry | `INVALID` — "Recovery Gap ≥ Entry Gap" |
| Stop Loss ≤ Entry | `INVALID` — "Stop Loss ≤ Entry Gap" |
| Recovery ≥ Stop Loss | `INVALID` — "Recovery Gap ≥ Stop Loss" |
| Duplicate triplet | `DUPLICATE` |
| Otherwise | `READY` |

The cartesian product is capped at **`MAX_COMBINATIONS = 20000`** (`truncated`
flagged). The generation summary reports Generated / Valid / Rejected /
Duplicate / Invalid. Only **READY** combinations proceed.

---

## 5. Research execution (Phase 11B)

`useStrategyExecution(readyCombos, dateFilteredSamples, minEvents)` runs the
engine sequentially over the READY combinations.

- For each READY combination it builds a `ScenarioInput` and calls
  **`computeScenario`** — the Finder performs **no calculations** itself.
- Status lifecycle per combination: **READY → RUNNING → COMPLETED / FAILED /
  CACHED**.
- Sequential, one at a time, yielding between strategies so the table updates
  live; pause / resume / stop / restart supported; resume continues from the
  next READY; completed strategies never rerun.
- Per-strategy error isolation: a failure marks **FAILED** (reason logged) and
  execution continues.
- A run cache keyed on (entry/recovery/SL/sameDay/dateRange/session) makes
  identical strategies load as **CACHED** instead of rerunning the engine; the
  cache clears when the dataset changes.
- Progress: Total / Completed / Running / Remaining / Cached / Failed, Elapsed,
  ETA, research speed, average execution time.

The result object stored per COMPLETED strategy (`StrategyResearchResult`)
carries the full engine outputs plus the captured per-occurrence events
(`OccurrenceRecord[]`) used later by Details and Replay.

---

## 6. Filter engine

Filtering happens at two stages:

1. **Generation validation** (§4) — rejects structurally invalid combinations
   (recovery vs entry vs SL) and duplicates before any engine call.
2. **Ranking filters** (`RankingFilters`, §8) — applied to **stored** results:
   - Minimum Recovery Before SL %, Minimum Recovery Ignoring %, Maximum SL Hit %,
     Minimum Historical Trades, Maximum Avg Recovery Time, Maximum Worst Gap,
     Minimum Research Confidence.

The engine itself also applies **Same Day**, **Session**, **Sync** and
**Max Holding** per scenario, and the Finder pre-filters samples by **Date Range
/ Research Window**. So the requested filters map to: generation validation +
engine scenario filters + ranking filters.

---

## 7. Research Repository

`RepositoryContext` is the centralized, **de-duplicated** store of COMPLETED
strategy results. The Strategy Finder publishes COMPLETED results into it (READY
/ RUNNING / FAILED are ignored); everything downstream reads from it.

**Stored fields (`RepositoryRecord`):** stable `key` + `id`; `entryGap`,
`recoveryGap`, `stopLoss`; `recoveryBeforeSlPct`, `recoveryAfterSlPct`,
`recoveryIgnoringSlPct`, `slHitPct`; `totalPositions`, `historicalTrades`;
`avgRecoverySec`, `medianRecoverySec`; `avgMaxGap`, `worstMaxGap`, `p95MaxGap`,
`p99MaxGap`; `avgHoldingSec`; `confidenceLevel` / `confidenceLabel`;
`executionMs`; `createdAt` (timestamp); the research context (`sameDayOnly`,
`dateFrom`, `dateTo`, `sessions`); and the captured `occurrences`.

> Mapping to the requested fields: Entry/Recovery/Stop-Loss, Recovery %, SL %,
> Average Holding, Worst/Average Expansion (the max-gap fields), Historical
> Events (`totalPositions`/`historicalTrades`), Confidence and Timestamp are all
> stored. **Score is NOT stored** — it is computed deterministically by the
> Ranking module on demand (so it always reflects the chosen ranking mode).

De-duplication: records are keyed; re-publishing identical results is a no-op
(no duplicates, no reruns). The Repository tracks `createdAt` / `updatedAt` and
supports search/filter/sort and CSV / JSON / backup export.

---

## 8. Strategy Ranking

`rankStrategies(records, filters, mode)` — **deterministic, historical
statistics only; no AI, no hidden weighting, no subjective decisions**
(Constitution Rule 9).

It first **filters** (RankingFilters, §6), then scores every eligible record
0–100 from six normalized, cohort-relative components and a per-mode weight set:

- **Components:** Recovery, SL Safety, Confidence, Trade Count, Recovery Time,
  Worst Gap Risk.
- **Modes:** `BALANCED`, `HIGHEST_RECOVERY`, `LOWEST_RISK`, `FASTEST_RECOVERY`,
  `MOST_TRADES` — each with explicit, documented weights summing to 100 (Balanced
  = recovery 30 / SL-safety 20 / confidence 20 / trades 15 / recovery-time 10 /
  worst-gap 5).
- Non-finite scores are excluded and counted; deterministic tie-breaks (score →
  recovery → deeper target → key). The ranked table shows every component plus
  the overall score, with highlights ("Historically Top Ranked", etc.) and
  CSV/JSON export.

Ranking reads the Repository; it never reruns the Research Engine.

---

## 9. Strategy Details (Dossier)

`buildDossier(record)` builds a complete read-only research profile for one
strategy from its **stored** record + occurrences:

- **Summary / Statistics** — identity, performance (recovery before/after,
  SL-not-recovered, %s, recovery times) and gap behaviour (avg/median/P90/P95/P99/
  worst max gap, average & maximum compression).
- **Expansion / Holding** — gap distribution and holding context.
- **Sessions** — per-session occurrences, recovery %, holding, SL-hit.
- **Monthly** — month-by-month occurrences, recovery, holding.
- **Charts** — session bar + pie, outcome pie, recovery-time histogram, monthly
  bar.
- **Timeline / Historical Outcomes** — the Occurrence Explorer (one row per
  occurrence: date, time, session, entry gap, max gap, recovery gap, recovery
  time, holding time, outcome), plus quick stats and objective observations.

Wording is descriptive ("Historically Strong / Consistent / High Confidence") —
never "best" or "recommended". Reached from the Ranking page ("Details →"); a
"Compare" toggle adds it to the comparison selection.

---

## 10. Replay Engine

The Replay Engine **visualises** one historical occurrence — it never
recalculates. It reads the occurrence from the Repository and reconstructs the
chronological gap path from the loaded dataset samples (read-only).

- **Timeline** — per-sample gap path with Entry / Recovery / Stop-Loss reference
  levels and located markers (entry, max expansion, recovery start, recovery,
  stop loss, exit); revealed up to the cursor.
- **Playback** — Play / Pause / Resume / Stop / Restart / Next / Prev event,
  speeds 0.5×–8×, jump-to-time scrubber, paced by real inter-sample time ÷ speed.
- **Navigation / occurrence selection** — Prev / Next occurrence and occurrence
  search; opened from the Strategy Details occurrence explorer.
- **Live stats / outcome** + CSV / PDF / PNG export.

If the loaded dataset does not contain an occurrence's samples, Replay shows a
clear message rather than guessing — it consumes stored data only.

---

## 11. Strategy Comparison

`buildComparison(records)` compares **2–5** stored strategies side-by-side and
**never reruns the Research Engine**.

- **Metrics** — Entry/Recovery/SL, Historical Trades, Recovery Before/After/
  Ignoring %, SL Hit %, Avg/Median Recovery, Worst/Avg/P95/P99 Gap, Confidence,
  and Overall Score (the latter computed via the frozen Ranking score in Balanced
  mode over the selection), with directional best/worst highlighting.
- **Difference analysis** — difference / % difference / relative vs a baseline.
- **Session & Monthly** comparison matrices; **Risk** comparison.
- **Charts** — radar, recovery-vs-SL-hit bar, per-strategy scatter, outcome
  distribution.
- **Observations** + CSV / JSON / PDF export.

Session/monthly/outcome data come from the frozen Dossier; the score from the
frozen Ranking — no recalculation.

---

## 12. Export

| Module | Exports |
|---|---|
| Repository | CSV · JSON · **Backup** (full JSON with provenance) |
| Ranking | CSV · JSON (filters + mode in metadata) |
| Strategy Details | CSV (occurrences) · JSON · **PDF** (printable report) |
| Replay | CSV · **PDF** (printable) · **PNG** (chart) |
| Comparison | CSV · JSON · **PDF** (printable) |

PDF today is a printable HTML report (browser "Save as PDF"). A richer composed
PDF report is part of the future **Reports** module.

---

## 13. Performance

- **Batch execution** — combinations run sequentially, yielding between each so
  the UI stays responsive and the table updates live.
- **Repository caching / no duplicate research** — the run cache loads identical
  strategies as CACHED; the Repository de-duplicates by key; downstream modules
  read stored results and never rerun the engine.
- **Reuse previous results** — Ranking, Details, Replay and Comparison all read
  the Repository / stored occurrences; Comparison reuses the Dossier and Ranking
  score.
- **Memoization** — generation, ranking, dossier, comparison and replay path are
  all memoized on their real inputs.
- **Bounded** — generation capped at 20,000 combinations; large tables
  render-cap (~500–1000 rows) with a "showing first N" note (virtualization is
  the planned approach for very large repositories).

---

## 14. Dependencies

- **CSV / Data Manager** — provides `filteredSamples`; the Finder pre-filters by
  date range before execution.
- **Research Engine** — the only calculation engine; called once per READY
  combination during execution.
- **Research Repository** — stores COMPLETED results; the source of truth for
  Ranking, Details, Replay and Comparison.

**Consumes Research Engine outputs only.** The **Probability Engine is not a
dependency** of this ecosystem — it is a separate engine answering a different
question; the Finder ecosystem neither uses it nor is used by it.

---

## 15. CSV verification

Choose one strategy and verify end-to-end:

1. **Entry / Recovery / Stop Loss / Holding / Expansion** — verify the strategy
   as a single Research Lab scenario (`RESEARCH_LAB.md` §11), confirming the
   engine output for its Entry/Recovery/SL on the scoped samples.
2. **Repository** — confirm the stored record's fields equal that engine output
   (recovery %s, SL %, holding, max-gap percentiles, confidence, events).
3. **Ranking** — confirm the record's score equals the documented deterministic
   formula for the chosen mode, and the rank position is consistent with the
   sorted scores.
4. **Details** — confirm the dossier's session/monthly/outcome aggregates and
   per-occurrence rows match the stored occurrences.
5. **Replay** — confirm the replayed path matches the actual CSV samples for that
   occurrence's window (entry / max / recovery / SL markers at the right rows).
6. **Comparison** — confirm each compared metric equals the corresponding stored
   record value.

Because every number traces back to one Research Engine call (already
CSV-validated) and stored results, the whole ecosystem is verifiable.

---

## 16. Edge cases

| Case | Behaviour |
|---|---|
| **Zero valid strategies** | All combinations INVALID/DUPLICATE → nothing READY; generation summary shows it; nothing executes. |
| **Huge parameter ranges** | Cartesian product capped at 20,000 (`truncated` flagged with a warning). |
| **Small step sizes** | More combinations → more engine calls, up to the cap; execution is sequential with live progress. |
| **Very large repository** | Tables render-cap with "showing first N"; search/filter/sort operate on the full set. |
| **Duplicate strategies** | Rejected at generation (DUPLICATE) and de-duplicated by key in the Repository — never executed or stored twice. |
| **Large CSV** | Single-pass engine + memoization keep recompute bounded. |
| **Empty CSV / no data** | Empty states; no READY combinations execute. |
| **Invalid ranges** (start > end, recovery ≥ entry, SL ≤ entry) | Rejected at generation with a clear validation result; the engine is never called for them. |

---

## 17. Acceptance criteria

The Historical Strategy Finder ecosystem is accepted only if:

1. Generated strategies' executed results match the Research Engine exactly.
2. The Repository stores results identical to the engine output (no drift).
3. Ranking scores/order match the documented formula over the stored records.
4. Replay matches the CSV samples for each occurrence.
5. Comparison values match the underlying statistics.
6. No duplicate calculations exist — one engine call per combination; everything
   else reads stored results.

---

## 18. Change policy

- **The Historical Strategy Finder ecosystem is frozen.** The research
  methodology (generation validation, engine usage, repository de-dup, ranking
  formula/weights, dossier aggregation, replay reconstruction, comparison) is
  immutable.
- **Future improvements are limited to UI, performance, export and
  visualization.** A change to any formula or methodology is a new version, with
  CSV proof and a doc update — never a silent edit.
- This document and the implementation must always agree.
