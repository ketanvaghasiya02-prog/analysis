/**
 * Stop Loss Optimizer results table (sortable).
 */

import { useMemo, useState } from 'react';
import type { SlOptimizerResult, SlOptimizerRow } from '@/utils/slOptimizer';
import { fmtDuration, fmtInt, fmtNumber, fmtPercent } from '@/utils/format';
import { TableIcon } from '@/components/common/icons';

type SortKey =
  | 'stopLoss'
  | 'recoveryBeforeSlPct'
  | 'recoveryAfterSlPct'
  | 'recoveryIgnoringSlPct'
  | 'slHitPct'
  | 'avgRecoverySec'
  | 'avgMaxGap'
  | 'efficiency'
  | 'score';

function scoreTone(s: number): string {
  if (s >= 70) return 'text-positive';
  if (s >= 45) return 'text-warning';
  return 'text-negative';
}

export function SlOptimizerTable({ result }: { result: SlOptimizerResult }) {
  const [sortKey, setSortKey] = useState<SortKey>('stopLoss');
  const [desc, setDesc] = useState(false);

  const highlights = useMemo(
    () =>
      new Map<number, string>(
        [
          result.balanced ? [result.balanced.stopLoss, 'balanced'] as const : null,
          result.maxSuccess ? [result.maxSuccess.stopLoss, 'max'] as const : null,
          result.highestScore ? [result.highestScore.stopLoss, 'score'] as const : null,
        ].filter(Boolean) as Array<readonly [number, string]>,
      ),
    [result],
  );

  const sorted = useMemo(() => {
    const out = [...result.rows];
    out.sort((a, b) => {
      const av = (a[sortKey] as number | null) ?? -Infinity;
      const bv = (b[sortKey] as number | null) ?? -Infinity;
      return desc ? bv - av : av - bv;
    });
    return out;
  }, [result.rows, sortKey, desc]);

  const toggle = (k: SortKey) => {
    if (k === sortKey) setDesc((d) => !d);
    else {
      setSortKey(k);
      setDesc(k !== 'stopLoss');
    }
  };

  const Th = ({ k, label }: { k: SortKey; label: string }) => (
    <th
      onClick={() => toggle(k)}
      className="cursor-pointer select-none whitespace-nowrap px-3 py-2 text-right font-medium first:text-left"
    >
      {label}
      {sortKey === k ? <span className="ml-1 text-ink-faint">{desc ? '▼' : '▲'}</span> : null}
    </th>
  );

  const rowClass = (r: SlOptimizerRow): string => {
    const h = highlights.get(r.stopLoss);
    if (h === 'balanced') return 'bg-accent/10 ring-1 ring-inset ring-accent/40';
    if (h === 'max') return 'bg-positive/5';
    return 'hover:bg-panel/50';
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
              <Th k="stopLoss" label="Stop Loss" />
              <Th k="recoveryBeforeSlPct" label="Rec. Before SL %" />
              <Th k="recoveryAfterSlPct" label="Rec. After SL %" />
              <Th k="recoveryIgnoringSlPct" label="Rec. Ignoring SL %" />
              <Th k="slHitPct" label="SL Hit %" />
              <Th k="avgRecoverySec" label="Avg Recovery" />
              <Th k="avgMaxGap" label="Avg Max Gap" />
              <Th k="efficiency" label="Efficiency" />
              <Th k="score" label="Score" />
            </tr>
          </thead>
          <tbody className="divide-y divide-panel-border font-mono text-xs">
            {sorted.map((r) => (
              <tr key={r.stopLoss} className={['transition-colors', rowClass(r)].join(' ')}>
                <td className="px-3 py-1.5 text-ink">
                  {fmtNumber(r.stopLoss, 2)}
                  {highlights.get(r.stopLoss) === 'balanced' && (
                    <span className="ml-1.5 rounded bg-accent/20 px-1 text-[10px] text-accent">balanced</span>
                  )}
                </td>
                <td className="px-3 py-1.5 text-right text-positive">{fmtPercent(r.recoveryBeforeSlPct)}</td>
                <td className="px-3 py-1.5 text-right text-warning">{fmtPercent(r.recoveryAfterSlPct)}</td>
                <td className="px-3 py-1.5 text-right text-accent">{fmtPercent(r.recoveryIgnoringSlPct)}</td>
                <td className="px-3 py-1.5 text-right text-negative">{fmtPercent(r.slHitPct)}</td>
                <td className="px-3 py-1.5 text-right text-ink-muted">{fmtDuration(r.avgRecoverySec)}</td>
                <td className="px-3 py-1.5 text-right text-ink-muted">{fmtNumber(r.avgMaxGap, 3)}</td>
                <td className="px-3 py-1.5 text-right text-ink-muted">{fmtNumber(r.efficiency, 2)}</td>
                <td className={['px-3 py-1.5 text-right font-semibold', scoreTone(r.score)].join(' ')}>
                  {fmtNumber(r.score, 1)}
                </td>
              </tr>
            ))}
            {result.rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-ink-faint">
                  No SL levels — check the range and that entry events exist.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <footer className="border-t border-panel-border px-5 py-2 text-[11px] text-ink-faint">
        Positions shown are from the Research Engine. Total positions at each SL:{' '}
        {result.rows[0] ? fmtInt(result.rows[0].totalPositions) : 0}.
      </footer>
    </section>
  );
}
