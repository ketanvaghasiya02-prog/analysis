# RESEARCH ENGINE — Complete Reference (v1.0, FROZEN)

> **Status: FROZEN / production-ready.** This document is the permanent,
> authoritative specification of the Research Engine. A senior engineer should be
> able to rebuild the engine exactly from this document alone. The algorithm,
> calculations, outputs and UI must not change (see §16 Change Policy).
>
> **Source of truth:** `src/utils/scenario.ts`
> **Version constant:** `RESEARCH_ENGINE_VERSION = "Research Engine v1.0 — CSV validated"`
> **Exact-touch tolerance:** `EPS = 1e-9`

---

## 1. Purpose

The Research Engine is the **single calculation engine** of GRT. It simulates a
research position over a chronological array of gap samples and reports, purely
from historical CSV data, what happened after entry.

- It is the **only** module permitted to compute scenario outcomes.
- Every other module **consumes** its output (directly, or via stored results).
- **No future module may duplicate its calculations** (Constitution Rule 2).
- It performs research only — no prediction, no signals, no recommendations.

Entry point: `computeScenario(samples: GapSample[], input: ScenarioInput): ScenarioResult`.

---

## 2. Research question

> **Given an Entry Gap, a Recovery Gap and a Stop-Loss Gap, what historically
> happened after entry?**

For each historical entry it determines: did the spread compress to the recovery
level, did its adverse path touch the stop-loss level first, how long did it
take, and how far did it expand — then aggregates these across all events.

---

## 3. Inputs (`ScenarioInput`)

The engine receives an **already-filtered** sample array plus a scenario object.
Date-range and global dataset filtering happen upstream in the Data Manager; the
engine applies the scenario-level session/sync filters itself, on the entry
sample.

| Input | Field | Meaning |
|---|---|---|
| Entry Gap | `entryGap` | Level whose first upward touch opens a position. |
| Recovery Gap | `recoveryGap` | Target level; first touch at/below it = recovery. Must be `< entryGap`. |
| Stop Loss Gap | `stopLoss` | Adverse level; first touch at/above it marks SL on the path. Must be `> entryGap`. |
| Same Day Only | `sameDayOnly` | If true, an open position closes when the day (`dayKey`) changes. |
| Minimum Holding | — | Not an engine input; holding is measured, not bounded below. |
| Maximum Holding | `maxHoldingMinutes` | Optional cap (minutes); exceeding it closes the position. `null` = uncapped. |
| Session Filter | `sessions` | If non-empty, a touch only opens a position when the entry sample's `currentSession` is in the set. |
| Sync Status | `syncStatuses` | If non-empty, a touch only opens a position when the entry sample's `syncStatus` is in the set. |
| Minimum Events | `minEvents` | Confidence floor — a sample below this can never read High/Very-High. |
| Recent Research Window | — | Applied upstream (Data Manager) before the samples reach the engine. |
| CSV Source | `samples` | The chronological `GapSample[]` (sorted by timestamp), already filtered. |

The gap field used throughout is `sample.gap`. Timing uses `sample.timestampMs`;
day bucketing uses `sample.dayKey` (`YYYY-MM-DD`).

---

## 4. Entry logic (event creation)

The scan is **position-based**: at most one simulated position is open at a time.

**Exact-touch entry — first touch of the entry gap from below.** Iterating
`i = 1 … n-1` over consecutive samples `(prev = samples[i-1], cur = samples[i])`:

```
isEntry =  prev.gap < entryLevel
       AND  cur.gap  >= entryLevel - EPS
```

- A null `gap` on either sample → not an entry; advance `i`.
- If `sessions`/`syncStatuses` filters are set and the entry sample (`cur`) does
  not match → the touch is ignored (no position opens); advance `i`.
- On a valid entry: `totalEvents += 1`; record `entryDay = cur.dayKey`,
  `entryGap = cur.gap`, `entryTs = cur.timestampMs`, `entryTime = cur.serverTime`.

