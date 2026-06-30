# RESEARCH LAB — Complete Reference (FROZEN)

> **Status: FROZEN / CSV-verified.** This document is the authoritative
> specification of the Research Lab. The calculations are immutable; only UI
> improvements are permitted (see §16). The Lab performs **no calculations of its
> own** — it is a thin interface over the frozen **Research Engine v1.0**
> (`RESEARCH_ENGINE.md`).
>
> **Source of truth:** `src/components/lab/ResearchLabView.tsx` (+ siblings)
> **Engine:** `computeScenario`, `computeSensitivity` (`src/utils/scenario.ts`)

---

## 1. Purpose

The Research Lab is GRT's **official manual research interface**. It lets a user
define any historical scenario (entry / recovery / stop-loss) and see exactly
what happened across the uploaded, filtered data.

- It is for **validation, exploration and statistical research**.
- It is **not a trading screen** and never produces trading signals.
- Every number it shows comes straight from the Research Engine — the Lab does
  not recompute anything (Constitution Rule 2).

A green version chip — **"Research Engine v1.0 — CSV validated"** — is shown at
the top so the user always knows which frozen engine produced the results.

---

## 2. Research question

> **"If entry happens at this gap (with this recovery target and this stop-loss),
> how did history behave?"**

The Lab answers it for the currently scoped dataset and renders the summary,
events, statistics, charts and per-event timeline.

---

## 3. User inputs

### Scenario inputs (`ScenarioInput`)
| Input | Field | Notes |
|---|---|---|
| Entry Gap | `entryGap` | Required. Level whose first upward touch opens a position. |
| Recovery Gap | `recoveryGap` | Required. Target level; should be **below** Entry. |
| Stop Loss Gap | `stopLoss` | Should be **above** Entry. (Always supplied; advisory if mis-set.) |
| Maximum Holding Time | `maxHoldingMinutes` | Optional (minutes); empty = uncapped. |
| Minimum Events | `minEvents` | Confidence/low-sample threshold. |
| Same Day Only | `sameDayOnly` | Toggle; closes an open position at the day boundary. |
| Session Filter | `sessions` | Multi-select; an entry touch only opens when the entry sample's session matches. |
| Sync Status Filter | `syncStatuses` | Multi-select; same idea for sync status. |

### Data scope inputs
| Input | Mechanism | Notes |
|---|---|---|
| CSV Source | `filteredSamples` (Data Manager) | The globally-filtered sample set. |
| Date Range / Recent Research Window | Date-Time Range panel (`startDate/startTime/endDate/endTime`) | Scopes **on top of** the global filter via `scopeByDateTime`. Empty = all uploaded data. Shows Samples-in-Range, Days-Covered, Events-in-Range. |

### Research Mode
The Lab provides two research modes on one page:
1. **Scenario Test** (primary) — the entry/recovery/SL scenario above.
2. **Top Trade Finder** (embedded) — surfaces the strongest individual
   historical occurrences for the same scoped dataset, recovery target and SL.

> There is no broker, no order type, and no "live" mode — every mode is
> historical research.

---

## 4. Input validation

Validation is **advisory** (warnings), not blocking: the engine still runs and
shows results, while warnings flag low-confidence or inconsistent inputs.

| Rule | Behaviour |
|---|---|
| Entry Gap required | Numeric field; non-finite input is ignored (value unchanged). |
| Recovery Gap required | Same numeric guard. |
| Stop Loss | Always present; if `stopLoss <= entryGap` → warning: *"Stop-Loss Gap is at or below the Entry Gap…"* |
| Recovery below Entry | If `recoveryGap >= entryGap` → warning: *"Recovery Gap is at or above the Entry Gap…"* |
| Minimum events | If `validEvents < minEvents` → warning: *"Only N positions — below the minimum…"* |
| Date-range — empty result | If the range is active and yields 0 samples → *"No data found in the selected date-time range."* |
| Date-range — thin sample | If `0 < samples < 100` → *"Only N samples… results may be unstable."* |
| Accounting | If outcome counts do not sum to positions → red *"Outcome Accounting Failed"* banner (should never appear; the engine guarantees the invariant). |
| Numeric guards | Number fields reject non-finite input; Max Holding empty = `null` (uncapped). |

---

## 5. Research workflow

```
User enters parameters (scenario + date-time range + filters)
        │
        ▼
labSamples = scopeByDateTime(filteredSamples, dtRange)        (memoized)
        │
        ▼
result = computeScenario(labSamples, input)                  (Research Engine, memoized)
sensitivity = computeSensitivity(result.events, input)        (memoized)
        │
        ▼
Research Lab renders:
  · Version chip + disclaimer + help panel
  · Date-Time Range panel (range stats + warnings)
  · Scenario inputs + advisory warnings
  · Exports (event CSV · summary JSON · SL sensitivity CSV)
  · Summary cards
  · Selected-event path chart (when an event is selected)
  · Charts (outcome · SL sensitivity · adverse-gap distribution)
  · Outcome breakdown table + SL sensitivity table
  · Event table (sortable; click to select)
  · Top Trade Finder
```

