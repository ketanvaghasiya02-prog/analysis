/**
 * Historical Strategy Finder — research results table (Phase 11B).
 *
 * Replaces the READY parameter table with live research results, updated after
 * every completed strategy. Read-only presentation — no ranking, scoring or
 * comparison.
 *
 * Paginated: the full result set lives in memory, but only the current page is
 * ever rendered into the DOM, so the table stays responsive with tens of
 * thousands of results. Status filtering is preserved and drives the pages.
 */

import { useMemo, useState } from 'react';
import type { ExecStatus, StrategyExecution } from '@/utils/strategyExecution';
import { fmtDuration, fmtInt, fmtNumber, fmtPercent } from '@/utils/format';
import { fmtExecMs } from '@/components/strategyfinder/StrategyExecutionPanel';
import { ChevronIcon, TableIcon } from '@/components/common/icons';

const STATUS_STYLE: Record<ExecStatus, string> = {
  READY: 'bg-ink-faint/15 text-ink-faint',
  RUNNING: 'bg-accent/20 text-accent',
  COMPLETED: 'bg-positive/20 text-positive',
  FAILED: 'bg-negative/20 text-negative',
  CACHED: 'bg-warning/20 text-warning',
};

const PAGE_SIZES = [50, 100, 250, 500] as const;
type PageSize = (typeof PAGE_SIZES)[number];

/** Page numbers to render (0-indexed), with 'gap' markers for ellipsis. */
function pageItems(current: number, count: number): Array<number | 'gap'> {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i);
  const keep = new Set<number>([0, count - 1]);
  for (let d = -1; d <= 1; d += 1) {
    const p = current + d;
    if (p >= 0 && p < count) keep.add(p);
  }
  const sorted = [...keep].sort((a, b) => a - b);
  const out: Array<number | 'gap'> = [];
  let prev = -1;
  for (const p of sorted) {
    if (prev >= 0 && p - prev > 1) out.push('gap');
    out.push(p);
    prev = p;
  }
  return out;
}

