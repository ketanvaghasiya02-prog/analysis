# STOP LOSS OPTIMIZER — Complete Reference (FROZEN)

> **Status: FROZEN / CSV-validated.** This document is the authoritative
> specification of the Stop Loss Optimizer. Its research calculations are
> immutable; only visualization / performance / UI / export improvements are
> permitted (see §16). It performs **no scenario calculation of its own** — it
> calls the frozen **Research Engine v1.0** once per stop-loss and derives only
> deterministic, documented summary metrics from those results.
>
> **Source of truth:** `src/utils/slOptimizer.ts`, `src/utils/slIntelligence.ts`,
> `src/components/sloptimizer/*`
> **Engine:** `computeScenario` (`src/utils/scenario.ts`)

---

## 1. Purpose

The Stop Loss Optimizer exists to **statistically analyse historical stop-loss
levels** for a fixed entry/recovery scenario. It does not recommend trades — it
reports historical evidence only.

**How it differs from the Research Lab:**

| | Question answered |
|---|---|
| **Research Lab** | "What happened?" — one scenario (one stop-loss), in full detail. |
| **Stop Loss Optimizer** | "How would different historical stop-loss values have changed the outcome?" — a sweep across many stop-losses, compared. |

The Lab is a microscope on one scenario; the Optimizer is a comparison across a
stop-loss range built from many Lab-equivalent runs.

---

## 2. Research question

> **Given an Entry Gap, a Recovery Gap and a Stop-Loss range, which stop-loss
> levels historically produced the strongest statistical outcomes?**

"Strongest" is described by explicit, deterministic metrics (recovery-before-SL,
risk, holding, confidence) and a documented score — never a prediction or trade
recommendation.

---

## 3. Inputs

### Optimizer inputs (`SlOptimizerInput`)
| Input | Field | Notes |
|---|---|---|
| Entry Gap | `entryGap` | Fixed across the sweep. |
| Recovery Gap | `recoveryGap` | Fixed across the sweep; should be **below** Entry. |
| Minimum Stop Loss | `minStopLoss` | Start of the SL ladder. |
| Maximum Stop Loss | `maxStopLoss` | End of the SL ladder. |
| Step | `step` | SL increment (defaults to 0.1 if ≤ 0). |
| Same Day Only | `sameDayOnly` | Passed to every engine call. |
| Session Filter | `sessions` | Passed to every engine call. |
| Sync Status Filter | `syncStatuses` | Passed to every engine call. |

Default input: Entry 18.00, Recovery 15.50, SL 18.50 → 24.00, step 0.10,
same-day on.

### Scope inputs (not in the optimizer panel)
| Input | Mechanism |
|---|---|
| Date Range / Recent Research Window | Applied via the **global dashboard filter** — the optimizer runs on `filteredSamples`. |
| Minimum Events | Fixed internally at **10** (`minEvents: 10` in each `ScenarioInput`) — the confidence floor; it is not a user field. |

The validation panel reports the run: Total SL Tested, Minimum SL, Maximum SL,
Current Step, Calculation Time, and Research Engine Calls.

---

## 4. Input validation

| Rule | Behaviour |
|---|---|
| Minimum / Maximum SL | The ladder runs from `minStopLoss` upward by `step` to `maxStopLoss`. |
| Min ≥ Max | Warning: *"Minimum Stop Loss must be below Maximum Stop Loss."* (Produces an empty / trivial ladder.) |
| SL Step | `step ≤ 0` is coerced to `0.1`; step input only accepts `> 0`. |
| Step count cap | Ladder capped at **400** steps; if exceeded, `truncated = true` and a warning: *"SL range capped at 400 steps…"* |
| Recovery below Entry / SL above Entry | The optimizer sweeps SL **above** entry by intent; the Research Lab's entry/recovery/SL consistency rules apply per engine call. |
| No positions | If the Entry Gap yields zero positions on the scoped data → warning prompting to adjust Entry/filters. |

Validation is advisory (warnings); the sweep still runs so the user can see the
(degenerate) result.

