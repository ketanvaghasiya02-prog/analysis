/**
 * Strategy Comparison (Phase 11G) — read-only side-by-side comparison of 2–5
 * stored strategies. Reads the Research Repository, reuses the frozen dossier
 * aggregation and ranking score; never reruns the engine, never recommends.
 */

import { useMemo, useState } from 'react';
import { useRepository } from '@/context/RepositoryContext';
import { useComparison } from '@/context/ComparisonContext';
import {
  buildComparison,
  comparisonCsv,
  comparisonJson,
  printComparisonPdf,
  MAX_COMPARE,
  type CompStrategy,
  type MetricFormat,
  type MetricRow,
} from '@/utils/strategyComparison';
import type { RepositoryRecord } from '@/utils/researchRepository';
import { CONFIDENCE_LABELS, type ConfidenceLevel } from '@/utils/scenario';
import { downloadExport } from '@/utils/reports';
import { ComparisonCharts } from '@/components/comparison/ComparisonCharts';
import { fmtDuration, fmtInt, fmtNumber, fmtPercent } from '@/utils/format';
import { AlertIcon, DownloadIcon, LayersIcon, TableIcon } from '@/components/common/icons';

const CONFIDENCE_ORDER: ConfidenceLevel[] = ['VERY_LOW', 'LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH'];
const DIFF_METRIC_KEYS = ['historicalTrades', 'recoveryBeforeSlPct', 'recoveryIgnoringSlPct', 'slHitPct', 'avgRecoverySec', 'worstMaxGap', 'overallScore'];

const BASELINE_KEY = '__repository_baseline__';

/**
 * A synthetic "Repository Baseline" record = the average of all stored
 * strategies. Used so a single strategy always has something to compare
 * against. Page-level data prep only — a transparent mean; the frozen
 * comparison engine and the stored repository records are untouched.
 */
function repositoryBaseline(records: RepositoryRecord[]): RepositoryRecord {
  const n = Math.max(1, records.length);
  const mean = (f: (r: RepositoryRecord) => number) => records.reduce((a, r) => a + f(r), 0) / n;
  const meanNul = (f: (r: RepositoryRecord) => number | null) => {
    const vs = records.map(f).filter((v): v is number => v !== null && Number.isFinite(v));
    return vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : null;
  };
  const ord = Math.round(mean((r) => CONFIDENCE_ORDER.indexOf(r.confidenceLevel)));
  const confidenceLevel = CONFIDENCE_ORDER[Math.min(CONFIDENCE_ORDER.length - 1, Math.max(0, ord))]!;
  const froms = records.map((r) => r.dateFrom).filter(Boolean).sort();
  const tos = records.map((r) => r.dateTo).filter(Boolean).sort();
  return {
    key: BASELINE_KEY,
    id: 'Repository Baseline',
    entryGap: mean((r) => r.entryGap),
    recoveryGap: mean((r) => r.recoveryGap),
    stopLoss: mean((r) => r.stopLoss),
    recoveryBeforeSlPct: mean((r) => r.recoveryBeforeSlPct),
    recoveryAfterSlPct: mean((r) => r.recoveryAfterSlPct),
    recoveryIgnoringSlPct: mean((r) => r.recoveryIgnoringSlPct),
    slHitPct: mean((r) => r.slHitPct),
    totalPositions: Math.round(mean((r) => r.totalPositions)),
    historicalTrades: Math.round(mean((r) => r.historicalTrades)),
    avgRecoverySec: meanNul((r) => r.avgRecoverySec),
    medianRecoverySec: meanNul((r) => r.medianRecoverySec),
    avgMaxGap: meanNul((r) => r.avgMaxGap),
    worstMaxGap: meanNul((r) => r.worstMaxGap),
    p95MaxGap: meanNul((r) => r.p95MaxGap),
    p99MaxGap: meanNul((r) => r.p99MaxGap),
    avgHoldingSec: meanNul((r) => r.avgHoldingSec),
    confidenceLevel,
    confidenceLabel: CONFIDENCE_LABELS[confidenceLevel],
    executionMs: 0,
    createdAt: 0,
    sameDayOnly: records[0]?.sameDayOnly ?? true,
    dateFrom: froms[0] ?? '',
    dateTo: tos[tos.length - 1] ?? '',
    sessions: [...new Set(records.flatMap((r) => r.sessions))].sort(),
    occurrences: [],
  };
}

