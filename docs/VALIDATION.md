# VALIDATION — Gap Research Terminal

Constitution Rule 10: **every module must support CSV verification.** A module is
not "done" until every number it shows can be reproduced by hand from the source
CSV. This document is the standard each module must meet.

## Required for every module

### 1. Manual CSV verification
A written procedure to reproduce the module's headline numbers directly from an
uploaded CSV, independent of the app. Typically:
- Take a small, known CSV (or a slice of the real export).
- Reproduce the calculation by hand / in a scratch script.
- Confirm the app's output matches exactly.

The Research Engine v1.0 is the reference: it was validated against the real
4,167-row export (raw crossings → deduped positions → outcomes verified by
replication). Every consuming module inherits that validation by **reading**
the engine rather than recomputing (Rule 2), and adds verification for its own
derived numbers.

### 2. Edge-case testing
Each module must define and handle:
- **Empty / no data** → dedicated empty state, no crash.
- **Below minimum events** → low-confidence warning, not a hidden silent result.
- **Invalid inputs** → rejected with a clear message (e.g. recovery ≥ entry,
  target ≥ current gap, start > end).
- **Null/missing fields** (gaps, timestamps, sessions) → skipped or surfaced,
  never silently treated as zero.
- **Single-row / single-day** datasets → degrade gracefully.
- **Truncation** (capped ladders/grids) → visible note.

### 3. Acceptance checklist (per module)
- [ ] Answers exactly one research question (Rule 6).
- [ ] All numbers reproducible from CSV (Rule 3) with a documented procedure.
- [ ] No recomputation of an existing engine number (Rule 2).
- [ ] Deterministic — same inputs give same outputs (Rule 8).
- [ ] Scoring (if any) uses explicit, documented weights (Rule 9).
- [ ] Defaults to a recent window where applicable (Rule 7).
- [ ] Empty / low-confidence / invalid states handled.
- [ ] Wording is historical only — no predictions or trade advice (Rule 4).
- [ ] `tsc -b && vite build` passes clean.

### 4. Regression testing
- Frozen modules must produce **identical** outputs after any surrounding
  change. Before/after a refactor, headline numbers on a known dataset must not
  move.
- When a presentation layer is added on top of a frozen module, verify the
  frozen module's outputs are byte-for-byte unchanged.
- Keep the verification dataset and expected headline values recorded so a
  regression is obvious.

## How calculations have been verified historically

Throughout development, engines were checked by replicating their logic against
the real CSV in throwaway scripts and confirming counts/percentiles/positions
matched (e.g. Probability Engine position model, Opportunity scoring,
Comparison best/worst, Replay marker detection, Market Context percentiles).
This is the expected bar for every new engine: **replicate independently,
confirm equality, then ship.**