All heavy work is in `useMemo`s; nothing is computed inside render except thin
mapping for display.

---

## 6. Summary cards (`ScenarioCards`)

The Lab shows the full engine summary as cards. Mapping to the requested set:

| Requested | Card(s) shown |
|---|---|
| Total Events | **Total Positions** (`validEvents`) |
| Recovery % | **Recovery Ignoring SL %** (`recoveryPctIgnoringSl`) |
| Recovery Before SL | **Recovery Before SL %** (`recoveryBeforeSlPct`) |
| Recovery After SL | **Recovery After SL %** (`recoveredAfterSlPct`) |
| SL Hit % | **SL Hit %** (`slHitPct`) |
| Average Holding | **Avg Recovery Time** + **Median Recovery Time** (`avgRecoveryTimeSec`, `medianRecoveryTimeSec`) |
| Average Recovery | as above |
| Average Expansion | **Avg Adverse Expansion** (`adverseExpansionStats.avg`) |
| Worst Expansion | **Worst Adverse Expansion** (`adverseExpansionStats.worst`) |
| Research Confidence | **Research Confidence** (`confidence.level`, capped by sample size) |

Additional cards (descriptive context): Entry / Recovery / Stop-Loss Gap,
Unresolved %, Avg/Median/P90/P95/P99/Worst **Max Adverse Gap** (`adverse.*`),
Avg/Best **Min Gap After Entry** (`minGapStats.*`), and **Risk / Reward (gap
pts)** (`riskReward`).

---

## 7. Result (event) table (`ScenarioEventTable`)

One row per position, TanStack Table, sortable, click-to-select. Columns:

| Column | Source field |
|---|---|
| Position ID | `id` (`POS-0001…`) |
| Entry Date | `date` |
| Entry Time | `entryTime` |
| Entry Gap | `entryGap` |
| Exit Time | `exitTime` |
| Exit Gap | `exitGap` |
| Max Gap After Entry | `maxGap` |
| Min Gap After Entry | `minGap` |
| SL Hit | `slHit` |
| SL Time | `slHitTimeSec` |
| Recovery Hit | `recoveryHit` |
| Recovery Time | `recoveryTimeSec` |
| Holding Time | `durationSec` |
| Outcome | `outcome` |
| Session | `session` |
| Sync | `syncStatus` |

(Maps to the requested Entry Time, Entry Gap, Recovery Time, Stop Loss Time,
Holding Time, Maximum Gap, Minimum Gap, Outcome, Session, Date — plus Position
ID / Exit / SL-Hit / Recovery-Hit / Sync for completeness.)

---

## 8. Event details (selected-event path)

Selecting a row (`onSelect`) sets the active event; the Lab renders
**`ScenarioPathChart(samples, event, input)`** above the charts:

- **Timeline / historical path** — the gap path around the event (a short
  pre-entry lookback through the close) reconstructed read-only from the source
  samples via the engine's `buildScenarioPath` helper (no re-simulation).
- **Outcome** — the event's `outcome`, recovery/SL flags and times.
- **Expansion** — the adverse path (`maxGap`, `maxGap − entryGap`) is visible on
  the chart; reference markers show entry, recovery and stop-loss levels and the
  day boundary.

Selection persists by `id`; if the recompute changes the event set, the selected
event is re-resolved by `id` (or cleared).

---

## 9. Charts (`ScenarioCharts` + path chart)

| Chart | What it shows |
|---|---|
| **Outcome Distribution** | Bar chart of event counts per outcome. |
| **Stop-Loss Sensitivity** | Line chart of *Recovery before SL %* and *SL hit %* across stop-loss levels (`computeSensitivity`) — how the result would change at other SLs, computed by reclassification (`classifyAtSl`), not re-scanning. |
| **Max Adverse Gap Distribution** | Histogram of `maxGap` — the **expansion distribution**. |
| **Timeline** | The per-event **`ScenarioPathChart`** (§8). |

Recovery-time and holding behaviour are summarised in the cards and the
sensitivity view rather than as separate distribution charts. Charts are
deterministic (`isAnimationActive={false}`) and read directly from `result` /
`sensitivity`.

Supporting tables: **Outcome Breakdown Table** (counts + % per outcome with the
accounting total) and **SL Sensitivity Table** (per-SL recovery/SL-hit, current
SL highlighted).

---

## 10. Outcome types

The Lab shows the six engine outcomes (`RESEARCH_ENGINE.md` §8):

| Outcome | Meaning in the Lab |
|---|---|
| `RECOVERED_BEFORE_SL` | Target reached before the stop-loss was touched. |
| `RECOVERED_AFTER_SL` | Eventually recovered, but the selected SL was touched first. |
| `SL_NOT_RECOVERED` | Adverse path touched SL and never recovered ("Stop Loss Hit"). |
| `DAY_END` | Closed at the same-day boundary without recovery/SL. |
| `HOLDING_TIME_EXPIRED` | Closed by max-holding without recovery/SL. |
| `DATASET_END` | Reached end of data without recovery/SL. |