**One position at a time / duplicate prevention.** After an entry, the engine
runs the forward scan (§5) to a terminal, computes the exit index, then resumes
the outer loop at **`i = exitIndex + 1`**. Because scanning resumes *after* the
close, repeated touches of the entry gap *inside* an already-open position can
never create extra positions. A new event starts only at the next first-touch
crossing that occurs after the previous position has closed.

---

## 5. Forward scan

From `j = i + 1` to `n-1`, processed strictly **chronologically**:

1. **Same-day close** — if `sameDayOnly` and `s.dayKey !== entryDay`:
   `terminal = 'day'`, **break** (the new-day sample is not consumed).
2. **Elapsed time** — `tsec = (s.timestampMs - entryTs) / 1000`, or `null` if
   either timestamp is missing.
3. **Max-holding close** — if `maxHoldingSec != null` and `tsec > maxHoldingSec`:
   `terminal = 'holding'`, **break**.
4. **Null gap** — skip the sample (`continue`).
5. **Track extremes & SL touch (in this order):**
   - `lastIndex = j`; if `tsec != null` then `lastTimeSec = tsec`.
   - `maxGap = max(maxGap, s.gap)` — running maximum gap after entry.
   - `minGap = min(minGap, s.gap)` — running minimum gap after entry.
   - `firstSlHitSec` — set to `tsec` the **first** time `s.gap >= stopLoss - EPS`
     (recorded once; never overwritten).
6. **Recovery close (first touch)** — if `s.gap <= recoveryGap + EPS`:
   `recovered = true`, `recoveryIndex = j`, `recoveryTimeSec = tsec`,
   `terminal = 'recovery'`, **break**.

`maxGap` / `minGap` are seeded with `entryGap`, so the entry sample is included
in the extremes. **Holding time** for the event is `durationSec` (§6).

---

## 6. Recovery logic & holding time

Recovery is **first touch at or below the recovery gap** (step 6 above), which
immediately closes the position. From the scan results the engine derives:

- `exitIndex = recovered ? recoveryIndex : lastIndex`
- `durationSec` (holding time):
  - recovered → `recoveryTimeSec`
  - else if outcome is `SL_NOT_RECOVERED` → `firstSlHitSec ?? lastTimeSec`
  - else → `lastTimeSec`

Non-recovery terminals: `terminal = 'day'` (same-day boundary),
`terminal = 'holding'` (max-holding exceeded), `terminal = 'dataset'` (scan
reached the end of samples). These feed outcome classification (§8).

---

## 7. Stop-loss logic (one-touch, classification boundary)

**Important — read carefully; this is the most commonly misunderstood part.**

In Research Engine v1.0 the stop-loss is a **one-touch classification boundary**
applied to the position's adverse path. It is **not** a scan terminal: touching
the stop-loss does **not** close the position.

- During the scan the engine records, **one-touch**, the first elapsed time the
  gap reached the SL level (`firstSlHitSec`, set once when `gap >= stopLoss - EPS`).
- The position continues scanning until recovery / day / holding / dataset.
- The outcome is then classified by **whether the adverse path ever touched SL**,
  i.e. by `maxGap >= stopLoss - EPS` (first touch ⇔ the running max reached SL).

This one-touch, max-based rule is what makes the classification deterministic and
re-usable: `classifyAtSl(event, sl)` can reclassify the **same** scanned event
for **any** stop-loss level without rescanning — which is why downstream sweeps
are cheap and never duplicate the scan.

```
classifyAtSl(event, sl):
  if event.recovered:
     return (event.maxGap >= sl - EPS) ? RECOVERED_AFTER_SL : RECOVERED_BEFORE_SL
  if event.maxGap >= sl - EPS:           return SL_NOT_RECOVERED
  switch event.terminal:
     'day'     -> DAY_END
     'holding' -> HOLDING_TIME_EXPIRED
     default   -> DATASET_END
```

