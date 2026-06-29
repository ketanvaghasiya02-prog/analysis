/**
 * Stop Loss Optimizer results table (Phase 10A) — one row per tested SL,
 * sortable, with the full Research Engine result set per SL.
 */

import { useMemo, useState, type ReactNode } from 'react';
import type { SlOptimizerResult, SlOptimizerRow } from '@/utils/slOptimizer';
import { fmtDuration, fmtInt, fmtNumber, fmtPercent } from '@/utils/format';
import { TableIcon } from '@/components/common/icons';

type NumericKey =
  | 'stopLoss'
  | 'recoveredBeforeSl'
  | 'recoveredAfterSl'
  | 'slNotRecovered'
  | 'recoveryBeforeSlPct'
  | 'recoveryAfterSlPct'
  | 'recoveryIgnoringSlPct'
  | 'slHitPct'
  | 'avgRecoverySec'
  | 'medianRecoverySec'
  | 'avgMaxGap'
  | 'worstMaxGap'
  | 'p95MaxGap'
  | 'avgHoldingSec'
  | 'efficiency'
  | 'score';

interface Column {
  key: NumericKey | 'confidenceLabel';
  label: string;
  sortable: boolean;
  render: (r: SlOptimizerRow) => ReactNode;
  cellClass?: string;
}

function scoreTone(s: number): string {
  if (s >= 70) return 'text-positive';
  if (s >= 45) return 'text-warning';
  return 'text-negative';
}

const COLUMNS: Column[] = [
  { key: 'stopLoss', label: 'Stop Loss', sortable: true, render: (r) => fmtNumber(r.stopLoss, 2), cellClass: 'text-ink' },
  { key: 'recoveredBeforeSl', label: 'Rec. Before SL', sortable: true, render: (r) => fmtInt(r.recoveredBeforeSl) },
  { key: 'recoveredAfterSl', label: 'Rec. After SL', sortable: true, render: (r) => fmtInt(r.recoveredAfterSl) },
  { key: 'slNotRecovered', label: 'SL Not Recovered', sortable: true, render: (r) => fmtInt(r.slNotRecovered) },
  { key: 'recoveryBeforeSlPct', label: 'Rec. Before SL %', sortable: true, render: (r) => fmtPercent(r.recoveryBeforeSlPct), cellClass: 'text-positive' },
  { key: 'recoveryAfterSlPct', label: 'Rec. After SL %', sortable: true, render: (r) => fmtPercent(r.recoveryAfterSlPct), cellClass: 'text-warning' },
  { key: 'recoveryIgnoringSlPct', label: 'Rec. Ignoring SL %', sortable: true, render: (r) => fmtPercent(r.recoveryIgnoringSlPct), cellClass: 'text-accent' },
  { key: 'slHitPct', label: 'SL Hit %', sortable: true, render: (r) => fmtPercent(r.slHitPct), cellClass: 'text-negative' },
  { key: 'avgRecoverySec', label: 'Avg Recovery', sortable: true, render: (r) => fmtDuration(r.avgRecoverySec) },
  { key: 'medianRecoverySec', label: 'Median Recovery', sortable: true, render: (r) => fmtDuration(r.medianRecoverySec) },
  { key: 'avgMaxGap', label: 'Avg Max Gap', sortable: true, render: (r) => fmtNumber(r.avgMaxGap, 3) },
  { key: 'worstMaxGap', label: 'Worst Max Gap', sortable: true, render: (r) => fmtNumber(r.worstMaxGap, 3), cellClass: 'text-negative' },
  { key: 'p95MaxGap', label: 'P95 Max Gap', sortable: true, render: (r) => fmtNumber(r.p95MaxGap, 3) },
  { key: 'avgHoldingSec', label: 'Avg Holding', sortable: true, render: (r) => fmtDuration(r.avgHoldingSec) },
  { key: 'efficiency', label: 'Efficiency', sortable: true, render: (r) => fmtNumber(r.efficiency, 2) },
  { key: 'score', label: 'Score', sortable: true, render: (r) => <span className={scoreTone(r.score)}>{fmtNumber(r.score, 1)}</span> },
  { key: 'confidenceLabel', label: 'Confidence', sortable: false, render: (r) => r.confidenceLabel, cellClass: 'font-sans' },
];

export function SlOptimizerTable({ result }: { result: SlOptimizerResult }) {
  const [sortKey, setSortKey] = useState<NumericKey>('stopLoss');
  const [desc, setDesc] = useState(false);

  const balancedSl = result.balanced?.stopLoss ?? null;

  const sorted = useMemo(() => {
    const out = [...result.rows];
    out.sort((a, b) => {
      const av = (a[sortKey] as number | null) ?? -Infinity;
      const bv = (b[sortKey] as number | null) ?? -Infinity;
      return desc ? bv - av : av - bv;
    });
    return out;
  }, [result.rows, sortKey, desc]);

  const toggle = (k: NumericKey) => {
    if (k === sortKey) setDesc((d) => !d);
    else {
      setSortKey(k);
      setDesc(k !== 'stopLoss');
    }
  };

  return (
    <section className="card overflow-hidden">
      <header className="flex items-center gap-2 border-b border-panel-border px-5 py-3">
        <TableIcon className="text-base text-accent" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink">
          Stop Loss Results
        </h2>
        <span className="ml-auto text-xs text-ink-faint">
          {result.rows.length} SL levels{result.truncated ? ' (capped)' : ''}
        </span>
      </header>
      <div className="max-h-[32rem] overflow-auto">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 z-10 bg-panel text-xs uppercase tracking-wide text-ink-faint">
            <tr>
              {COLUMNS.map((c, idx) => (
                <th
                  key={c.key}
                  onClick={c.sortable ? () => toggle(c.key as NumericKey) : undefined}
                  className={[
                    'whitespace-nowrap px-3 py-2 font-medium',
                    idx === 0 ? 'text-left' : 'text-right',
                    c.sortable ? 'cursor-pointer select-none' : '',
                  ].join(' ')}
                >
                  {c.label}
                  {c.sortable && sortKey === c.key ? (
                    <span className="ml-1 text-ink-faint">{desc ? '▼' : '▲'}</span>
                  ) : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-panel-border font-mono text-xs">
            {sorted.map((r) => {
              const isBalanced = balancedSl !== null && Math.abs(r.stopLoss - balancedSl) < 1e-9;
              return (
                <tr
                  key={r.stopLoss}
                  className={
                    isBalanced
                      ? 'bg-accent/10 ring-1 ring-inset ring-accent/40'
                      : 'hover:bg-panel/50'
                  }
                >
                  {COLUMNS.map((c, idx) => (
                    <td
                      key={c.key}
                      className={[
                        'whitespace-nowrap px-3 py-1.5',
                        idx === 0 ? 'text-left' : 'text-right',
                        c.cellClass ?? 'text-ink-muted',
                      ].join(' ')}
                    >
                      {idx === 0 && isBalanced ? (
                        <>
                          {c.render(r)}
                          <span className="ml-1.5 rounded bg-accent/20 px-1 text-[10px] text-accent">balanced</span>
                        </>
                      ) : (
                        c.render(r)
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
            {result.rows.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length} className="px-3 py-6 text-center text-ink-faint">
                  No SL levels — check the range and that entry events exist.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <footer className="border-t border-panel-border px-5 py-2 text-[11px] text-ink-faint">
        Total positions at each SL:{' '}
        {result.rows[0] ? fmtInt(result.rows[0].totalPositions) : 0}. Every row is one
        Research Engine v1.0 call — no logic duplicated.
      </footer>
    </section>
  );
}
