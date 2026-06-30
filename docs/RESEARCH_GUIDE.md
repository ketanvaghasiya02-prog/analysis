# Research Guide — Gap Research Terminal

How to think about, run and trust research in GRT. This complements the per-module specs in
`docs/` (e.g. [RESEARCH_ENGINE.md](RESEARCH_ENGINE.md),
[PROBABILITY_ENGINE.md](PROBABILITY_ENGINE.md)).

## The research model

GRT studies a **pair spread** ("gap") over time from CSV history. A single simulated
**position** is considered at a time:

- **Entry** triggers on the first touch of the entry gap from below.
- **Recovery** triggers when the gap first touches at or below the recovery gap.
- The **stop-loss** is a **classification boundary** (max gap ≥ SL). In the Research Engine
  it labels outcomes; it does **not** terminate the scan. (The Probability Engine, by
  contrast, closes an event when its SL gap is reached.)
- Scanning resumes after each position closes.

Outcomes: *recovered before SL*, *recovered after SL*, *SL not recovered*.

## A research workflow

1. **Frame one question.** Each module answers exactly one (Constitution rule 6).
2. **Scope the window.** Prefer recent history (default 15–30 days) — Gold Spot vs Gold
   Futures converge toward expiry, so old gaps are less representative.
3. **Test a scenario** in the **Research Lab**, or **generate combinations** in the
   **Historical Strategy Finder**.
4. **Store** completed results in the **Repository** (de-duplicated, reused — never re-run).
5. **Rank and investigate** with Ranking, Strategy Details and Replay.
6. **Quantify and qualify**:
   - **Probability** — how often the gap compressed historically.
   - **Reliability** — how much to trust that evidence (sample quality + stability).
   - **Walk Forward** — does it hold up on unseen windows?
   - **Market Context** — is the current environment typical or unusual?
7. **Explain** with the AI Assistant, **report** with the Reporting Engine, **export** with
   the EA Export Engine.

## Probability vs Reliability (key distinction)

- **Probability** answers *what happened, how often* — descriptive historical frequency.
- **Reliability** answers *how much should I trust that number* — a deterministic 0–100 score
  from sample quality, probability/holding/expansion stability, historical/session/recent
  consistency.

A high probability with low reliability means a strong pattern on thin or uneven evidence.

## Reading the metrics

- **Recovery %** — share that recovered before the SL boundary.
- **Expansion / Worst Expansion / P95** — how far the gap moved against the position; P95 is
  the tail (only 5% expanded further).
- **Holding** — time a position stayed open.
- **Confidence** — an event-count band; speaks to sample size, not to future likelihood.
- **Robustness / Validation** — agreement between training and validation windows.
- **Market Regime** — Normal / Expansion / Compression / Transition (deterministic).

## Trust rules

- Every number is reproducible from the CSV; verify by hand using the procedure in
  [QUALITY_ASSURANCE.md](QUALITY_ASSURANCE.md) §5.
- All scoring is deterministic and explicitly weighted — no hidden or AI weighting.
- Historical evidence only. GRT never predicts and never recommends a trade. Research ends at
  export; any trading system begins after export.
