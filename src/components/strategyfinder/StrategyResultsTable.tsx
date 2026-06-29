/**
 * Historical Strategy Finder — research results table (Phase 11B).
 *
 * Replaces the READY parameter table with live research results, updated after
 * every completed strategy. Read-only presentation — no ranking, scoring or
 * comparison.
 */

import { useMemo, useState } from 'react';
import type { ExecStatus, StrategyExecution } from '@/utils/strategyExecution';
import { fmtDuration, fmtInt, fmtNumber, fmtPercent } from '@/utils/format';
import { fmtExecMs } from '@/components/strategyfinder/StrategyExecutionPanel';
import { TableIcon } from '@/components/common/icons';

const STATUS_STYLE: Record<ExecStatus, string> = {
  READY: 'bg-ink-faint/15 text-ink-faint',
  RUNNING: 'bg-accent/20 text-accent',
  COMPLETED: 'bg-positive/20 text-positive',
  FAILED: 'bg-negative/20 text-negative',
  CACHED: 'bg-warning/20 text-warning',
};

const ROW_RENDER_CAP = 500;

export function StrategyResultsTable({ executions }: { executions: StrategyExecution[] }) {
  const [statusFilter, setStatusFilter] = useState<'ALL' | ExecStatus>('ALL');

  const filtered = useMemo(() => {
    if (statusFilter === 'ALL') return executions;
    return executions.filter((e) => e.status === statusFilter);
  }, [executions, statusFilter]);

  const shown = filtered.slice(0, ROW_RENDER_CAP);

  return (
    <section className="card overflow-hidden">
      <header className="flex flex-wrap items-center gap-2 border-b border-panel-border px-5 py-3">
        <TableIcon className="text-base text-accent" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink">
          Research Results
        </h2>
        <span className="text-xs text-ink-faint">
          {fmtInt(filtered.length)}
          {filtered.length > shown.length ? ` (showing first ${fmtInt(shown.length)})` : ''}
        </span>
        <label className="ml-auto flex items-center gap-2 text-xs">
          <span className="stat-label">Status</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'ALL' | ExecStatus)}
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
            {shown.map((e) => {
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
            {filtered.length === 0 && (
              <tr>
                <td colSpan={13} className="px-3 py-6 text-center text-ink-faint">
                  No READY strategies to execute — generate valid combinations first.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <footer className="border-t border-panel-border px-5 py-2 text-[11px] text-ink-faint">
        Each row is one Research Engine v1.0 execution (or a cached result). Live
        results only — no ranking, score or recommendation.
      </footer>
    </section>
  );
}
