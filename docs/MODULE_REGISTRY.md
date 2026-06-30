# MODULE REGISTRY — Gap Research Terminal

Every module answers **exactly one** research question (Constitution Rule 6).
Status values: **Completed** (built & working), **Frozen** (built, calculations
must not change), **Future** (planned, see `ROADMAP.md`).

---

## Research Engine v1.0 — `utils/scenario.ts`
- **Purpose:** Simulate one position model over the samples and report outcomes.
- **Research question:** "For an entry / recovery / stop-loss scenario, what
  historically happened?"
- **Input:** `GapSample[]`, `ScenarioInput` (entry/recovery/stopLoss, holding,
  sameDayOnly, sessions, syncStatuses, minEvents).
- **Output:** `ScenarioResult` (outcome counts, recovery %s, recovery times,
  adverse/favourable distributions, confidence, events).
- **Dependencies:** none (root engine).
- **Status:** **Frozen — CSV validated.**

## Overview — `components/overview`, `components/overview2`
- **Purpose:** High-level dataset summary / institutional dashboard.
- **Research question:** "What does the uploaded dataset look like overall?"
- **Input:** `filteredSamples`. **Output:** summary cards & charts.
- **Dependencies:** Data Manager. **Status:** Completed.

## Events / Recovery Matrix / MAE / Stop-Loss Research / Failed / Event Explorer / Session Analysis
- **Purpose:** Classic per-zone gap analytics (events, recovery, MAE, survival,
  failures, replay, session breakdown).
- **Research question:** each answers one analytic question about gap zones.
- **Input:** `filteredSamples` (+ zones/events). **Output:** tables & charts.
- **Dependencies:** Data Manager. **Status:** Completed.

## Research Lab — `components/lab`
- **Purpose:** Single-scenario testing harness on the Research Engine.
- **Research question:** "For one chosen scenario, what is the historical outcome?"
- **Input:** `ScenarioInput`. **Output:** `ScenarioResult` view.
- **Dependencies:** Research Engine. **Status:** **Frozen.**

## Stop Loss Optimizer — `utils/slOptimizer.ts`, `utils/slIntelligence.ts`
- **Purpose:** Sweep stop-loss levels and read the historical outcome at each.
- **Research question:** "How does the historical outcome change with the stop-loss?"
- **Input:** entry/recovery + SL range. **Output:** per-SL matrix, balanced SL,
  plateau intelligence.
- **Dependencies:** Research Engine (one call per SL). **Status:** **Frozen.**

## Historical Strategy Finder — `utils/strategyFinder.ts`, `utils/strategyExecution.ts`
- **Purpose:** Generate valid parameter combinations and execute them.
- **Research question:** "Across a grid of parameters, what did each combination
  historically produce?"
- **Input:** entry/recovery/SL ranges + filters. **Output:** validated READY
  combinations → executed research results.
- **Dependencies:** Research Engine. **Status:** **Frozen (11A–11E).**

## Research Repository — `context/RepositoryContext.tsx`, `utils/researchRepository.ts`
- **Purpose:** Centralized, de-duplicated store of COMPLETED strategy results.
- **Research question:** "What completed research already exists?"
- **Input:** COMPLETED execution results. **Output:** queryable record set.
- **Dependencies:** Strategy Finder execution. **Status:** **Frozen.**

## Strategy Ranking — `utils/strategyRanking.ts`
- **Purpose:** Deterministic statistical ranking of stored strategies.
- **Research question:** "Which stored strategies have the strongest historical
  statistics under a chosen mode?"
- **Input:** repository records, filters, ranking mode. **Output:** ranked rows
  with 0–100 score + components.
- **Dependencies:** Repository. **Status:** **Frozen.**

## Strategy Details (Dossier) — `utils/strategyDossier.ts`
- **Purpose:** Full read-only historical dossier for one strategy.
- **Research question:** "What is the complete historical evidence for this
  strategy?"
- **Input:** one repository record (+ occurrences). **Output:** sessions,
  months, outcomes, histogram, quick stats, observations.
- **Dependencies:** Repository. **Status:** Completed.

## Replay Engine — `utils/replay.ts`
- **Purpose:** Replay one historical occurrence exactly as it happened.
- **Research question:** "How did this single occurrence unfold sample-by-sample?"
- **Input:** one occurrence + dataset samples. **Output:** timeline, markers,
  live stats. **Dependencies:** Repository + Data Manager. **Status:** Completed.

## Strategy Comparison — `utils/strategyComparison.ts`
- **Purpose:** Side-by-side comparison of 2–5 stored strategies.
- **Research question:** "How do these strategies compare historically?"
- **Input:** 2–5 repository records. **Output:** metric/difference/session/
  monthly/risk tables + charts. **Dependencies:** Repository, Dossier, Ranking
  score. **Status:** Completed.

## Probability Engine v1.0 — `utils/probability.ts`
- **Purpose:** Historical compression probability per target gap.
- **Research question:** "Given a current gap, how often did it historically
  compress to each lower target?"
- **Input:** current gap + target ladder + filters. **Output:** probability
  matrix (per target). **Dependencies:** Data Manager. **Status:** Completed.

## Opportunity Scanner — `utils/opportunity.ts`
- **Purpose:** Surface the statistically strongest historical compressions.
- **Research question:** "Which historical targets are statistically strongest?"
- **Input:** the existing probability matrix + filters. **Output:** ranked
  opportunities + deterministic score. **Dependencies:** Probability Engine
  (reads its matrix; never recomputes). **Status:** Completed.

## Market Context — `utils/marketContext.ts`
- **Purpose:** Describe the current market context statistically.
- **Research question:** "Where does the current gap sit within recent history?"
- **Input:** dataset samples + recent window. **Output:** percentile, regime,
  volatility, session & contract context, observations. **Dependencies:** Data
  Manager. **Status:** Completed.

## Reliability Engine — *(future)*
- **Purpose:** Measure how stable/consistent a historical result is (NOT
  probability — Constitution Rule 5).
- **Research question:** "How trustworthy is this historical statistic across
  time and sub-samples?" **Status:** **Future.**

## Walk Forward Validation — *(future)*
- **Purpose:** Window-by-window robustness check over stored data.
- **Research question:** "Do the historical statistics hold up across sequential
  windows?" **Status:** **Future.**

## Reports (Daily / Strategy / Probability) — *(future)*
- **Purpose:** Formatted, exportable summaries composed from existing results.
- **Status:** **Future.**

## AI Research Assistant / EA Export — *(future)*
- **Purpose:** Natural-language research assistance; export of research
  parameters. Must obey the Constitution (no predictions, no signals).
- **Status:** **Future.**