**Chronological priority:** because samples are processed in time order and
`firstSlHitSec` is the first qualifying timestamp, "SL touched" always reflects
the earliest adverse touch. `slHitTimeSec = slHit ? firstSlHitSec : null`.

> Engines that need SL to *close* the position (e.g. the separate Probability
> Engine) implement that themselves; the Research Engine deliberately does not,
> so a single scan supports SL reclassification at any level.

---

## 8. Event outcomes (`ScenarioOutcome`)

Every opened position resolves to **exactly one** of six outcomes:

| Outcome | Condition |
|---|---|
| `RECOVERED_BEFORE_SL` | Recovered, and `maxGap < stopLoss` (never touched SL). |
| `RECOVERED_AFTER_SL` | Recovered, but `maxGap >= stopLoss` (touched SL first/along the way). |
| `SL_NOT_RECOVERED` | Not recovered, and `maxGap >= stopLoss`. |
| `DAY_END` | Not recovered, no SL touch, closed by same-day boundary. |
| `HOLDING_TIME_EXPIRED` | Not recovered, no SL touch, closed by max-holding. |
| `DATASET_END` | Not recovered, no SL touch, scan reached end of data. |

**"Cancelled" / "Invalid":** the engine has no such *outcome*. A touch that is
filtered out (session/sync mismatch, or a null gap) simply **does not open a
position** — it is not an event and is not counted. Invalid CSV rows are
excluded **upstream** by the parser/validation layer before the engine runs, so
the engine only ever sees valid samples.

**Accounting invariant:** the six outcome counts sum to `validEvents`
(`accountingOk === true`). Every event lands in exactly one bucket.

---

## 9. Statistics (`ScenarioResult` summary)

`pct(x) = validEvents > 0 ? (x / validEvents) * 100 : 0`.

| Requested metric | Engine field | Definition |
|---|---|---|
| Total Events | `validEvents` (`= events.length`) | Positions opened (`totalEvents` equals this). |
| Recovery % (ignoring SL) | `recoveryPctIgnoringSl` | `pct(before + after)` |
| Recovery Before SL % | `recoveryBeforeSlPct` | `pct(RECOVERED_BEFORE_SL)` |
| Recovery After SL % | `recoveredAfterSlPct` | `pct(RECOVERED_AFTER_SL)` |
| SL % | `slHitPct` | `pct(RECOVERED_AFTER_SL + SL_NOT_RECOVERED)` — share whose adverse path touched SL. |
| Unresolved % | `unresolvedPct` | `pct(DAY_END + DATASET_END + HOLDING_TIME_EXPIRED)` |
| Average / Median / Max Holding | `avgRecoveryTimeSec` / `medianRecoveryTimeSec` / `maxRecoveryTimeSec` | Recovery-time distribution over **recovered** events (seconds). Per-event holding is `event.durationSec`. |
| Average MAE | `adverse.avg` | Mean of `maxGap` across events. |
| Median MAE | `adverse.median` | |
| P90 / P95 / P99 MAE | `adverse.p90` / `adverse.p95` / `adverse.p99` | |
| Worst MAE | `adverse.worst` | `max(maxGap)`. |
| Average Expansion | `adverseExpansionStats.avg` | Mean of `maxGap − entryGap`. |
| Worst Expansion | `adverseExpansionStats.worst` | `max(maxGap − entryGap)`. |

Additional summary fields: `favorable` (`avg`/`median`/`best` of
`favorableMove = entryGap − minGap`), `minGapStats` (`avg`/`best`),
`entryGapAvg`, `riskReward` (`reward = entryGapAvg − recoveryGap`,
`risk = stopLoss − entryGapAvg`, `rr = reward / risk`), and `confidence` (§10).

**Distribution percentiles** use linear interpolation between ranks
(`rank = p/100 · (count−1)`). Median uses the standard even/odd rule.

