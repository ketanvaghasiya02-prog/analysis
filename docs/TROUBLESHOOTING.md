# Troubleshooting — Gap Research Terminal

If something looks wrong, start here. Remember the golden rule: **every statistic must be
reproducible from the CSV.** A value that cannot be traced back to the data is a bug — see
[QUALITY_ASSURANCE.md](QUALITY_ASSURANCE.md) for severity and reporting.

## Upload & parsing

**My CSV won't load / shows invalid rows.**
- Confirm it is an MT5 GapMonitor export with the expected columns (see `EXPECTED_COLUMNS` in
  `src/types/gap.ts`).
- Rows with no identifier and no timestamp, or with no parseable numeric field, are rejected
  and listed as invalid. This is by design — bad rows are never silently trusted.

**Some rows are missing after upload.**
- Empty rows and corrupt rows are excluded. The sidebar shows valid/invalid counts per file;
  the file's invalid list explains why each row was dropped.

**Dates or sessions look off.**
- The day bucket is derived from `ServerTime`, falling back to the filename date then the
  `Date` column. Ensure `ServerTime` is present and parseable.

## Modules show "no data" or are disabled

- Dataset-driven modules (Overview, Events, Probability, Market Context, Replay) need a loaded
  dataset. Repository-driven modules (Repository, Ranking, Reliability, Walk Forward, Reports,
  EA Export, AI Assistant) work without a dataset but need stored research.
- Empty Repository? Run the **Historical Strategy Finder** to research and store strategies.

## Specific modules

**Reliability / Walk Forward say "insufficient history".**
- These need enough occurrences/trading days to form windows. Widen the research window or
  research a strategy with more historical events.

**Probability / Market Context report can't be generated.**
- They require a loaded dataset (they are not persisted). Load the originating CSV.

**Replay can't find the occurrence.**
- Replay reconstructs from the loaded dataset. Load the dataset the strategy was researched on
  so its samples are present.

**AI Assistant won't answer a question.**
- It refuses Buy/Sell, prediction and signal-generation requests by design. Rephrase as an
  explanation ("Explain this strategy", "Why is reliability lower?").

**An export looks different each time.**
- The *content checksum* is deterministic; only the creation timestamp changes. If the
  checksum changes for identical research, that is a bug — capture it for QA.

## Quality & validation

**A displayed number doesn't match my manual CSV calculation.**
- Treat as a **Critical** bug. Re-run **Settings → Quality Assurance**; export the certificate
  and the offending values, and follow the maintenance policy (fix → regression test → CSV
  validation → release).

## Performance

**The app feels slow on a very large file.**
- CSV parsing runs in a worker; very large repositories render incrementally. Check the QA
  performance suite for budgets. Code-splitting the charts bundle is a known v1.x optimisation.

## Reset / recovery

- **Clear data** in the sidebar resets the loaded dataset (not the Repository).
- Restore the Repository from a backup JSON, or re-run research from the CSV (deterministic).
- Settings live in `localStorage`; clear it to return to documented defaults.
