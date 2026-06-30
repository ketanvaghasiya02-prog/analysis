# PROBABILITY ENGINE & OPPORTUNITY SCANNER — Complete Reference (FROZEN)

> **Status: FROZEN.** This document is the authoritative specification of the
> Probability Engine v1.0 and the Opportunity Scanner. The research methodology
> is immutable; only charts / visualization / performance / export may change
> (see §20).
>
> **Sources:** `src/utils/probability.ts` (engine),
> `src/utils/opportunity.ts` (scanner), `src/components/probability/*` (views).

> **Architecture note (read first).** The Probability Engine is a **separate,
> standalone engine**. It does **not** call the Research Engine, and it does not
> bypass it either — it answers a **different research question** (compression
> probability to multiple targets) and therefore does not duplicate Research
> Engine logic (Constitution Rule 2). It reads uploaded CSV samples directly
> (the globally-filtered `filteredSamples`) and runs its **own** position-model
> scan. It uses the **same position-model philosophy** as the Research Engine
> (one position at a time, first-touch, chronological), implemented
> independently. The Opportunity Scanner performs **no calculations** — it reads
> the Probability matrix.

---

## 1. Purpose

The Probability Engine answers, from uploaded CSV history only:

> **"Given the current historical entry gap, what historically happened next —
> how often did the gap compress to each lower target?"**

It converts raw historical samples into **historical probability distributions**
over compression targets. It never predicts future markets and never recommends
trades. Every figure is a historical frequency.

---

## 2. Research question

> Given a **Current Gap**, a **Target Gap** ladder, holding rules and a date
> range — **what percentage of historical events compressed to each target?**

---

## 3. User inputs (`ProbabilityInput`)

| Input | Field | Notes |
|---|---|---|
| Current Gap | `currentGap` | Level whose first upward touch opens an event. |
| Target Start Gap | `targetStart` | Top of the (descending) target ladder. |
| Target End Gap | `targetEnd` | Bottom of the ladder (deepest target). |
| Target Step | `targetStep` | Decrement; defaults to 0.1 if ≤ 0. |
| Optional Stop Loss | `stopLossGap` | `null` = none. When set, it **closes** an event (see §5). |
| Maximum Holding | `maxHoldingMinutes` | Optional cap (minutes); `null` = uncapped. |
| Same Day Only | `sameDayOnly` | Closes an open event at the day boundary. |
| Date Range / Recent Research Window | `dateRange:{from,to}` | Pre-filters the samples (recent-window default). |
| Session Filter | `sessions` | Event qualifies only if the entry sample's session matches. |
| Sync Status Filter | `syncStatuses` | Event qualifies only if the entry sample's sync matches. |
| Minimum Events | `minEvents` | Low-confidence threshold (the probability denominator). |

Defaults: Current 18.40, Target Start 18.20, Target End 15.00, Step 0.10,
same-day on, min events 10.

---

## 4. Event definition (one-touch entry)

The scan is **position-based** — at most one event is open at a time.

```
An event starts when:
   Previous Gap < Current Gap
   AND Current Gap sample >= Current Gap input   (cur.gap >= currentGap - EPS)
```

- Processed **chronologically** over consecutive samples.
- Session / sync / date filters apply to the entry sample; a filtered-out touch
  does not open an event.
- **Only one active event.** After an event opens, repeated touches of the
  Current Gap **while it remains open create no new events** — the scan resumes
  *after* the event closes (`i = exitIndex + 1`), preventing duplicate entries.

---

## 5. Target definition & event close

**Target reached (one-touch recovery):** a target is reached when
`gap <= targetGap + EPS` — the **first** sample at/below it. Chronological
priority; **no averaging, no interpolation.** Each target's first-touch time is
recorded once.

An open event **closes** on the first of:

- **Stop loss** — if `stopLossGap` is set and `gap >= stopLossGap - EPS`
  (`terminal = 'sl'`). *(Unlike the Research Engine, here the stop-loss **does**
  close the event — once SL is touched the position is closed, so deeper targets
  reached afterwards do not count.)*
- **Deepest target** — `gap <= targetEnd` (`terminal = 'recovery'`, full
  compression).
- **Max holding** exceeded (`terminal = 'holding'`).
- **Day boundary** when `sameDayOnly` (`terminal = 'day'`).
- **End of data** (`terminal = 'dataset'`).

Because the deepest target closes the event, all higher targets are reached on
the way down (probability is monotonic — deeper targets ≤ nearer targets).

---

## 6. Forward scan (per event)

For each open event the engine tracks, in one pass:

- **Entry time / gap** (the crossing sample).
- **Target time** — first elapsed seconds each target was reached (`timeToTarget`).
- **Maximum gap** and **minimum gap** after entry.
- **Worst / average expansion** — `maxGapBeforeTarget` per target (the running
  max at the moment the target was first reached) → worst and average adverse
  excursion before reaching the target.