**Confidence** (`ScenarioConfidence`) is a 0–1 score averaged from four factors —
sample size, day coverage, sync quality, completeness (resolved %) — mapped to a
5-level scale `VERY_LOW … VERY_HIGH`, then **capped by sample size** so a tiny
sample can never read High/Very-High. It is descriptive of *evidence strength*,
not reliability (Constitution Rule 5 — reliability is a separate, future module).

---

## 10. Data model (objects returned)

### `ScenarioEvent` (one per opened position)
`id` (`POS-0001…`), `startIndex`, `endIndex`, `recoveryIndex`, `date`,
`entryTime`, `entryGap`, `exitTime`, `exitGap`, `maxGap`, `minGap`,
`favorableMove` (`entryGap − minGap`), `recovered`, `recoveryHit`, `slHit`
(`maxGap >= stopLoss`), `recoveryTimeSec`, `slHitTimeSec`, `durationSec`,
`terminal` (`recovery | day | holding | dataset`), `outcome` (§8), `session`,
`syncStatus`.

### `ScenarioResult` (the summary)
`input`, `totalEvents`, `validEvents`, `counts` (per-outcome map), the six count
fields, `unresolved`, the percentage fields (§9), `outcomeTotal`,
`accountingOk`, recovery-time stats, `adverse` (`DistributionStats`),
`favorable`, `minGapStats`, `adverseExpansionStats`, `entryGapAvg`,
`riskReward`, `confidence`, and `events: ScenarioEvent[]` (the full timeline).

### Supporting types
- `ScenarioOutcome` — the six-value union (§8).
- `DistributionStats` — `{ avg, median, p90, p95, p99, worst }` (nullable).
- `ScenarioConfidence` — `{ level, score, factors:{ events, syncQualityPct, unresolvedPct, daysCovered } }`.
- `RESEARCH_ENGINE_VERSION` — the frozen version string.

The per-event `events[]` array **is** the timeline; consumers that need a
sample-level path use `buildScenarioPath(samples, event, sl)` (a read-only
helper that re-reads the source samples, never re-simulates).

---

## 11. Dependencies (who consumes the engine)

**Direct consumers** of `computeScenario`:
- **Research Lab** — one scenario per run.
- **Stop Loss Optimizer** — one call per stop-loss level.
- **Historical Strategy Finder** (execution) — one call per READY combination.

**Indirect consumers** (read **stored** engine results from the Repository,
never re-run the engine):
- **Research Repository**, **Strategy Ranking**, **Strategy Details**,
  **Replay Engine**, **Strategy Comparison**.

**Independent engines** that follow the same position-model *philosophy* but are
**separate** engines (they answer a different research question and therefore do
not — and must not — duplicate Research Engine logic):
- **Probability Engine** (compression probability per target), **Opportunity
  Scanner** (reads the probability matrix), **Market Context**.

**Future** consumers/composers: **Reliability Engine**, **Walk Forward
Validation**, **Reports**, **AI Research Assistant**, **EA Export** — all must
read existing outputs and obey the Constitution (no prediction, no signals).

---

## 12. Performance

- **Single-pass position scan.** Entry detection walks the array once; each open
  position's forward scan covers a contiguous range, and the outer loop resumes
  at `exitIndex + 1`. Because positions never overlap, **each sample is visited a
  bounded number of times → O(n)** overall.
- **No duplicate event scans.** A region inside a closed position is never
  rescanned for new entries.
- **Memory:** O(events) for the event array; O(1) working state during a scan.
- **Caching opportunity:** `classifyAtSl(event, sl)` reclassifies an event for
  any stop-loss **without rescanning**, so a precomputed event set can be
  re-bucketed across many SL levels cheaply (the basis for cheap SL sweeps).
- Determinism: identical `(samples, input)` always yields identical output — no
  randomness, no wall-clock dependence inside the calculation.

---

## 13. Manual CSV verification

