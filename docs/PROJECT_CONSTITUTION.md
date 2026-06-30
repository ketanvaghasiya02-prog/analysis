# PROJECT CONSTITUTION — Gap Research Terminal (GRT)

> **Status: IMMUTABLE.** This document is the constitution of the project.
> Every module built after this date must comply. Amendments require an
> explicit, deliberate decision and a version bump of this file — they are not
> made casually and never as a side effect of a feature.

**Project:** Gap Research Terminal (GRT)
**Subtitle:** Professional CSV-Based Pair Spread Research Platform
**Constitution version:** 1.0

---

## Mission

Transform historical spread (gap) data into statistically reliable decision
**support** using recent market behaviour.

GRT is a **research instrument**, not a trading system.

## Core Philosophy

- The application exists to perform **research**.
- It does **not** exist to generate trading signals.
- It **never predicts** markets.
- It **never recommends** trades.
- It **never** produces Buy / Sell / Entry / Take-Profit / Stop-Loss advice.
- Every output is grounded in **historical evidence** derived from uploaded CSV.

No broker connection. No orders. No live data. No money. Gap points only.

---

## The Ten Immutable Rules

### Rule 1 — Research Engine is the single source of truth
All scenario outcomes (recovery before/after stop loss, SL hit, recovery times,
adverse excursion, confidence) originate from the **Research Engine v1.0**
(`src/utils/scenario.ts`, `computeScenario`). It is frozen and CSV-validated.

### Rule 2 — No module may duplicate Research Engine calculations
Downstream modules **consume** the Research Engine; they never reimplement the
position-simulation or outcome logic. When a metric already exists in an engine
output, read it — do not recompute it differently.

### Rule 3 — Every displayed number must be reproducible from uploaded CSV
If a figure on screen cannot be traced back, deterministically, to rows in an
uploaded CSV, it does not belong in GRT.

### Rule 4 — Historical evidence only. No predictions.
Wording is descriptive and past-tense: *historical probability, historical
compression, historical evidence, historically balanced*. Never *will*, *should*,
*recommended*, *best trade*.

### Rule 5 — Probability is not Reliability
Probability (how often something historically happened) and Reliability (how
**stable / trustworthy** that probability is across time and samples) are
**distinct**. Reliability must always be calculated and presented **separately**
— never conflated into a single "confidence" number.

### Rule 6 — One research question per module
Every module answers exactly **one** clearly stated research question (see
`MODULE_REGISTRY.md`). If a module needs to answer two, it is two modules.

### Rule 7 — Recent market behaviour is the default priority
The default research window is **15–30 days** (default 20). Long history is
analysed **only** when the user explicitly requests it. Modules that select a
window default to recent and expose an override; they never silently use all
history.

### Rule 8 — All calculations must remain deterministic
Same inputs → same outputs, every time. No `Math.random()` in business logic,
no time-of-day dependence, no nondeterministic ordering. (`Date.now()` is
permitted only for display timestamps, never inside a calculation.)

### Rule 9 — No hidden weighting. No AI-generated scoring.
Every score is computed from **explicit, documented, fixed weights** that a
reader can audit. No opaque heuristics, no model-generated numbers presented as
fact. Scoring formulas live in code and are described in the module's docs.

### Rule 10 — Every module must support CSV verification
For any number a module shows, there must be a documented path to reproduce it
by hand from the source CSV (see `VALIDATION.md`). A module is not "done" until
it has a manual CSV verification procedure.

---

## Frozen modules (do not modify)

The following are **frozen**. Their calculation logic must not change:

- Research Engine v1.0 (`scenario.ts`) — CSV validated
- Research Lab
- Stop Loss Optimizer
- Historical Strategy Finder (Phases 11A–11E)
- Research Repository
- Strategy Ranking
- Probability Engine v1.0

Presentation layers may be added **on top** of frozen modules without altering
their calculations.

---

## Governance

- This constitution supersedes any conflicting instruction in a feature
  request. If a feature would violate a rule, the feature is wrong, not the rule.
- Companion documents (`ARCHITECTURE.md`, `MODULE_REGISTRY.md`,
  `PROJECT_STRUCTURE.md`, `CODING_STANDARDS.md`, `UI_STANDARDS.md`,
  `PERFORMANCE.md`, `VALIDATION.md`, `ROADMAP.md`) refine but never contradict
  this file.