- **Holding** — elapsed seconds to the close.
- **Session** and **Outcome** (terminal).

**One forward pass evaluates all targets together** — there is no separate scan
per target (Constitution / performance).

---

## 7. Probability matrix (per target row, `ProbabilityTargetRow`)

| Column | Field | Definition |
|---|---|---|
| Target Gap | `targetGap` | |
| Historical Probability | `probabilityPct` | `reachedCount / totalEvents · 100` |
| Total Events | `totalEvents` | Events opened at the Current Gap (denominator; constant across rows). |
| Reached Events | `reachedCount` | Events whose gap reached this target before the event closed. |
| Average Recovery Time | `avgTimeSec` | Mean time-to-target over reached events. |
| Median Recovery Time | `medianTimeSec` | |
| Fastest Recovery | `fastestSec` | Min time-to-target. |
| Slowest Recovery | `slowestSec` | Max time-to-target. |
| Average Maximum Gap | `avgMaxGap` | Mean of max-gap-before-target (reached events). |
| Worst Maximum Gap | `worstMaxGap` | Max of max-gap-before-target. |
| P90 Expansion | `p90MaxGap` | 90th percentile of max-gap-before-target. |
| P95 Expansion | `p95MaxGap` | 95th percentile. |
| Average Adverse Expansion | `avgAdverseExpansion` | Mean `maxGapBeforeTarget − entryGap`. |
| SL Before Target % | `slBeforeTargetPct` | (when SL set) share where SL closed the event before this target. |
| Unresolved % | `unresolvedPct` | Share that ended by day/holding/dataset without reaching this target (and without SL). |
| Historical Confidence | `confidenceLevel`/`confidenceLabel` | Event-count based (denominator): <10 Very Low, <25 Low, <50 Medium, <100 High, else Very High. |

Targets at or above the Current Gap are **rejected** (validation, §18); the
ladder is capped at **400** targets (`truncated`). Meta reports current gap,
targets tested, total events, calc time, event-scan count, truncation and
rejected-target count.

---

## 8. Summary cards (KPIs)

The Probability page shows: **Current Gap**, **Highest Historical Probability**
(max `probabilityPct`, with its target), **90% Probability Target** (the deepest
target still ≥ 90% historical probability), **Average Historical Recovery Time**
(mean of reached-row `avgTimeSec`), **Largest Historical Dataset** (`totalEvents`),
and **Research Confidence**. (These replaced the earlier Nearest/Deepest KPIs.)

---

## 9. Opportunity Scanner — purpose

The Opportunity Scanner automatically identifies the statistically strongest
historical opportunities. **It performs no calculations** — it only **filters,
scores and ranks** the existing Probability matrix rows (`scanOpportunities`).

---

## 10. Scanner filters (`OpportunityFilters`)

| Filter | Field | Default |
|---|---|---|
| Minimum Probability | `minProbability` | 90% |
| Minimum Historical Events | `minEvents` | 20 |
| Maximum Average Recovery | `maxAvgRecoveryMin` (minutes) | none |
| Maximum Expansion (worst) | `maxWorstExpansion` | none |
| Maximum P95 Expansion | `maxP95Expansion` | none |
| Research Confidence | `minConfidence` (`ANY`/`MEDIUM`/`HIGH`/`VERY_HIGH`) | Any |

The Research Window is inherited from the Probability Engine inputs (the matrix
the scanner reads). A row must satisfy **all** active filters to be eligible.

---

## 11. Opportunity Score (deterministic)

Fixed, documented weights — **no AI, no hidden weighting** (Constitution Rule 9).
Components are normalized over the **full matrix** (stable, filter-independent):

```
probability = probabilityPct                                   (0–100, used directly)
time        = avgTimeSec == null ? 0 : 100 − norm(avgTimeSec)  (faster better)
expansion   = worstMaxGap == null ? 50 : 100 − norm(worstMaxGap)(lower better)
events      = norm(reachedCount)                               (more evidence better)
confidence  = confidenceIndex / 4 · 100                        (higher better)

score = 0.45·probability + 0.15·time + 0.15·expansion
      + 0.10·events + 0.15·confidence
```

Eligible rows are ranked by score (descending; deterministic tie-breaks:
probability, then deeper target).

---

## 12. Best Historical Opportunity (featured card)

The top-ranked eligible row is shown as a featured card:
**Current Gap → Historical Target → Historical Probability → Average Recovery →
Historical Events → Worst Historical Expansion → Research Confidence**, with the
opportunity score.

> **Wording rule:** never *Buy, Sell, Entry Signal, Recommendation, TP/SL*. Only
> *Historical Opportunity, Historical Evidence, Historical Compression*. The card
> describes what historically happened, not what to do.

---