export function StrategyResultsTable({ executions }: { executions: StrategyExecution[] }) {
  const [statusFilter, setStatusFilter] = useState<'ALL' | ExecStatus>('ALL');
  const [pageSize, setPageSize] = useState<PageSize>(100);
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    if (statusFilter === 'ALL') return executions;
    return executions.filter((e) => e.status === statusFilter);
  }, [executions, statusFilter]);

  const total = filtered.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  // Clamp at render time so live updates / filter / page-size changes can never
  // strand the view on an out-of-range page (no setState-in-render needed).
  const current = Math.min(page, pageCount - 1);
  const start = current * pageSize;
  const end = Math.min(start + pageSize, total);
  const pageRows = filtered.slice(start, end);

  const goTo = (p: number) => setPage(Math.max(0, Math.min(p, pageCount - 1)));
  const changeFilter = (f: 'ALL' | ExecStatus) => {
    setStatusFilter(f);
    setPage(0);
  };
  const changePageSize = (s: PageSize) => {
    // Keep the first visible row in view when the page size changes.
    const firstRow = current * pageSize;
    setPageSize(s);
    setPage(Math.floor(firstRow / s));
  };

  return (
    <section className="card overflow-hidden">
      <header className="flex flex-wrap items-center gap-2 border-b border-panel-border px-5 py-3">
        <TableIcon className="text-base text-accent" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink">
          Research Results
        </h2>
        <span className="text-xs text-ink-faint">
          {total > 0
            ? `Showing ${fmtInt(start + 1)}–${fmtInt(end)} of ${fmtInt(total)}`
            : `${fmtInt(total)}`}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-3 text-xs">
          <label className="flex items-center gap-2">
            <span className="stat-label">Rows</span>
            <select
              value={pageSize}
              onChange={(e) => changePageSize(Number(e.target.value) as PageSize)}
              className="rounded-md border border-panel-border bg-panel px-2 py-1 text-ink focus:border-accent focus:outline-none"
            >
              {PAGE_SIZES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2">
            <span className="stat-label">Status</span>
            <select
              value={statusFilter}
              onChange={(e) => changeFilter(e.target.value as 'ALL' | ExecStatus)}
              className="rounded-md border border-panel-border bg-panel px-2 py-1 text-ink focus:border-accent focus:outline-none"
            >
              <option value="ALL">All</option>
              <option value="READY">Ready</option>
              <option value="RUNNING">Running</option>
              <option value="COMPLETED">Completed</option>
              <option value="CACHED">Cached</option>
              <option value="FAILED">Failed</option>
            </select>
          </label>
        </div>
      </header>
      <div className="max-h-[36rem] overflow-auto">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 z-10 bg-panel text-xs uppercase tracking-wide text-ink-faint">
            <tr>
              <th className="px-3 py-2 font-medium">ID</th>
              <th className="px-3 py-2 text-right font-medium">Entry</th>
              <th className="px-3 py-2 text-right font-medium">Recovery</th>
              <th className="px-3 py-2 text-right font-medium">Stop Loss</th>
              <th className="px-3 py-2 text-center font-medium">Status</th>
              <th className="px-3 py-2 text-right font-medium">Rec. Before %</th>
              <th className="px-3 py-2 text-right font-medium">Rec. After %</th>
              <th className="px-3 py-2 text-right font-medium">SL Hit %</th>
              <th className="px-3 py-2 text-right font-medium">Positions</th>
              <th className="px-3 py-2 text-right font-medium">Avg Recovery</th>
              <th className="px-3 py-2 text-right font-medium">Worst Gap</th>
              <th className="px-3 py-2 font-medium">Confidence</th>
              <th className="px-3 py-2 text-right font-medium">Exec Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-panel-border font-mono text-xs">
            {pageRows.map((e) => {
              const r = e.result;
              return (
                <tr key={e.id} className="hover:bg-panel/50">
                  <td className="px-3 py-1.5 text-ink-muted">{e.id}</td>
                  <td className="px-3 py-1.5 text-right text-ink">{fmtNumber(e.entryGap, 2)}</td>
                  <td className="px-3 py-1.5 text-right text-ink-muted">{fmtNumber(e.recoveryGap, 2)}</td>
                  <td className="px-3 py-1.5 text-right text-ink-muted">{fmtNumber(e.stopLoss, 2)}</td>
                  <td className="px-3 py-1.5 text-center">
                    <span className={['rounded px-1.5 py-0.5 text-[10px] font-semibold', STATUS_STYLE[e.status]].join(' ')}>
                      {e.status}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-right text-positive">{r ? fmtPercent(r.recoveryBeforeSlPct) : '—'}</td>
                  <td className="px-3 py-1.5 text-right text-warning">{r ? fmtPercent(r.recoveryAfterSlPct) : '—'}</td>
                  <td className="px-3 py-1.5 text-right text-negative">{r ? fmtPercent(r.slHitPct) : '—'}</td>
                  <td className="px-3 py-1.5 text-right text-ink-muted">{r ? fmtInt(r.totalPositions) : '—'}</td>
                  <td className="px-3 py-1.5 text-right text-ink-muted">{r ? fmtDuration(r.avgRecoverySec) : '—'}</td>
                  <td className="px-3 py-1.5 text-right text-negative">{r ? fmtNumber(r.worstMaxGap, 3) : '—'}</td>
                  <td className="px-3 py-1.5 font-sans text-ink-muted">
                    {r ? r.confidenceLabel : e.status === 'FAILED' ? <span className="text-negative">{e.error ?? 'error'}</span> : '—'}
                  </td>
                  <td className="px-3 py-1.5 text-right text-ink-faint">{r ? fmtExecMs(r.executionMs) : '—'}</td>
                </tr>
              );
            })}
            {total === 0 && (
              <tr>
                <td colSpan={13} className="px-3 py-6 text-center text-ink-faint">
                  {executions.length === 0
                    ? 'No READY strategies to execute — generate valid combinations first.'
                    : 'No results match the selected status filter.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > 0 && (
        <nav className="flex flex-wrap items-center gap-2 border-t border-panel-border px-5 py-2.5 text-xs">
          <span className="text-ink-faint">
            Page {fmtInt(current + 1)} of {fmtInt(pageCount)}
          </span>
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={() => goTo(current - 1)}
              disabled={current === 0}
              className="flex items-center gap-1 rounded-md border border-panel-border bg-panel px-2 py-1 font-medium text-ink-muted transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-panel-border disabled:hover:text-ink-muted"
            >
              <ChevronIcon className="rotate-90 text-sm" /> Prev
            </button>
            {pageItems(current, pageCount).map((p, i) =>
              p === 'gap' ? (
                <span key={`gap-${i}`} className="px-1 text-ink-faint">…</span>
              ) : (
                <button
                  key={p}
                  type="button"
                  onClick={() => goTo(p)}
                  className={[
                    'min-w-[1.9rem] rounded-md border px-2 py-1 text-center font-medium transition-colors',
                    p === current
                      ? 'border-accent/50 bg-accent/15 text-accent'
                      : 'border-panel-border bg-panel text-ink-muted hover:border-accent hover:text-accent',
                  ].join(' ')}
                >
                  {fmtInt(p + 1)}
                </button>
              ),
            )}
            <button
              type="button"
              onClick={() => goTo(current + 1)}
              disabled={current >= pageCount - 1}
              className="flex items-center gap-1 rounded-md border border-panel-border bg-panel px-2 py-1 font-medium text-ink-muted transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-panel-border disabled:hover:text-ink-muted"
            >
              Next <ChevronIcon className="-rotate-90 text-sm" />
            </button>
          </div>
        </nav>
      )}

      <footer className="border-t border-panel-border px-5 py-2 text-[11px] text-ink-faint">
        Each row is one Research Engine v1.0 execution (or a cached result). Live
        results only — no ranking, score or recommendation. Only the current page is
        rendered, so the table stays responsive with tens of thousands of results.
      </footer>
    </section>
  );
}
