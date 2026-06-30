# Contributing — Gap Research Terminal

This is the developer contribution guide. Read it alongside
[ARCHITECTURE.md](ARCHITECTURE.md), [CODING_STANDARDS.md](CODING_STANDARDS.md),
[QUALITY_ASSURANCE.md](QUALITY_ASSURANCE.md) and the
[Product Operations Manual](PRODUCT_OPERATIONS.md) (the release guide).

## Status: v1.0 is frozen

GRT v1.0 is complete. **Only bug fixes** land in v1.x. New features belong to the
[V2 Backlog](V2_BACKLOG.md) and must clear an architecture review, methodology approval, a
CSV-validation definition and a testing definition before any release.

## Ground rules (non-negotiable)

1. **The Research Engine is the single source of truth.** Never duplicate or re-implement a
   calculation. Later layers (reports, AI, export) **consume** computed results; they never
   recompute differently.
2. **Frozen modules are frozen.** Do not modify calculations in Research, Probability,
   Reliability, Walk Forward, Market Context, AI Assistant or EA Export.
3. **Every number is reproducible from the CSV** and **deterministic**.
4. **Historical evidence only** — no predictions, no recommendations, no Buy/Sell.

## Project shape

- Pure engines live in `src/utils/`; thin views in `src/components/<domain>/`; shared state in
  React contexts. See [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md).
- TypeScript strict mode (`noUnusedLocals`, `noUncheckedIndexedAccess`). Match the
  surrounding code's idiom, naming and comment density.

## Adding a module (v2 / future)

Provide a frozen spec covering: **Purpose, Research Question, Inputs, Outputs, Dependencies,
Validation, Acceptance Criteria, Change Policy, Implementation Notes**. Register it in the
[Module Registry](MODULE_REGISTRY.md) and wire it (AppView, route, sidebar, `moduleMeta`).
Modules self-register with Universal Search via `MODULE_REGISTRY` in `searchRegistry.ts`.

## Definition of done (every change)

Per the operations manual, a change merges only with:

- **Unit tests** — invariants for new utilities/parsers/helpers.
- **Integration tests** — the data flow holds (determinism).
- **CSV validation** — values reproduce from a golden CSV.
- **Regression tests** — a permanent QA check for any fixed bug.

Add these to the QA framework (`src/utils/qa.ts`) so **Settings → Quality Assurance** stays
green (`runQa()` → Release Approved).

## Workflow

1. Branch: `feature/*`, `fix/*`, `hotfix/*` or `release/*` off `develop` (`main` is production).
2. Build clean: `npx tsc -b && npm run build`.
3. Run QA and confirm **Release Approved**.
4. Commit with Conventional Commits: `feat:`, `fix:`, `docs:`, `refactor:`, `perf:`, `test:`,
   `build:`.
5. Update [`CHANGELOG.md`](../CHANGELOG.md) (Added / Changed / Fixed / Removed / Known Issues).

## Deprecations

Never silently remove a feature. Mark it deprecated, document the replacement, and remove only
in the next major release.