---

## 5. Optimization workflow

```
User enters Entry · Recovery · SL Range (min/max/step) · same-day · session/sync
        │
        ▼
Build SL ladder:  minStopLoss, +step, … ≤ maxStopLoss   (capped at 400)
        │
        ▼
For each SL candidate:
    ScenarioInput = { entryGap, recoveryGap, stopLoss, maxHoldingMinutes:null,
                      sameDayOnly, sessions, syncStatuses, minEvents:10 }
    result = computeScenario(filteredSamples, ScenarioInput)   ← Research Engine
        │
        ▼
Collect one row per SL  (Pass 1: read engine outputs)
        │
        ▼
Derive comparison metrics  (Pass 2: recoveryGain, riskIncrease, efficiency, score)
        │
        ▼
Summarise:  balanced SL · highlights · marginal-beyond-balanced · meta
        │
        ▼
Render:  validation panel · highlights · summary · sortable table · charts · SL intelligence
```

`runSlOptimizer(filteredSamples, input)` is memoized in the view on
`[filteredSamples, input]` — the sweep reruns only when data or inputs change.

---

## 6. SL sweep

The ladder is built from `minStopLoss`, incremented by `step`, up to and
including `maxStopLoss` (rounded to the step's decimal places):

```
14.20 → 14.30 → 14.40 → 14.50 → 14.60 → …
```

**Each SL is researched independently** by exactly one Research Engine call
(`engineCalls === levels.length`). No SL re-uses another SL's scan; no SL is
scanned twice. The ladder is capped at **400** levels.

> Note (position model): the number of **positions** opened is the same for
> every SL row, because in the Research Engine the stop-loss does not terminate
> the scan (recovery does). What changes with SL is the **classification** of
> those positions — recovered-before-SL vs after-SL vs SL-not-recovered.

---

## 7. Statistics (per stop-loss)

Each row (`SlOptimizerRow`) carries, straight from the engine result for that SL:

| Requested | Field |
|---|---|
| Total Events | `totalPositions` (engine `validEvents`) |
| Recovered Before SL | `recoveredBeforeSl` (count) |
| Recovered After SL | `recoveredAfterSl` (count) |
| SL Hit | `slNotRecovered` (count) + `recoveredAfterSl` (touched SL) |
| Recovery % | `recoveryBeforeSlPct` (practical), `recoveryIgnoringSlPct` (ceiling), `recoveryAfterSlPct` |
| SL Hit % | `slHitPct` |
| Average Holding | `avgRecoverySec`, `medianRecoverySec`, `avgHoldingSec`, `worstHoldingSec` |
| Average MAE | `avgMaxGap` |
| Worst MAE | `worstMaxGap` (also `p90MaxGap`, `p95MaxGap`, `p99MaxGap`) |
| Average Expansion | derived from `avgMaxGap − entry` context (engine adverse stats) |
| Worst Expansion | `worstMaxGap` |
| Historical Confidence | `confidenceLevel` / `confidenceLabel` |

**Derived comparison metrics** (Pass 2, relative to the previous SL row):
- `recoveryGain` = `recoveryBeforeSlPct − prev.recoveryBeforeSlPct` (% points).
- `riskIncrease` = `stopLoss − prev.stopLoss` (gap points).
- `efficiency` = `recoveryGain / riskIncrease` (recovery gained per point of SL).
- `score` — the deterministic 0–100 balanced score (§10).

The **SL-dependent recovery metric is Recovery-Before-SL** — it rises with SL
toward the (SL-independent) Recovery-Ignoring-SL ceiling. This is what drives the
balanced-SL, efficiency and score logic.

---

## 8. Result table (`SlOptimizerTable`)

One row per SL, sortable, filterable (SL range + confidence), resizable columns,
CSV export of the visible rows. Columns:

Stop Loss · Rec. Before SL (count) · Rec. After SL (count) · SL Not Recovered
(count) · Rec. Before SL % · Rec. After SL % · Rec. Ignoring SL % · SL Hit % ·
Avg Recovery · Median Recovery · Avg Max Gap · Worst Max Gap · P95 Max Gap · Avg
Holding · **Efficiency** · **Score** · Confidence.

(Maps to the requested Stop Loss, Recovery %, Recovered Before, Recovered After,
SL %, Average Holding, Average/Worst Expansion (= max-gap columns), Historical
Events (Total Positions, in the footer), Confidence.) The **balanced** SL row is
highlighted.

The **SL Intelligence** layer (`slIntelligence.ts`) adds a separate table and
panel: per-row Recovery Gain, Additional Risk, Efficiency, Plateau and Balanced
Zone, plus plateau detection and historical observations — all derived from the
already-computed rows, never re-scanned.

---

## 9. Optimizer summary (highlight cards)

The Optimizer shows five highlight cards. Mapping to the requested set:

| Requested | Card shown (definition) |
|---|---|
| Highest Recovery | **Highest Recovery SL** = `maxSuccess` (max `recoveryBeforeSlPct`; tie → lower SL). |
| Lowest SL % | derivable from the SL Hit % column / sort; the lowest SL hit naturally occurs toward lower stop-losses. |
| Largest Sample | `totalPositions` (constant across SL rows — see §6 note; shown in the table footer). |
| Best Historical Stability | **Highest Score SL** = `highestScore` (the balanced score folds in confidence + holding stability) / **Best Balanced SL**. |
| Safest Historical Expansion | **Lowest Risk SL** = `lowestRisk` (min `avgMaxGap`). |

The actual cards are: **Best Balanced SL**, **Highest Recovery SL**, **Fastest
Recovery SL** (min `avgRecoverySec`), **Lowest Risk SL**, **Highest Score SL**.
The Historical Summary states the balanced SL, its recovery-before-SL, and the
**marginal recovery available beyond the balanced SL** (`marginalBeyondBalanced`).

The validation panel additionally reports Total SL Tested, Min/Max SL, Step,
Calculation Time and Research Engine Calls.

---

## 10. Ranking & the balanced score

The Optimizer "ranks" stop-losses by a **deterministic, explicitly-weighted
score** (Constitution Rule 9 — no hidden weighting), normalised across the swept
rows. For each row:

```
recNorm    = recoveryBeforeSlPct / 100                         (higher better)
gapNorm    = 1 − normalize(avgMaxGap,  gapMin, gapMax)          (lower gap better)
holdNorm   = 1 − normalize(avgHoldingSec, holdMin, holdMax)     (shorter holding better)
confNorm   = confidenceIndex / 4                               (higher better)
slPenalty  = normalize(stopLoss, slMin, slMax)                 (wider SL penalised)
tinyImprovementPenalty = (prev && recoveryGain < 0.1) ? 0.05 : 0

raw   = 0.45·recNorm + 0.20·gapNorm + 0.15·holdNorm + 0.20·confNorm
        − 0.20·slPenalty − tinyImprovementPenalty
score = clamp(raw · 100, 0, 100)
```

**Balanced SL** = the first SL where the next `BALANCED_LOOKAHEAD = 3` steps each
add less than `BALANCED_GAIN_EPS = 0.1` % recovery (diminishing returns); if none
qualifies, it falls back to the highest-score SL.

> Ranking is **historical and descriptive only** — it summarises which stop-loss
> levels produced the strongest historical statistics. It is never predictive
> and never trading advice.

---

## 11. CSV verification

Pick any single stop-loss row and verify it as one Research Lab scenario
(`RESEARCH_LAB.md` §11 / `RESEARCH_ENGINE.md` §13) with `entryGap`,
`recoveryGap`, that `stopLoss`, and the same same-day/session/sync filters on the
globally-filtered samples:

1. **Entry / Recovery / Stop Loss** — confirm entries, recoveries and SL touches
   by hand for that SL.
2. **Holding / Expansion** — confirm `durationSec` and `maxGap` per event.
3. **Statistics** — confirm the row's counts, %s, holding, MAE and confidence
   equal the engine output for that single SL.
4. **Summary** — confirm the highlight cards point to the correct rows (e.g.
   Highest Recovery = the row with the max recovery-before-SL), and that the
   balanced SL matches the diminishing-returns rule (§10). Recompute the score
   from the documented formula and confirm it matches.

Because every row is one engine call, verifying any row reduces to verifying the
Research Engine — which is already CSV-validated.

---

## 12. Dependencies

- **Research Engine** — `computeScenario`, called once per stop-loss. All
  scenario numbers originate here.
- **CSV / Data Manager** — `filteredSamples` (globally-filtered samples) is the
  input set; `filterOptions` provide session/sync choices.
- **Exports** — `optimizerCsv`, `optimizerJson`, `printOptimizerPdf`
  (serialisation only).

**No calculations occur outside the Research Engine.** The Optimizer only builds
the ladder, calls the engine per SL, and derives deterministic comparison
metrics (gain/risk/efficiency/score/balanced/plateau) from those results. It does
**not** read or write the Research Repository (the Repository is fed by the
Historical Strategy Finder; the Optimizer is an ad-hoc analysis surface).

---

## 13. Performance

- **Reuse the engine; no duplicated scans.** Exactly one `computeScenario` call
  per SL (`engineCalls === levels.length`); no SL is scanned twice.
- **Batch + two-pass derivation.** Pass 1 collects engine results; Pass 2 derives
  gain/risk/efficiency/score in a single linear pass over the rows (no extra
  engine calls).
- **Memoization.** `runSlOptimizer` is memoized on `[filteredSamples, input]`;
  the SL Intelligence layer is memoized on the result. The sweep does not rerun
  unless Entry/Recovery/SL-range/step/same-day/session/sync or the dataset
  change.
- **Bounded.** The ladder is capped at 400 steps (truncation flagged). Calc time
  and engine-call count are reported in the validation panel.
- **Avoid recomputing identical combinations.** Identical inputs → identical
  memoized result; the SL Intelligence derivations read the existing rows rather
  than re-scanning.

---

## 14. Edge cases

| Case | Behaviour |
|---|---|
| **Zero events** | No positions for the Entry Gap → all rows show 0; warning shown; charts/tables empty-safe. |
| **Immediate SL** | Per-SL classification handles early SL touch (after-SL / SL-not-recovered) exactly as the engine does. |
| **Immediate recovery** | Per-SL rows show high recovery-before-SL with tiny recovery times. |
| **Dataset end** | Unresolved outcomes counted by the engine per SL; reflected in each row. |
| **Invalid SL** (min ≥ max) | Warning; empty/trivial ladder. |
| **Large SL range** | Ladder grows linearly with `(max−min)/step`, capped at 400 (truncation flagged). |
| **Small step** | More SL rows (more engine calls) up to the 400 cap; calc time grows ~linearly and is reported. |
| **Huge step count** | Capped at 400 with `truncated = true` and a visible warning — never silently unbounded. |

---

## 15. Acceptance criteria

The Stop Loss Optimizer is correct only if:

1. Every stop-loss row matches manual CSV verification (one engine call per SL).
2. The highlights and balanced SL match the underlying statistics (e.g. Highest
   Recovery = max recovery-before-SL; balanced = first diminishing-returns SL).
3. The score equals the documented deterministic formula (§10).
4. No duplicated calculations — one engine call per SL, derivations read existing
   rows.
5. The Research Engine is untouched (the Optimizer only consumes it).

---

## 16. Change policy

- **The Stop Loss Optimizer is frozen.** Its research calculations
  (per-SL engine usage, gain/risk/efficiency/score/balanced/plateau formulas)
  are immutable.
- **Future improvements are limited to visualization, performance, UI and
  export** — never the research methodology or the score weights.
- A scoring or methodology change is a **new version**, with CSV proof and a doc
  update — never a silent edit.
- This document and the implementation must always agree.