## 13. Visualization

- **Probability Matrix** — the per-target table (§7), colour-toned by probability.
- **Opportunity cards** — the Opportunity Summary highlight cards, the featured
  **Best Historical Opportunity** card, and the **Top-10 ranking cards** (target,
  probability, time, confidence, score), each coloured by **probability band**:
  95%+ green · 90–95% light green · 80–90% yellow · 60–80% orange · <60% red.
- **Opportunity table** — sortable, searchable, with CSV/JSON export.
- **Future charts** — a **Probability Curve** placeholder is present (probability
  vs target / time-to-target). A **heat map** and **probability distribution**
  charts are planned visualizations; the matrix already holds all values.

---

## 14. Export

- **Opportunity Scanner:** CSV and JSON (filters + ranking metadata).
- **Future PDF:** a composed PDF report is planned (the Reports module). The
  matrix data is fully available via the scanner CSV/JSON today.

---

## 15. Performance

- **One scan, all targets.** A single forward pass per event evaluates every
  target — never one scan per target.
- **No duplicate scans.** Positions never overlap (resume after close) → O(n)
  over the samples × O(targets) inner work.
- **Reuse the Probability matrix.** The Opportunity Scanner reads the existing
  matrix; it never recomputes a probability.
- **Memoization.** `computeProbability` is memoized on `[filteredSamples, input]`;
  `scanOpportunities` on `[result, filters]`; the table on its sort/search state.
- **Lazy rendering / batching.** Charts disable animation; top-10 cards render a
  bounded slice; the table renders the filtered/sorted set.

---

## 16. Dependencies

- **CSV / Data Manager** — provides `filteredSamples`; the engine pre-filters by
  date range and applies session/sync per event. **This is its only data
  dependency.**
- **Opportunity Scanner** — depends on the Probability matrix the engine
  produces.

**It does not consume the Research Engine, the Repository, or the Historical
Strategy Finder** — it is an independent engine answering a different question.

**Produces:** the Probability matrix and the ranked Opportunity set. These are
intended as future input to the **Reliability Engine** (which will measure how
*stable* these probabilities are — Constitution Rule 5: probability ≠ reliability).

---

## 17. CSV verification

Select one Current Gap and verify by hand on the scoped CSV (sorted by time):

1. **Event count** — find every first-touch crossing of the Current Gap
   (`prev < current ≤ cur`), applying the one-position rule (resume after each
   close). The count is `totalEvents`.
2. **Probability** — for a target, count events whose gap reached `≤ target`
   before the event closed; `reached / total` must equal the row's probability.
3. **Recovery** — time from entry to first `gap ≤ target` must match the
   avg/median/fastest/slowest columns over reached events.
4. **Expansion** — running max gap up to the target touch must match
   avg/worst/P90/P95 columns.
5. **Holding** — elapsed to close (recovery / SL / day / holding / dataset).
6. **Summary cards** — confirm Highest Probability, the 90% target, average
   recovery, dataset size and confidence are derived from the matrix.
7. **Opportunity Scanner** — confirm filters select the right rows and the score
   equals the documented formula (§11).

---

## 18. Edge cases

| Case | Behaviour |
|---|---|
| **Zero events** | No crossings of the Current Gap → empty matrix; low-confidence/empty states. |
| **Target ≥ Entry** | Rejected (targets must be below the Current Gap); `rejectedTargets` counted + warning. |
| **Invalid gap / start ≤ end** | Empty/trivial ladder; warning ("Target Start should be greater than Target End"). |
| **No recovery** | Events close by day/holding/dataset; targets not reached count toward Unresolved %. |
| **Dataset end / Holding expired** | Terminal `dataset` / `holding`; targets not reached are Unresolved for that row. |
| **Stop loss before target** | When SL set and SL closes the event first, that event counts under SL-Before-Target % for unreached targets. |
| **Large CSV** | Single-pass O(n) scan + memoization keep recompute bounded. |
| **Large target range / small step** | Ladder capped at 400 (`truncated` flagged) — never silently unbounded. |

---

## 19. Acceptance criteria

The Probability Engine is accepted only if:

1. Every probability matches manual CSV verification (§17).
2. The Opportunity Scanner never recalculates data — it only reads the matrix.
3. Summary cards are derived from the Probability matrix.
4. No duplicate events (one position at a time; resume after close).
5. The Research Engine remains unchanged (the Probability Engine is independent
   and never modifies it).

---

## 20. Change policy

- **The Probability Engine and Opportunity Scanner are frozen.** The research
  methodology (event/target definitions, scan, probability formula, score
  weights) is immutable.
- **Future improvements are limited to charts, visualization, performance and
  export** — never the methodology or the score weights.
- A methodology or weight change is a new version, with CSV proof and a doc
  update — never a silent edit.
- This document and the implementation must always agree.