function fmtCell(v: number | null, format: MetricFormat): string {
  if (v === null || !Number.isFinite(v)) return '—';
  switch (format) {
    case 'int':
      return fmtInt(v);
    case 'pct':
      return fmtPercent(v);
    case 'num2':
      return fmtNumber(v, 2);
    case 'num3':
      return fmtNumber(v, 3);
    case 'dur':
      return fmtDuration(v);
    case 'score':
      return fmtNumber(v, 1);
    case 'confidence':
      return CONFIDENCE_LABELS[CONFIDENCE_ORDER[v] ?? 'VERY_LOW'];
  }
}

export function ComparisonView() {
  const { records } = useRepository();
  const { selected, toggle, remove, clear, isSelected, full } = useComparison();
  const [search, setSearch] = useState('');

  const selectedRecords = useMemo(
    () => selected.map((k) => records.find((r) => r.key === k)).filter((r): r is RepositoryRecord => !!r),
    [selected, records],
  );

  // Zero-friction default: with no manual filter, compare ALL stored strategies
  // (capped at MAX_COMPARE). No selection is ever required to open the page.
  const baseSet = useMemo(
    () => (selectedRecords.length > 0 ? selectedRecords : records.slice(0, MAX_COMPARE)),
    [selectedRecords, records],
  );

  // A single strategy is compared against the repository baseline (the average
  // of every stored strategy), so one strategy is always meaningful.
  const usingBaseline = baseSet.length === 1;
  const comparisonRecords = useMemo(
    () => (usingBaseline ? [repositoryBaseline(records), baseSet[0]!] : baseSet),
    [usingBaseline, records, baseSet],
  );

  const comparison = useMemo(
    () => (comparisonRecords.length >= 1 ? buildComparison(comparisonRecords) : null),
    [comparisonRecords],
  );

  const truncated = selectedRecords.length === 0 && records.length > MAX_COMPARE;

  const filteredRepo = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return records;
    return records.filter((r) =>
      `${r.id} ${r.entryGap}/${r.recoveryGap}/${r.stopLoss} ${r.confidenceLabel}`.toLowerCase().includes(q),
    );
  }, [records, search]);

  const stamp = () => new Date().toISOString();

  if (records.length === 0) {
    return (
      <div className="space-y-5">
        <Banner />
        <section className="card flex flex-col items-center gap-3 p-10 text-center">
          <LayersIcon className="text-3xl text-ink-faint" />
          <h2 className="text-base font-semibold text-ink">Repository is empty</h2>
          <p className="max-w-md text-sm text-ink-muted">
            Run the Historical Strategy Finder to populate the Research Repository,
            then return here to compare strategies.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Banner />

      {/* Selection */}
      <section className="card p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="stat-label">Filter Strategies (optional)</span>
          <span className="text-xs text-ink-faint">
            {selected.length > 0 ? `${selected.length} selected` : `showing all · up to ${MAX_COMPARE}`}
          </span>
          {selected.length > 0 && (
            <button type="button" onClick={clear} className="btn px-2 py-0.5 text-xs">Show all</button>
          )}
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search repository"
            className="ml-auto w-56 rounded-md border border-panel-border bg-panel px-2 py-1 text-xs text-ink focus:border-accent focus:outline-none"
          />
        </div>

        {selectedRecords.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {selectedRecords.map((r) => (
              <span key={r.key} className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-2.5 py-0.5 text-[11px] text-accent">
                {r.entryGap}/{r.recoveryGap}/{r.stopLoss}
                <button type="button" onClick={() => remove(r.key)} className="text-accent/70 hover:text-accent">✕</button>
              </span>
            ))}
          </div>
        )}

        <div className="max-h-56 overflow-auto rounded-lg border border-panel-border">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-panel text-ink-faint">
              <tr>
                <th className="px-3 py-1.5 font-medium"> </th>
                <th className="px-3 py-1.5 font-medium">ID</th>
                <th className="px-3 py-1.5 text-right font-medium">Entry</th>
                <th className="px-3 py-1.5 text-right font-medium">Recovery</th>
                <th className="px-3 py-1.5 text-right font-medium">Stop Loss</th>
                <th className="px-3 py-1.5 text-right font-medium">Rec. Before %</th>
                <th className="px-3 py-1.5 text-right font-medium">Trades</th>
                <th className="px-3 py-1.5 font-medium">Confidence</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {filteredRepo.map((r) => {
                const sel = isSelected(r.key);
                const disabled = !sel && full;
                return (
                  <tr key={r.key} className={['border-t border-panel-border/60', sel ? 'bg-accent/10' : 'hover:bg-panel/50'].join(' ')}>
                    <td className="px-3 py-1.5">
                      <input type="checkbox" checked={sel} disabled={disabled} onChange={() => toggle(r.key)} className="accent-accent" />
                    </td>
                    <td className="px-3 py-1.5 text-ink-muted">{r.id}</td>
                    <td className="px-3 py-1.5 text-right text-ink">{fmtNumber(r.entryGap, 2)}</td>
                    <td className="px-3 py-1.5 text-right text-ink-muted">{fmtNumber(r.recoveryGap, 2)}</td>
                    <td className="px-3 py-1.5 text-right text-ink-muted">{fmtNumber(r.stopLoss, 2)}</td>
                    <td className="px-3 py-1.5 text-right text-positive">{fmtPercent(r.recoveryBeforeSlPct)}</td>
                    <td className="px-3 py-1.5 text-right text-ink-muted">{fmtInt(r.historicalTrades)}</td>
                    <td className="px-3 py-1.5 font-sans text-ink-muted">{r.confidenceLabel}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {full && <p className="mt-2 text-[11px] text-warning">Maximum of {MAX_COMPARE} strategies selected.</p>}
      </section>

      {comparison ? (
        <>
          {usingBaseline && (
            <section className="card flex items-start gap-3 border-accent/30 bg-accent/5 p-3">
              <AlertIcon className="mt-0.5 text-base text-accent" />
              <p className="text-[13px] leading-relaxed text-ink-muted">
                Comparing one strategy against the <span className="font-semibold text-ink">Repository Baseline</span> — the average
                of {fmtInt(records.length)} stored {records.length === 1 ? 'strategy' : 'strategies'}. Tick 2+ strategies above to
                compare them directly instead.
              </p>
            </section>
          )}
          {truncated && (
            <p className="text-[11px] text-ink-faint">
              Showing the first {MAX_COMPARE} of {fmtInt(records.length)} stored strategies. Use the filter above to choose which to compare.
            </p>
          )}

          {/* Legend + export */}
          <section className="flex flex-wrap items-center gap-3">
            <div className="flex flex-wrap gap-2">
              {comparison.strategies.map((s) => (
                <span key={s.key} className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
                  <span className="h-3 w-3 rounded-sm" style={{ background: s.color }} />
                  <span className="font-semibold text-ink">{s.letter}</span> {s.params}
                </span>
              ))}
            </div>
            <div className="ml-auto flex flex-wrap gap-2">
              <button type="button" onClick={() => printComparisonPdf(comparison, stamp())} className="btn flex items-center gap-1.5 px-3 py-1.5 text-sm">
                <DownloadIcon className="text-sm" /> PDF
              </button>
              <button type="button" onClick={() => downloadExport(comparisonCsv(comparison))} className="btn flex items-center gap-1.5 px-3 py-1.5 text-sm">
                <DownloadIcon className="text-sm" /> CSV
              </button>
              <button type="button" onClick={() => downloadExport(comparisonJson(comparison, stamp()))} className="btn flex items-center gap-1.5 px-3 py-1.5 text-sm">
                <DownloadIcon className="text-sm" /> JSON
              </button>
            </div>
          </section>

          {/* Comparison table */}
          <MetricTable title="Comparison" strategies={comparison.strategies} metrics={comparison.metrics} />

          {/* Difference analysis */}
          <DifferenceTable comparison={comparison} />

          {/* Charts */}
          <ComparisonCharts comparison={comparison} />

          {/* Session comparison */}
          <SessionComparison strategies={comparison.strategies} />

          {/* Monthly comparison */}
          <MonthlyComparison strategies={comparison.strategies} />

          {/* Risk comparison */}
          <MetricTable
            title="Risk Comparison"
            strategies={comparison.strategies}
            metrics={comparison.metrics.filter((m) => comparison.riskMetricKeys.includes(m.key))}
          />

          {/* Summary */}
          <section className="card p-5">
            <h2 className="stat-label mb-3">Objective Observations</h2>
            <ul className="space-y-2">
              {comparison.observations.map((o, i) => (
                <li key={i} className="flex items-start gap-2 text-sm leading-relaxed text-ink-muted">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent/70" />
                  <span>{o}</span>
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}
    </div>
  );
}

function MetricTable({ title, strategies, metrics }: { title: string; strategies: CompStrategy[]; metrics: MetricRow[] }) {
  return (
    <section className="card overflow-hidden">
      <header className="flex items-center gap-2 border-b border-panel-border px-5 py-3">
        <TableIcon className="text-base text-accent" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink">{title}</h2>
        <span className="ml-auto text-[11px] text-ink-faint">green = highest · red = lowest (where directional)</span>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-panel text-xs uppercase tracking-wide text-ink-faint">
            <tr>
              <th className="px-3 py-2 font-medium">Metric</th>
              {strategies.map((s) => (
                <th key={s.key} className="px-3 py-2 text-right font-medium">
                  <span style={{ color: s.color }}>{s.letter}</span> <span className="text-ink-faint">{s.params}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-panel-border font-mono text-xs">
            {metrics.map((m) => (
              <tr key={m.key} className="hover:bg-panel/40">
                <td className="px-3 py-1.5 font-sans text-ink-muted">{m.label}</td>
                {m.values.map((v, i) => (
                  <td
                    key={i}
                    className={[
                      'px-3 py-1.5 text-right',
                      m.best === i ? 'bg-positive/15 font-semibold text-positive' : m.worst === i ? 'bg-negative/10 text-negative' : 'text-ink',
                    ].join(' ')}
                  >
                    {fmtCell(v, m.format)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DifferenceTable({ comparison }: { comparison: ReturnType<typeof buildComparison> }) {
  const { strategies, metrics } = comparison;
  const baseline = strategies[0]!;
  const rows = metrics.filter((m) => DIFF_METRIC_KEYS.includes(m.key));

  return (
    <section className="card overflow-hidden">
      <header className="flex flex-wrap items-center gap-2 border-b border-panel-border px-5 py-3">
        <TableIcon className="text-base text-accent" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink">Difference Analysis</h2>
        <span className="ml-auto text-[11px] text-ink-faint">
          vs baseline {baseline.letter} ({baseline.params}) — difference · % difference · relative
        </span>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-panel text-xs uppercase tracking-wide text-ink-faint">
            <tr>
              <th className="px-3 py-2 font-medium">Metric</th>
              {strategies.map((s) => (
                <th key={s.key} className="px-3 py-2 text-right font-medium">
                  <span style={{ color: s.color }}>{s.letter}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-panel-border font-mono text-xs">
            {rows.map((m) => {
              const base = m.values[0];
              return (
                <tr key={m.key} className="hover:bg-panel/40">
                  <td className="px-3 py-1.5 font-sans text-ink-muted">{m.label}</td>
                  {m.values.map((v, i) => {
                    if (i === 0) return <td key={i} className="px-3 py-1.5 text-right text-ink-faint">baseline</td>;
                    if (v === null || base === null || base === undefined) {
                      return <td key={i} className="px-3 py-1.5 text-right text-ink-faint">—</td>;
                    }
                    const diff = v - base;
                    const pct = Math.abs(base) > 1e-9 ? (diff / base) * 100 : null;
                    const rel = Math.abs(base) > 1e-9 ? v / base : null;
                    const flag = Math.abs(diff) < 1e-9 ? 'equal' : diff > 0 ? 'higher' : 'lower';
                    const tone = flag === 'higher' ? 'text-positive' : flag === 'lower' ? 'text-negative' : 'text-ink-faint';
                    return (
                      <td key={i} className={['px-3 py-1.5 text-right', tone].join(' ')}>
                        <div>{diff >= 0 ? '+' : ''}{fmtNumber(diff, 2)}</div>
                        <div className="text-[10px] opacity-80">
                          {pct !== null ? `${pct >= 0 ? '+' : ''}${fmtNumber(pct, 1)}%` : '—'}
                          {rel !== null ? ` · ${fmtNumber(rel, 2)}×` : ''}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function MatrixTable({
  title,
  rowLabels,
  strategies,
  cell,
}: {
  title: string;
  rowLabels: Array<{ key: string; label: string }>;
  strategies: CompStrategy[];
  cell: (rowKey: string, s: CompStrategy) => string;
}) {
  return (
    <div className="rounded-lg border border-panel-border">
      <div className="border-b border-panel-border px-3 py-2 text-xs font-semibold uppercase tracking-wide text-ink">{title}</div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="text-ink-faint">
            <tr>
              <th className="px-3 py-1.5 font-medium"> </th>
              {strategies.map((s) => (
                <th key={s.key} className="px-3 py-1.5 text-right font-medium" style={{ color: s.color }}>{s.letter}</th>
              ))}
            </tr>
          </thead>
          <tbody className="font-mono">
            {rowLabels.map((row) => (
              <tr key={row.key} className="border-t border-panel-border/60">
                <td className="px-3 py-1.5 font-sans text-ink-muted">{row.label}</td>
                {strategies.map((s) => (
                  <td key={s.key} className="px-3 py-1.5 text-right text-ink">{cell(row.key, s)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SessionComparison({ strategies }: { strategies: CompStrategy[] }) {
  const sessions = useMemo(() => {
    const set = new Set<string>();
    strategies.forEach((s) => s.dossier.sessions.forEach((ss) => set.add(ss.session)));
    return [...set].map((name) => ({ key: name, label: name }));
  }, [strategies]);

  const look = (s: CompStrategy, name: string) => s.dossier.sessions.find((x) => x.session === name);

  if (sessions.length === 0) return null;

  return (
    <section className="card p-5">
      <h2 className="stat-label mb-3">Session Comparison</h2>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MatrixTable title="Occurrences" rowLabels={sessions} strategies={strategies} cell={(k, s) => fmtInt(look(s, k)?.occurrences ?? 0)} />
        <MatrixTable title="Recovery %" rowLabels={sessions} strategies={strategies} cell={(k, s) => { const v = look(s, k); return v ? fmtPercent(v.recoveryPct) : '—'; }} />
        <MatrixTable title="Average Holding" rowLabels={sessions} strategies={strategies} cell={(k, s) => fmtDuration(look(s, k)?.avgHoldingSec ?? null)} />
        <MatrixTable title="SL Hit %" rowLabels={sessions} strategies={strategies} cell={(k, s) => { const v = look(s, k); return v ? fmtPercent(v.slHitPct) : '—'; }} />
      </div>
    </section>
  );
}

function MonthlyComparison({ strategies }: { strategies: CompStrategy[] }) {
  const months = useMemo(() => {
    const present = new Set<number>();
    strategies.forEach((s) => s.dossier.months.forEach((m) => { if (m.occurrences > 0) present.add(m.month); }));
    const order = [...present].sort((a, b) => a - b);
    const labelOf = (m: number) => strategies[0]!.dossier.months.find((x) => x.month === m)?.label ?? String(m);
    return order.map((m) => ({ key: String(m), label: labelOf(m) }));
  }, [strategies]);

  const look = (s: CompStrategy, monthKey: string) => s.dossier.months.find((x) => x.month === Number(monthKey));

  if (months.length === 0) return null;

  return (
    <section className="card p-5">
      <h2 className="stat-label mb-3">Monthly Comparison</h2>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MatrixTable title="Occurrences" rowLabels={months} strategies={strategies} cell={(k, s) => fmtInt(look(s, k)?.occurrences ?? 0)} />
        <MatrixTable title="Recovery %" rowLabels={months} strategies={strategies} cell={(k, s) => { const v = look(s, k); return v && v.occurrences > 0 ? fmtPercent(v.recoveryPct) : '—'; }} />
      </div>
    </section>
  );
}

function Banner() {
  return (
    <section className="card flex items-start gap-3 border-accent/30 bg-accent/5 p-4">
      <AlertIcon className="mt-0.5 text-base text-accent" />
      <p className="text-sm leading-relaxed text-ink-muted">
        Compare stored strategies side-by-side using their historical research
        results. All strategies are shown by default (a single strategy is compared
        against the repository baseline); use the filter to narrow the set. Everything
        is read from the Research Repository — no strategy is rerun, and nothing here
        is a recommendation or prediction.
      </p>
    </section>
  );
}
