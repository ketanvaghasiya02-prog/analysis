/**
 * Research Repository (Phase 11C) — searchable historical research store.
 *
 * Reads the centralized repository of COMPLETED strategy results and provides
 * search, filtering, sorting, a summary and exports. It never reruns the
 * Research Engine, never ranks, scores or recommends — it only displays stored
 * results so future modules have a single source of truth.
 */

import { useMemo, useState } from 'react';
import { useRepository } from '@/context/RepositoryContext';
import {
  applyFilters,
  buildRepositoryIndexes,
  NUMERIC_FILTER_FIELDS,
  repositoryBackup,
  repositoryCsv,
  repositoryJson,
  repositorySummary,
  sortRecords,
  SORT_OPTIONS,
  type FilterField,
  type FilterOp,
  type RepositoryFilter,
  type SortKey,
} from '@/utils/researchRepository';
import { CONFIDENCE_LABELS, type ConfidenceLevel } from '@/utils/scenario';
import { downloadExport } from '@/utils/reports';
import { StatCard } from '@/components/overview/StatCard';
import { fmtDuration, fmtInt, fmtNumber, fmtPercent } from '@/utils/format';
import { fmtExecMs } from '@/components/strategyfinder/StrategyExecutionPanel';
import { AlertIcon, DownloadIcon, LayersIcon, TableIcon, TrashIcon } from '@/components/common/icons';

const CONFIDENCE_LEVELS: ConfidenceLevel[] = ['VERY_LOW', 'LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH'];
const ROW_CAP = 1000;

function fmtTimestamp(ms: number | null): string {
  if (ms === null) return '—';
  return new Date(ms).toLocaleString();
}

const OP_LABELS: Record<FilterOp, string> = {
  gt: 'Greater than',
  lt: 'Less than',
  eq: 'Equal',
  between: 'Between',
};

