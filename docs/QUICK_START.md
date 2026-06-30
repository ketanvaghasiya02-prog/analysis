# Quick Start — Gap Research Terminal

Get from a CSV export to your first research result in a few minutes.

## 1. Open GRT

GRT runs entirely in your browser. Your data never leaves your machine.

```bash
npm install
npm run dev      # development
# or
npm run build && npm run preview   # production build
```

## 2. Load a dataset

- Drag one or more **GapMonitor CSV exports** onto the upload area (sidebar → *Upload Data*,
  or the hero drop zone on the empty Dashboard).
- GRT parses and validates each file. Invalid rows are reported, not silently dropped.

## 3. Explore the dataset

Open **Dashboard → Overview** for a summary, then **Events**, **Recovery Matrix**,
**Session Analysis**, etc. Every number traces back to the CSV.

## 4. Run research

- **Research → Research Lab** — test a single scenario (entry / recovery / stop-loss) on the
  frozen Research Engine.
- **Research → Historical Strategy Finder** — generate and research many parameter
  combinations; completed results are stored in the **Research Repository**.

## 5. Investigate results

- **Strategy Ranking** — deterministic ranking of stored strategies.
- **Strategy Details** — full historical dossier; open a single occurrence in the **Replay
  Engine**.
- **Reliability Engine** — how much to trust a result. **Walk Forward Validation** —
  robustness on unseen windows. **Probability Engine** — compression probability.

## 6. Explain, report and export

- **AI Research Assistant** — ask "Explain this strategy", "Why is reliability lower?",
  "Compare A vs B". It explains existing research; it never predicts or advises.
- **Reporting Engine** — generate a professional PDF / CSV / JSON report.
- **EA Export Engine** — export verified research as JSON / CSV / YAML / XML configuration
  for external systems. No trading code is generated.

## 7. Find anything

Press **⌘K / Ctrl-K** (or Dashboard → Universal Search) to jump to any stored result or
module, with advanced filters like `recovery > 90` or `session = London`.

## 8. Verify quality

**Settings → Quality Assurance** runs the permanent test framework and issues a release
certificate confirming CSV reproducibility and determinism.

> GRT is a research tool, not a trading application. It shows what *happened* historically —
> never what *will* happen.
