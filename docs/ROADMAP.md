# ROADMAP — Gap Research Terminal

The pipeline ordering is frozen by the Constitution / `ARCHITECTURE.md`. This
roadmap tracks build status against it. Statuses: **Frozen** (built,
calculations immutable), **Completed** (built), **Future** (planned).

## Completed / Frozen

| # | Module | Status |
|---|---|---|
| — | Data Manager (parse / validate / merge / filter) | Completed |
| 1 | Research Engine v1.0 | **Frozen — CSV validated** |
| 2 | Overview + classic gap analytics (Events, Recovery, MAE, Stop-Loss Research, Failed, Explorer, Session) | Completed |
| 3 | Research Lab | **Frozen** |
| 4 | Stop Loss Optimizer (+ SL Intelligence) | **Frozen** |
| 5 | Historical Strategy Finder (11A generate → 11B execute → 11C repository → 11D rank → 11E details/replay) | **Frozen** |
| 6 | Research Repository | **Frozen** |
| 7 | Strategy Ranking | **Frozen** |
| 8 | Strategy Details (Dossier) | Completed |
| 9 | Replay Engine | Completed |
| 10 | Strategy Comparison | Completed |
| 11 | Probability Engine v1.0 (Core) | Completed |
| 12 | Opportunity Scanner (on the probability matrix) | Completed |
| 13 | Market Context Engine v1.0 | Completed |

## Remaining (Future)

| # | Module | Notes |
|---|---|---|
| 14 | **Reliability Engine** | Stability/consistency of historical results. **Probability ≠ Reliability** (Rule 5) — separate calculation. |
| 15 | **Walk Forward Validation** | Sequential-window robustness check over stored data. |
| 16 | **Reports** (Daily / Strategy / Probability) | Formatted, exportable summaries composed from existing results. |
| 17 | **AI Research Assistant** | Natural-language research over existing outputs. Must obey the Constitution — describe history, never predict. |
| 18 | **EA Export** | Export of researched parameters for external use. Research artefact only; not a live trading bridge. |

## Release criteria (every module)

A module may be marked Completed only when it meets the `VALIDATION.md`
acceptance checklist:
1. Answers exactly one research question.
2. All numbers reproducible from CSV, with a documented verification procedure.
3. No duplication of an existing engine calculation.
4. Deterministic; explicit documented weights for any score.
5. Defaults to a recent window where applicable.
6. Empty / low-confidence / invalid / truncation states handled.
7. Historical-only wording (no predictions, no trade advice).
8. `tsc -b && vite build` passes clean.

## Versioning

- **Engines** are versioned (Research Engine v1.0, Probability Engine v1.0,
  Market Context Engine v1.0). A breaking change to an engine's calculation is a
  new major version, never an in-place edit of a frozen engine.
- The **Constitution** is versioned independently; amendments are deliberate.