`DAY_END` + `DATASET_END` + `HOLDING_TIME_EXPIRED` are grouped in the UI as
**Unresolved**. **"Cancelled" is not an outcome** — a touch filtered out by
session/sync (or a null gap) simply never opens a position, so it is not an
event and is not counted.

---

## 11. CSV verification

Every Lab number is a Research Engine number, so verification follows
`RESEARCH_ENGINE.md` §13 against the **scoped** sample set (global filter →
date-time range):

1. **Entry** — first row where previous `Gap < Entry` and current `Gap ≥ Entry`
   (and the entry sample matches the session/sync filters).
2. **Recovery** — first subsequent row with `Gap ≤ Recovery`; recovery time =
   that row's time − entry time (matches the Recovery Time column).
3. **Stop Loss** — first subsequent row with `Gap ≥ Stop Loss` (SL Time column);
   the running max reaching SL decides before/after-SL classification.
4. **Holding** — `durationSec` per the engine rule (recovery time, or first-SL
   time for SL-not-recovered, or last sample time).
5. **Expansion** — running max `Gap` (Max Gap column) and `maxGap − entryGap`.
6. **Statistics** — repeat for every entry (one position at a time; resume after
   close) and recompute the cards. They must match the displayed values, and the
   **accounting panel** must read OK (outcomes sum to positions).

---

## 12. Dependencies

- **Research Engine** — `computeScenario` (results) and `computeSensitivity`
  (per-SL reclassification). All numbers originate here.
- **CSV / Data Manager** — `filteredSamples` + the date-time scope provide the
  input samples; `filterOptions` provide session/sync choices.
- **Exports** — `reports.downloadExport` (event CSV, summary JSON, sensitivity
  CSV) — serialisation only.

**No calculations occur inside the Research Lab.** It maps engine output to
cards/tables/charts and nothing more. The Lab does **not** read from or write to
the Research Repository — populating the Repository is the Historical Strategy
Finder's role; the Lab is a manual, ad-hoc research surface.

---

## 13. Performance

- **Reuse engine output.** `result = useMemo(computeScenario, [labSamples,
  input])`; `sensitivity = useMemo(computeSensitivity, [result.events, input])`.
  Sensitivity reuses the already-scanned events (reclassification, no rescan).
- **No duplicate calculations.** The Lab never recomputes a value the engine
  produced.
- **Scoped data memoized.** `labSamples = useMemo(scopeByDateTime, …)` and
  `daysCovered` are memoized so unrelated re-renders do not recompute.
- **Avoid unnecessary rendering.** The selected event is resolved by `id` in a
  memo; the path chart renders only when an event is selected. Charts disable
  animation for instant, deterministic paints.

---

## 14. Edge cases

| Case | Behaviour |
|---|---|
| **Zero events** | `validEvents = 0`; cards show 0 / —; low-confidence warning; accounting still OK. |
| **No recovery** | Events resolve to SL-not-recovered / day / holding / dataset; reflected in the outcome chart & table. |
| **Immediate recovery** | Recovery on the next sample → tiny recovery time; `RECOVERED_BEFORE_SL` (unless SL already touched). |
| **Immediate SL** | Adverse path touches SL early → after-SL or SL-not-recovered classification; SL Time column populated. |
| **Dataset end** | Scan reaches end without resolution → `DATASET_END` (Unresolved). |
| **Missing timestamps** | Times show as — ; max-holding cannot trigger; engine degrades gracefully. |
| **Large CSV** | Memoization + single-pass engine keep recompute bounded; tables paginate/scroll. |
| **Invalid inputs** (recovery ≥ entry, SL ≤ entry, thin range) | Advisory warnings shown; the engine still runs so the user can see the (degenerate) result. |

---

## 15. Acceptance criteria

The Research Lab is accepted only if:

1. Every displayed value matches the Research Engine output exactly.
2. Manual CSV verification (§11) succeeds for entry, recovery, SL, holding,
   expansion and the aggregate statistics.
3. No duplicated events (one position at a time — enforced by the engine).
4. Charts agree with the statistics (same `result` / `sensitivity` source).
5. The event table matches the CSV rows for the scoped dataset.
6. The accounting panel reads OK (outcomes sum to positions).

---

## 16. Change policy

- **The Research Lab is frozen.** Its research calculations are immutable.
- **Future enhancements must not change the Research Engine** or any calculation;
  only **UI improvements** (layout, additional read-only visualisations, export
  formats) are allowed, and they must keep displaying exact engine values.
- Any calculation discrepancy is a bug in the Lab's *display*, fixed without
  touching the engine, with CSV proof — never by editing frozen logic.
- This document and the Lab implementation must always agree.
