# UI STANDARDS — Gap Research Terminal

GRT uses a single **institutional dark theme**. All values below are the
existing theme tokens (see `tailwind.config`); do not introduce ad-hoc colours.

## Colour tokens

| Token | Hex | Use |
|---|---|---|
| `panel` | `#0b1220` | App / page background |
| `panel-raised` | `#111a2c` | Cards, raised surfaces, tooltips |
| `panel-border` | `#1e293b` | Borders, dividers, grid lines |
| `ink` | `#e2e8f0` | Primary text |
| `ink-muted` | `#94a3b8` | Secondary text |
| `ink-faint` | `#64748b` | Labels, hints, axis ticks |
| `accent` | `#38bdf8` | Active state, primary highlight, current selection |
| `positive` | `#34d399` | Good / recovery / "safer" |
| `warning` | `#fbbf24` | Caution / after-SL / experimental |
| `negative` | `#f87171` | Risk / SL hit / worst |

### Semantic meaning (consistent everywhere)
- **positive** = recovery / lower risk / higher probability bands.
- **warning** = intermediate / after-SL / experimental status.
- **negative** = stop-loss / worst gap / risk.
- **accent** = the current/selected thing, and primary actions.

### Probability colour bands (Opportunity Scanner)
95%+ green · 90–95% light green · 80–90% yellow · 60–80% orange · <60% red.

## Typography

- **Sans:** Inter — labels, prose, headings.
- **Mono:** JetBrains Mono — all numeric/tabular data (tables, stat values,
  matrices). Numbers are mono so columns align.
- Section labels use the `stat-label` utility (uppercase, tracked, faint).

## Spacing & layout

- Page content is a vertical stack: `space-y-5`.
- Cards use the `card` class (raised surface + border) with `p-4`/`p-5` padding.
- Card grids: `grid gap-3` with responsive `sm:grid-cols-3 xl:grid-cols-6`.
- Every page renders a central `PageHeader` (module name + description + status
  badge) above its content; the top bar is never redesigned per page.

## Cards

- **StatCard** for KPIs: label (+ optional `InfoTip`), value, optional hint,
  optional `tone`.
- Featured/highlight cards use a tinted border+bg (`border-<tone>/40 bg-<tone>/10`).

## Tables

- Sticky header (`sticky top-0 bg-panel`), `divide-y divide-panel-border` body,
  mono numeric cells, right-aligned numbers, left-aligned labels.
- Sortable columns show a ▲/▼ marker; provide search/filter where useful.
- Cap very large result sets (~500–1000 rows) with a "showing first N" note.
- Highlight semantics via tone classes (green best / red worst, etc.).

## Charts (Recharts)

- Dark axes: tick `#64748b`, no tick lines, axis line `#1e293b`,
  `CartesianGrid` `#1e293b` dashed.
- Tooltip: bg `#111a2c`, border `#1e293b`, rounded `8`, font `12`.
- `isAnimationActive={false}` for deterministic, instant rendering.
- Series colours come from the semantic tokens; multi-series use the shared
  palette. Reference lines mark levels (entry/recovery/SL) and the balanced/
  current position.

## Icons

- Single inline SVG set (`components/common/icons.tsx`), `currentColor`,
  consistent stroke (1.75). No external icon dependency. Each module has a
  representative icon; section headers (Dashboard/Research/Reports/Settings)
  have their own.

## States

- **Loading:** skeletons (`DashboardSkeleton`) or a spinner / "Recalculating…"
  indicator for deferred work. Never a blank screen.
- **Empty:** `EmptyState` (icon + title + description, optional action). Each
  data-dependent page shows a meaningful empty state, not the raw app shell.
- **Coming soon:** `ModulePlaceholder` (what the module will do + "Current
  Status: Coming Soon").
- **Error:** an `ErrorBoundary` wraps the app; module-level warnings use a
  bordered `warning`-toned banner with an alert icon.

## Wording (Constitution Rule 4)

Descriptive, historical, past-tense. Allowed: *Historical Opportunity,
Historical Probability, Historical Compression, Historically Balanced, Research
Confidence*. Forbidden: *Best Trade, Recommended, Buy, Sell, Entry, Take Profit,
will, should*.