To verify any result by hand from a source CSV (sorted by `ServerTime`):

1. **Entry** — find the first row where the previous `Gap` is below `entryGap`
   and the current `Gap` is `≥ entryGap`. That row is the entry (note its
   `ServerTime`, `Gap`, session, sync).
2. **Forward scan** — from the next row, read `Gap` chronologically; track the
   running max and min `Gap`; note the first row where `Gap ≥ stopLoss`
   (SL touch time) and the first row where `Gap ≤ recoveryGap` (recovery).
3. **Recovery** — if a recovery row exists before any close condition, the event
   recovered; holding = recovery time − entry time.
4. **Stop loss** — if the running max ever reached `stopLoss`, the event is
   "after SL" (if recovered) or "SL not recovered" (if not).
5. **Holding / MAE** — holding = `durationSec` per §6; MAE = running max `Gap`;
   expansion = max `Gap` − entry `Gap`.
6. **Statistics** — repeat for every entry (remembering one-position-at-a-time:
   resume after each close), then compute the percentages, recovery-time stats
   and MAE percentiles exactly as in §9. They must match the app to the displayed
   precision.

The engine was validated this way against the real export (multiple scenarios
matched; accounting invariant held).

---

## 14. Edge cases

| Case | Behaviour |
|---|---|
| **Dataset end** | Scan reaches `n` with no recovery/day/holding → `terminal = 'dataset'`; outcome `DATASET_END` (or `SL_NOT_RECOVERED` if max touched SL). |
| **No recovery** | Closed by day/holding/dataset; outcome by §8 (SL-aware). |
| **No SL** (gap never reaches SL) | `slHit = false`; recovered ⇒ `RECOVERED_BEFORE_SL`; else terminal-based outcome. |
| **Gap exactly = Entry** | `cur.gap >= entryLevel - EPS` is true → exact touch **counts as entry** (requires `prev.gap < entryLevel`). |
| **Gap exactly = Recovery** | `gap <= recoveryGap + EPS` → exact touch **counts as recovery**. |
| **Gap exactly = Stop Loss** | `gap >= stopLoss - EPS` → exact touch **counts as an SL touch** (`firstSlHitSec` set, `slHit = true`). |
| **Missing timestamps** | `tsec = null`; max-holding cannot trigger; times recorded as `null`; `durationSec` may be `null`. No crash. |
| **Duplicate rows** | Processed as ordinary chronological samples; they never create duplicate **positions** (one-position rule), though they are scanned. |
| **Null gap rows** | Skipped for entry (advance `i`) and inside the scan (`continue`); they do not update extremes. |
| **Zero events** | `validEvents = 0`; all percentages `0`; distributions `null`; confidence `VERY_LOW`; `accountingOk = true`. |

---

## 15. Acceptance criteria

The Research Engine is considered correct **only if all** hold:

1. Every statistic matches manual CSV verification (§13) to displayed precision.
2. No duplicate events exist (one position at a time; resume after close).
3. Chronological processing is preserved (strict time order; first-touch).
4. Recovery and stop-loss detection are **one-touch** (recovery first touch
   closes; SL first touch sets the classification boundary).
5. Outputs are deterministic for identical inputs.
6. The accounting invariant holds: outcome counts sum to `validEvents`.

---

## 16. Change policy

- **The Research Engine is FROZEN.** No algorithm change, no calculation
  "optimization", no output change, no UI change.
- **Future modules must never modify the Research Engine.** They consume its
  output or read stored results. Enhancements happen **outside** the engine, as
  new modules or presentation layers.
- **Bug fixes require documented CSV proof:** a reproducible case showing the
  current output is wrong versus hand-verified CSV. A fix bumps the engine
  version (e.g. v1.0 → v1.1) and updates this document; it is never a silent
  in-place edit of frozen logic.
- This document and `src/utils/scenario.ts` must always agree. If they diverge,
  that is a bug in the documentation or an illegal change to the engine.
