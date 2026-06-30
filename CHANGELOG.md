# Changelog

All notable changes to **Gap Research Terminal (GRT)** are documented here. The format
follows [Keep a Changelog](https://keepachangelog.com/) and the project adheres to
[Semantic Versioning](https://semver.org/). See the
[Product Operations Manual](docs/PRODUCT_OPERATIONS.md) for the release process.

## [1.0.0] — 2026-06-30

First production release. GRT v1.0 is a browser-based, CSV-driven historical statistical
research platform for pair-spread (gap) analysis. It is **not** a trading application: no
broker connection, no orders, no signals, no predictions. Every statistic is reproducible
from the uploaded CSV, and every calculation is deterministic.

### Added

- **Data & Dashboard** — CSV Manager (worker-parsed, validated), Overview, Events, Event
  Explorer, Recovery Matrix, MAE Analysis, Stop-Loss Research, Failed Events, Session
  Analysis.
- **Research Engine v1.0 (frozen)** — single source of truth for scenario computation;
  one position at a time, first-touch entry, SL as a classification boundary.
- **Research Lab** — scenario testing over the frozen engine (CSV-validated).
- **Stop Loss Optimizer** — sweep stop-loss levels and read the historical outcome at each,
  with an intelligence/insights layer.
- **Historical Strategy Finder** — parameter-combination generation and research execution.
- **Research Repository** — centralized, de-duplicated store of completed results.
- **Strategy Ranking** — deterministic fixed-weight statistical ranking.
- **Strategy Details** — complete historical dossier per strategy.
- **Replay Engine** — faithful reconstruction of a single historical occurrence.
- **Strategy Comparison** — side-by-side comparison of 2–5 strategies.
- **Probability Engine (frozen)** — historical compression probability per target gap, plus
  the Opportunity Scanner.
- **Reliability Engine (frozen)** — deterministic 0–100 trust score from seven explicitly
  weighted components.
- **Walk Forward Validation (frozen)** — robustness across rolling training/validation windows.
- **Market Context (frozen)** — descriptive current-market statistics over a recent window
  (default 15 days), deterministic regime classification, distribution and volatility.
- **Universal Search** — indexed discovery across all research objects and modules
  (⌘K / Ctrl-K), with grouping, history and export.
- **Reporting Engine** — professional, descriptive reports (7 types, 4 themes, PDF/CSV/JSON).
- **AI Research Assistant** — deterministic explanation layer; explains, compares,
  summarises and defines existing research. Never calculates, predicts or advises.
- **EA Export Engine** — standardized configuration profiles (JSON/CSV/YAML/XML) with a
  deterministic content checksum. No Expert Advisor code, no trading logic.
- **Quality Assurance** — permanent testing framework with golden datasets and a release
  certificate (40 automated checks across 7 suites).
- **Governance** — 15 frozen specification documents plus this operations manual, user and
  developer guides, V2 backlog and the project completion certificate.

### Changed

- Navigation reorganised into collapsible **Dashboard / Research / Reports / Settings**
  sections; application renamed to **Gap Research Terminal**.

### Fixed

- Universal Search: invalid filters (e.g. `recovery > abc`) now return no matches instead of
  matching everything; multi-word field names (`worst expansion`) parse correctly.
- AI Assistant: plural forbidden phrasings (`generate signals/entries/exits`) are refused.
- EA Export: version strings are quoted in YAML so types round-trip losslessly.

### Removed

- Nothing. No previously shipped feature was removed (see the deprecation policy).

### Known Issues

- Probability and Market Context reports/exports require a loaded dataset (they are not
  persisted in the Repository); they gate themselves with a clear message when no dataset is
  present.
- Replay reports require the originating dataset to be loaded to locate the occurrence samples.
- Production JS bundle exceeds the 500 kB warning threshold (charts library); functionality
  is unaffected. Code-splitting is a candidate optimisation for v1.x.

[1.0.0]: https://example.com/grt/releases/1.0.0