export function RepositoryView() {
  const { records, createdAt, updatedAt, clear } = useRepository();

  const [filters, setFilters] = useState<RepositoryFilter[]>([]);
  const [nextId, setNextId] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>('recoveryBeforeSlPct');
  const [desc, setDesc] = useState(true);

  const summary = useMemo(() => repositorySummary(records), [records]);
  const indexes = useMemo(() => buildRepositoryIndexes(records), [records]);

  const view = useMemo(() => {
    const f = applyFilters(records, filters);
    return sortRecords(f, sortKey, desc);
  }, [records, filters, sortKey, desc]);

  const shown = view.slice(0, ROW_CAP);
  const stamp = () => new Date().toISOString();

  const addFilter = () => {
    setFilters((prev) => [
      ...prev,
      { id: nextId, field: 'recoveryBeforeSlPct', op: 'gt', value: 0, value2: 0, confidence: 'MEDIUM' },
    ]);
    setNextId((n) => n + 1);
  };
  const updateFilter = (id: number, patch: Partial<RepositoryFilter>) =>
    setFilters((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  const removeFilter = (id: number) => setFilters((prev) => prev.filter((f) => f.id !== id));

  if (records.length === 0) {
    return (
      <div className="space-y-5">
        <RepositoryBanner />
        <section className="card flex flex-col items-center gap-3 p-10 text-center">
          <LayersIcon className="text-3xl text-ink-faint" />
          <h2 className="text-base font-semibold text-ink">Repository is empty</h2>
          <p className="max-w-md text-sm text-ink-muted">
            Run the Historical Strategy Finder to execute strategies. Every
            COMPLETED strategy is stored here automatically and stays available
            across the app — no strategy is ever rerun.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <RepositoryBanner />

      {/* Summary */}
      <section>
        <h2 className="stat-label mb-2">Repository Summary</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-7">
          <StatCard label="Repository Size" value={fmtInt(summary.size)} tooltip="Stored research records (de-duplicated)." />
          <StatCard label="Completed Strategies" tone="positive" value={fmtInt(summary.completed)} />
          <StatCard label="Unique Entries" value={fmtInt(summary.uniqueEntries)} />
          <StatCard label="Unique Recoveries" value={fmtInt(summary.uniqueRecoveries)} />
          <StatCard label="Unique Stop Losses" value={fmtInt(summary.uniqueStopLosses)} />
          <StatCard label="Repository Created" value={fmtTimestamp(createdAt)} />
          <StatCard label="Repository Updated" value={fmtTimestamp(updatedAt)} />
        </div>
      </section>

      {/* Controls */}
      <section className="card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="stat-label">Search &amp; Filter</span>
          <button type="button" onClick={addFilter} className="btn px-2.5 py-1 text-xs">
            + Add filter
          </button>
          {filters.length > 0 && (
            <button type="button" onClick={() => setFilters([])} className="btn px-2.5 py-1 text-xs">
              Clear filters
            </button>
          )}

          <div className="ml-auto flex items-center gap-2 text-xs">
            <span className="stat-label">Sort by</span>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="rounded-md border border-panel-border bg-panel px-2 py-1 text-ink focus:border-accent focus:outline-none"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
            <button type="button" onClick={() => setDesc((d) => !d)} className="btn px-2 py-1" title="Toggle sort direction">
              {desc ? '▼ Desc' : '▲ Asc'}
            </button>
          </div>
        </div>

        {filters.length > 0 && (
          <div className="mt-3 space-y-2">
            {filters.map((f) => (
              <div key={f.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-panel-border bg-panel p-2 text-xs">
                <select
                  value={f.field}
                  onChange={(e) => updateFilter(f.id, { field: e.target.value as FilterField })}
                  className="rounded-md border border-panel-border bg-panel-raised px-2 py-1 text-ink focus:border-accent focus:outline-none"
                >
                  {NUMERIC_FILTER_FIELDS.map((nf) => (
                    <option key={nf.field} value={nf.field}>
                      {nf.label}
                    </option>
                  ))}
                  <option value="confidence">Confidence</option>
                </select>

                {f.field === 'confidence' ? (
                  <>
                    <span className="text-ink-faint">=</span>
                    <select
                      value={f.confidence}
                      onChange={(e) => updateFilter(f.id, { confidence: e.target.value as ConfidenceLevel })}
                      className="rounded-md border border-panel-border bg-panel-raised px-2 py-1 text-ink focus:border-accent focus:outline-none"
                    >
                      {CONFIDENCE_LEVELS.map((c) => (
                        <option key={c} value={c}>
                          {CONFIDENCE_LABELS[c]}
                        </option>
                      ))}
                    </select>
                  </>
                ) : (
                  <>
                    <select
                      value={f.op}
                      onChange={(e) => updateFilter(f.id, { op: e.target.value as FilterOp })}
                      className="rounded-md border border-panel-border bg-panel-raised px-2 py-1 text-ink focus:border-accent focus:outline-none"
                    >
                      {(Object.keys(OP_LABELS) as FilterOp[]).map((op) => (
                        <option key={op} value={op}>
                          {OP_LABELS[op]}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      value={f.value}
                      onChange={(e) => updateFilter(f.id, { value: Number(e.target.value) })}
                      className="w-24 rounded-md border border-panel-border bg-panel-raised px-2 py-1 text-ink focus:border-accent focus:outline-none"
                    />
                    {f.op === 'between' && (
                      <>
                        <span className="text-ink-faint">and</span>
                        <input
                          type="number"
                          value={f.value2}
                          onChange={(e) => updateFilter(f.id, { value2: Number(e.target.value) })}
                          className="w-24 rounded-md border border-panel-border bg-panel-raised px-2 py-1 text-ink focus:border-accent focus:outline-none"
                        />
                      </>
                    )}
                  </>
                )}

                <button type="button" onClick={() => removeFilter(f.id)} className="btn ml-auto px-2 py-1" title="Remove filter">
                  <TrashIcon className="text-sm" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => downloadExport(repositoryCsv(view))} className="btn flex items-center gap-1.5 px-3 py-1.5 text-sm">
            <DownloadIcon className="text-sm" /> Export CSV
          </button>
          <button type="button" onClick={() => downloadExport(repositoryJson(view, stamp()))} className="btn flex items-center gap-1.5 px-3 py-1.5 text-sm">
            <DownloadIcon className="text-sm" /> Export JSON
          </button>
          <button type="button" onClick={() => downloadExport(repositoryBackup(records, createdAt, updatedAt, stamp()))} className="btn flex items-center gap-1.5 px-3 py-1.5 text-sm">
            <DownloadIcon className="text-sm" /> Repository Backup
          </button>
          <button type="button" onClick={clear} className="btn ml-auto flex items-center gap-1.5 px-3 py-1.5 text-sm">
            <TrashIcon className="text-sm" /> Clear Repository
          </button>
        </div>
      </section>

      {/* Table */}
      <section className="card overflow-hidden">
        <header className="flex flex-wrap items-center gap-2 border-b border-panel-border px-5 py-3">
          <TableIcon className="text-base text-accent" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink">
            Stored Research Records
          </h2>
          <span className="text-xs text-ink-faint">
            {fmtInt(view.length)} of {fmtInt(records.length)}
            {view.length > shown.length ? ` (showing first ${fmtInt(shown.length)})` : ''}
          </span>
          <span className="ml-auto text-[11px] text-ink-faint">
            {fmtInt(indexes.byConfidence.size)} confidence buckets indexed
          </span>
        </header>
        <div className="max-h-[36rem] overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 z-10 bg-panel text-xs uppercase tracking-wide text-ink-faint">
              <tr>
                <th className="px-3 py-2 font-medium">ID</th>
                <th className="px-3 py-2 text-right font-medium">Entry</th>
                <th className="px-3 py-2 text-right font-medium">Recovery</th>
                <th className="px-3 py-2 text-right font-medium">Stop Loss</th>
                <th className="px-3 py-2 text-right font-medium">Rec. Before %</th>
                <th className="px-3 py-2 text-right font-medium">Rec. After %</th>
                <th className="px-3 py-2 text-right font-medium">Rec. Ignoring %</th>
                <th className="px-3 py-2 text-right font-medium">SL Hit %</th>
                <th className="px-3 py-2 text-right font-medium">Positions</th>
                <th className="px-3 py-2 text-right font-medium">Trades</th>
                <th className="px-3 py-2 text-right font-medium">Avg Recovery</th>
                <th className="px-3 py-2 text-right font-medium">Median Recovery</th>
                <th className="px-3 py-2 text-right font-medium">Avg Max Gap</th>
                <th className="px-3 py-2 text-right font-medium">Worst Gap</th>
                <th className="px-3 py-2 text-right font-medium">P95</th>
                <th className="px-3 py-2 text-right font-medium">P99</th>
                <th className="px-3 py-2 text-right font-medium">Avg Holding</th>
                <th className="px-3 py-2 font-medium">Confidence</th>
                <th className="px-3 py-2 text-right font-medium">Exec Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-panel-border font-mono text-xs">
              {shown.map((r) => (
                <tr key={r.key} className="hover:bg-panel/50">
                  <td className="px-3 py-1.5 text-ink-muted">{r.id}</td>
                  <td className="px-3 py-1.5 text-right text-ink">{fmtNumber(r.entryGap, 2)}</td>
                  <td className="px-3 py-1.5 text-right text-ink-muted">{fmtNumber(r.recoveryGap, 2)}</td>
                  <td className="px-3 py-1.5 text-right text-ink-muted">{fmtNumber(r.stopLoss, 2)}</td>
                  <td className="px-3 py-1.5 text-right text-positive">{fmtPercent(r.recoveryBeforeSlPct)}</td>
                  <td className="px-3 py-1.5 text-right text-warning">{fmtPercent(r.recoveryAfterSlPct)}</td>
                  <td className="px-3 py-1.5 text-right text-accent">{fmtPercent(r.recoveryIgnoringSlPct)}</td>
                  <td className="px-3 py-1.5 text-right text-negative">{fmtPercent(r.slHitPct)}</td>
                  <td className="px-3 py-1.5 text-right text-ink-muted">{fmtInt(r.totalPositions)}</td>
                  <td className="px-3 py-1.5 text-right text-ink-muted">{fmtInt(r.historicalTrades)}</td>
                  <td className="px-3 py-1.5 text-right text-ink-muted">{fmtDuration(r.avgRecoverySec)}</td>
                  <td className="px-3 py-1.5 text-right text-ink-muted">{fmtDuration(r.medianRecoverySec)}</td>
                  <td className="px-3 py-1.5 text-right text-ink-muted">{fmtNumber(r.avgMaxGap, 3)}</td>
                  <td className="px-3 py-1.5 text-right text-negative">{fmtNumber(r.worstMaxGap, 3)}</td>
                  <td className="px-3 py-1.5 text-right text-ink-muted">{fmtNumber(r.p95MaxGap, 3)}</td>
                  <td className="px-3 py-1.5 text-right text-ink-muted">{fmtNumber(r.p99MaxGap, 3)}</td>
                  <td className="px-3 py-1.5 text-right text-ink-muted">{fmtDuration(r.avgHoldingSec)}</td>
                  <td className="px-3 py-1.5 font-sans text-ink-muted">{r.confidenceLabel}</td>
                  <td className="px-3 py-1.5 text-right text-ink-faint">{fmtExecMs(r.executionMs)}</td>
                </tr>
              ))}
              {view.length === 0 && (
                <tr>
                  <td colSpan={19} className="px-3 py-6 text-center text-ink-faint">
                    No records match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <footer className="border-t border-panel-border px-5 py-2 text-[11px] text-ink-faint">
          Stored Research Engine v1.0 results only. No strategy is rerun, ranked
          or scored — this is the shared source of truth for future modules.
        </footer>
      </section>
    </div>
  );
}

function RepositoryBanner() {
  return (
    <section className="card flex items-start gap-3 border-accent/30 bg-accent/5 p-4">
      <AlertIcon className="mt-0.5 text-base text-accent" />
      <p className="text-sm leading-relaxed text-ink-muted">
        The Research Repository is the centralized store of every COMPLETED
        strategy. Results are saved automatically from the Historical Strategy
        Finder and de-duplicated, so future modules read from here instead of
        rerunning the Research Engine. Storage only — no ranking, scoring or
        recommendations.
      </p>
    </section>
  );
}
