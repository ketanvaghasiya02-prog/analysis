# Quality Assurance — Permanent Testing Framework

> Status: **permanent**. This document defines the official testing methodology for
> Gap Research Terminal (GRT). Every module must pass this framework before being
> considered production-ready. Testing is mandatory; CSV verification is mandatory;
> no feature may bypass QA.

The framework is implemented as a pure, deterministic engine in
[`src/utils/qa.ts`](../src/utils/qa.ts) and surfaced in-app at **Settings →
Quality Assurance** ([`QaView`](../src/components/qa/QaView.tsx)). It exercises the
frozen engines **read-only** against built-in golden datasets and issues a release
certificate. It never modifies any module.

## 1. Quality philosophy

- **Trust is more important than features.** A wrong number is worse than a missing one.
- **Every statistic shown by GRT must be reproducible from the uploaded CSV.**
- **Every release must be validated before publication** against the release gate below.

## 2. Quality levels

| Level | Purpose | Where |
|---|---|---|
| Unit Testing | Each calculation utility, parser, statistics helper, formatter, validator behaves correctly in isolation. | `qa.ts` invariant suite + per-util checks |
| Integration Testing | The full data flow holds end to end. | `qa.ts` determinism suite |
| Regression Testing | No previously fixed bug reappears. | one permanent check per fixed bug |
| Manual CSV Validation | Random values verified by hand against the CSV. | procedure in §5 |
| Performance Testing | Operations complete within budget. | `qa.ts` performance suite |
| Stress / Load Testing | Large datasets and repositories remain responsive. | §9 |
| Release Testing | The release gate passes. | §12 |

## 3. Module test matrix

The permanent checklist lives in `MODULE_TEST_MATRIX` (`qa.ts`) and renders in the QA
view. Coverage is one of **automated** (verified by a QA suite), **manual** (procedure
required) or **visual** (UI inspection).

CSV Manager · Dashboard · Research Engine · Research Lab · Stop Loss Optimizer ·
Historical Strategy Finder · Repository · Ranking · Strategy Details · Replay Engine ·
Probability Engine · Opportunity Scanner · Reliability Engine · Walk Forward Validation ·
Market Context · Reports · AI Assistant · EA Export.

## 4. Automated suites

Run via `runQa()` (in-app "Re-run", or `tsx` against `src/utils/qa.ts`):

1. **CSV Validation** — parse a golden CSV through the real parser; assert the sample
   count, that every parsed gap equals the CSV cell, and that `gapSummary` reproduces
   the hand-computed mean/min/max. *(critical)*
2. **Determinism** — run Reliability, Walk Forward, Probability, Market Context and the
   dossier twice on identical input; assert byte-identical output. *(critical)*
3. **Engine Invariants** — reliability ∈ [0,100], component weights sum to 100,
   probabilities ∈ [0,100] and non-increasing across further targets, market percentiles
   ordered (min ≤ P25 ≤ median ≤ P75 ≤ P90 ≤ P95 ≤ max), walk counts reconcile.
4. **Edge Cases** — empty/one-row CSV, missing gap values, duplicate timestamps,
   zero-occurrence record, empty probability input — none may crash.
5. **AI Validation** — every forbidden question is refused; explanations carry no
   recommendation language, cite the research window + sample size, carry the disclaimer
   and reuse the stored reliability grade verbatim.
6. **Export Validation** — all four formats serialise non-empty; the checksum is
   deterministic across differing timestamps; exported entry/recovery/SL match the record;
   the EA config contains no executable code.
7. **Performance** — Market Context / Probability / Reliability / Walk Forward complete
   within generous budgets.

## 5. Official CSV validation procedure

1. Load a known CSV export.
2. Randomly choose a strategy and pick: Entry, Recovery, Stop Loss, Probability, Holding,
   Expansion, Reliability, Validation, a Replay occurrence and a Report figure.
3. For each, trace the displayed value back to the raw CSV rows by hand.
4. The value is verified only when it reproduces exactly. Any mismatch is a **Critical** bug.

## 6. Golden datasets

Deterministic fixtures in `qa.ts` (`goldenCsv`, `goldenSamples`, `goldenOccurrences`,
`goldenRecord`). The methodology recognises seven reference classes that every future
module must pass: Small, Medium, Large, Edge, Corrupted, Missing-Values, Duplicate-Rows.

## 7. Edge case library

Empty CSV · One-row CSV · No events · Only recoveries · Only stop-loss · Huge gap ·
Zero gap · Negative gap · Missing time · Missing date · Duplicate timestamp · Large file ·
Small file. The automated edge suite covers the load-bearing cases; the remainder are
verified during release testing.

## 8. Regression testing

Every fixed bug gains a **permanent** check in the relevant suite that reproduces the
original failure and asserts the fix. No previously fixed bug may reappear. Regression
checks are never deleted.

## 9. Performance & load testing

Measure: CSV import, research execution, probability generation, repository load, search
speed, report export, memory usage, large-repository handling. Load tiers: 10K / 50K /
100K / 250K / 500K rows and large repositories. The automated performance suite guards the
core engine operations; full-tier load runs are part of release testing.

## 10. Error handling

Invalid CSV, wrong columns, wrong types, missing data, unexpected values and large numbers
must degrade gracefully — never crash, always surface a clear state.

## 11. Visual testing (manual)

Cards, tables, charts, loading states, empty states, error states, dark theme and
responsive layout are inspected on the Dashboard and module views.

## 12. Release gate

No release is allowed unless **all** hold:

- All unit tests pass.
- All integration tests pass.
- CSV validation passes.
- Performance targets pass.
- Regression passes.
- No **Critical** bugs remain.

The QA engine encodes this as `releasePassed` (no critical **or** high failures) and the
view renders a **Release Approved / Release Blocked** certificate.

## 13. Bug classification

| Class | Blocks release | Definition |
|---|---|---|
| Critical | yes | Wrong statistic, non-reproducible value, data loss, or any trading-advice / prediction leak. |
| High | yes | Determinism break, broken export, or an engine that crashes on valid input. |
| Medium | no | Edge-case mishandling or a performance-budget miss. |
| Low | no | Minor inaccuracy with no statistical impact. |
| Cosmetic | no | Visual / styling only. |

## 14. Quality certificate

The QA view generates, and can export (Markdown / JSON):

- **QA Report** — every suite and check with pass/fail and severity.
- **Release Certificate** — Approved / Blocked with the gate summary.
- **CSV Validation Summary** — the CSV suite result.
- **Regression Summary** — the regression checks’ status.
- **Performance Summary** — measured durations vs budgets.

## 15. Acceptance criteria

GRT is production-ready only with: 100% CSV reproducibility, no deterministic calculation
errors, no duplicated calculations, no critical bugs, and performance targets achieved.

## 16. Change policy

Every future feature must include **Unit Tests, Integration Tests, CSV Validation and
Regression Tests** before merging. Research stays authoritative and deterministic; QA stays
permanent.
