# User Guide — Gap Research Terminal

A complete tour of GRT for the researcher. For a fast path, see the
[Quick Start](QUICK_START.md). For methodology, see the [Research Guide](RESEARCH_GUIDE.md).

## What GRT is (and is not)

GRT is a browser-based platform for **historical statistical research** on pair-spread
("gap") behaviour from MT5 GapMonitor CSV exports. It is **not** a trading application: no
broker connection, no orders, no buy/sell signals, no predictions or recommendations.

## Navigation

The sidebar groups every module into four sections:

- **Dashboard** — Overview, Universal Search, Market Intelligence, Events, Event Explorer,
  Recovery Matrix, MAE Analysis, Stop-Loss Research, Failed Events, Session Analysis.
- **Research** — Research Lab, Stop Loss Optimizer, Historical Strategy Finder, Research
  Repository, Strategy Ranking, Strategy Details, Replay Engine, Strategy Comparison,
  Probability Engine, Reliability Engine, Walk Forward Validation, AI Research Assistant.
- **Reports** — Reporting Engine, EA Export Engine, and report placeholders.
- **Settings** — Quality Assurance, Settings.

Press **⌘K / Ctrl-K** anywhere to open Universal Search.

## Loading data

Upload one or more CSV files. GRT validates columns and types, derives a day bucket and
session per sample, and merges files into one day-aware dataset. The sidebar lists loaded
files with valid/invalid counts. Use *Clear* to reset.

## Core modules

- **Overview** — dataset summary: sample counts, gap statistics, sync quality.
- **Research Lab** — one scenario at a time on the frozen Research Engine. Define entry,
  recovery and stop-loss; read the historical outcome.
- **Stop Loss Optimizer** — sweep stop-loss levels; the intelligence layer highlights
  diminishing returns, plateaus and efficiency.
- **Historical Strategy Finder** — generate many combinations, research the ready ones, and
  store completed results in the Repository.
- **Research Repository** — the central, de-duplicated store of completed results. Exportable
  and backup-able.
- **Strategy Ranking** — deterministic, fixed-weight ranking across stored strategies.
- **Strategy Details** — the dossier: outcomes, sessions, months, holding distribution, gap
  stats and observations. Open an occurrence in **Replay**.
- **Replay Engine** — reconstructs one historical occurrence sample-by-sample.
- **Strategy Comparison** — 2–5 strategies side by side.
- **Probability Engine / Opportunity Scanner** — historical compression probability per
  target gap, then filtered/scored/ranked.
- **Reliability Engine** — a 0–100 trust score (graded) from seven weighted components.
- **Walk Forward Validation** — robustness across rolling training/validation windows.
- **Market Context (Market Intelligence)** — where the current gap sits in recent history,
  regime, volatility and distribution.

## Explaining, reporting, exporting

- **AI Research Assistant** — a deterministic explanation layer. Pick a subject strategy and
  ask questions; it explains, compares, summarises and defines using only existing research.
  It refuses any Buy/Sell or prediction request. Export the conversation to MD / Text / PDF.
- **Reporting Engine** — seven report types in four themes; export PDF / CSV / JSON. Every
  report follows the same structured sections and is descriptive only.
- **EA Export Engine** — convert verified research into standardized configuration profiles
  (JSON / CSV / YAML / XML) with a deterministic checksum. It emits no executable code.

## Quality Assurance

**Settings → Quality Assurance** runs the permanent test framework against the frozen
engines and issues a **Release Certificate**. Export the certificate as Markdown or JSON.

## Settings & persistence

Analysis defaults (bin sizes, recovery/SL parameters, default sessions) and UI state persist
in your browser's `localStorage`. The Repository can be exported as a full backup.

## Golden rule

Every statistic in GRT is reproducible from the uploaded CSV. If a number cannot be traced
back to the data, treat it as a bug (see [Troubleshooting](TROUBLESHOOTING.md)).
