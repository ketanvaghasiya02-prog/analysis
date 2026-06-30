# GRT v2 Backlog

> Ideas **outside v1 scope**, stored separately so they never modify the
> [v1 roadmap](ROADMAP.md). Nothing here is committed work — each item must pass an
> architecture review, research-methodology approval, a CSV-validation definition and a
> testing definition (per the [Product Operations Manual](PRODUCT_OPERATIONS.md) §17)
> before entering any release.

## Status

GRT v1.0 is **complete and frozen**. No item below may be implemented inside v1.x; each
belongs to a future **v2** line unless it is a bug fix.

## Candidate backlog (unprioritised)

| Idea | Notes / open questions |
|---|---|
| Cloud Sync | Optional sync of Repository / settings. Must preserve "data stays in the browser" as the default; opt-in only. |
| Broker APIs | Read-only market metadata only. **Must never** turn GRT into a trading app — the research/trading boundary at EA Export is permanent. |
| Live MT5 | Live data feed for Market Context. Descriptive only; no execution. |
| Multi-Asset Research | Generalise beyond a single pair/spread. Requires a research-methodology review. |
| Portfolio Analysis | Aggregate across multiple researched strategies. |
| Options Research | Distinct methodology; large scope. |
| Machine Learning | Strictly as an *explanation/clustering* aid over existing research — never to compute or replace deterministic research, and never to predict. |
| Prediction Models | **Conflicts with the constitution** (historical evidence only, no predictions). Out of scope unless v2 redefines the product; documented here only for completeness. |
| Mobile Application | Responsive web already exists; a native shell is a separate track. |

## Guardrails for any v2 work

- Deterministic research calculations remain authoritative; new layers stay interpretive.
- No feature may bypass CSV reproducibility or the QA release gate.
- The "research ends at export; trading begins after export" boundary is permanent.
- Deprecations follow the policy: mark, document replacement, remove only at the next major.
