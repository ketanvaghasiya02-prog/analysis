/**
 * Stop Loss Intelligence — analysis table (Phase 10C, additive).
 *
 * A dedicated, sortable table for the intelligence metrics derived from the
 * already-computed optimizer results: Recovery Gain, Additional Risk,
 * Efficiency, Plateau and Balanced Zone. Rows are auto-highlighted. The frozen
 * Phase 10B results table is left untouched. Nothing is recalculated here.
 */

import { useMemo, useState, type ReactNode } from 'react';
import type { SlIntelligence, SlIntelligenceRow } from '@/utils/slIntelligence';
import { fmtNumber, fmtPercent } from '@/utils/format';
import { TableIcon } from '@/components/common/icons';
import { InfoTip } from '@/components/common/InfoTip';
import { INTEL_TOOLTIPS } from '@/components/sloptimizer/metrics';

type SortKey =
  | 'stopLoss'
  | 'recoveryBeforeSlPct'
  | 'recoveryGain'
  | 'riskIncrease'
  | 'efficiency';

interface Column {
  key: SortKey | 'plateau' | 'balancedZone';
  label: string;
  sortable: boolean;
  tooltip?: string;
  align: 'left' | 'right' | 'center';
  render: (r: SlIntelligenceRow) => ReactNode;
}

const COLUMNS: Column[] = [
  {
    key: 'stopLoss',
    label: 'Stop Loss',
    sortable: true,
    align: 'left',
    render: (r) => fmtNumber(r.stopLoss, 2),
  },
  {
    key: 'recoveryBeforeSlPct',
    label: 'Recovery %',
    sortable: true,
    align: 'right',
    render: (r) => <span className="text-positive">{fmtPercent(r.recoveryBeforeSlPct)}</span>,
  },
  {
    key: 'recoveryGain',
    label: 'Recovery Gain',
    sortable: true,
    tooltip: INTEL_TOOLTIPS.recoveryGain,
    align: 'right',
    render: (r) => (
      <span className={r.recoveryGain > 0.05 ? 'text-positive' : 'text-ink-faint'}>
        {r.recoveryGain >= 0 ? '+' : ''}
        {fmtNumber(r.recoveryGain, 1)}%
      </span>
    ),
  },
  {
    key: 'riskIncrease',
    label: 'Additional Risk',
    sortable: true,
    tooltip: INTEL_TOOLTIPS.riskIncrease,
    align: 'right',
    render: (r) => `+${fmtNumber(r.riskIncrease, 2)}`,
  },
  {
    key: 'efficiency',
    label: 'Efficiency',
    sortable: true,
    tooltip: INTEL_TOOLTIPS.efficiency,
    align: 'right',
    render: (r) => fmtNumber(r.efficiency, 2),
  },
  {
    key: 'plateau',
    label: 'Plateau',
    sortable: false,
    tooltip: INTEL_TOOLTIPS.plateau,
    align: 'center',
    render: (r) =>
      r.inPlateau ? (
        <span className="rounded bg-sky-500/20 px-1.5 text-[10px] text-sky-300">plateau</span>
      ) : (
        <span className="text-ink-faint">—</span>
      ),
  },
  {
    key: 'balancedZone',
    label: 'Balanced Zone',
    sortable: false,
    tooltip: INTEL_TOOLTIPS.balancedZone,
    align: 'center',
    render: (r) =>
      r.inBalancedZone ? (
        <span className="rounded bg-positive/20 px-1.5 text-[10px] text-positive">in zone</span>
      ) : (
        <span className="text-ink-faint">—</span>
      ),
  },
];

type HighlightKind = 'balanced' | 'highestEfficiency' | 'highestRecovery' | 'plateau';

const HIGHLIGHT_STYLE: Record<HighlightKind, { row: string; chip: string; label: string }> = {
  balanced: { row: 'bg-positive/10', chip: 'bg-positive/25 text-positive', label: 'Balanced' },
  highestEfficiency: { row: 'bg-purple-500/10', chip: 'bg-purple-500/25 text-purple-300', label: 'Highest efficiency' },
  highestRecovery: { row: 'bg-amber-400/10', chip: 'bg-amber-400/25 text-amber-300', label: 'Highest recovery' },
  plateau: { row: 'bg-sky-500/10', chip: 'bg-sky-500/25 text-sky-300', label: 'Plateau zone' },
};

/** Resolves a row to its single highlight (specific markers beat the zone). */
function highlightFor(r: SlIntelligenceRow): HighlightKind | null {
  if (r.isBalanced) return 'balanced';
  if (r.isHighestEfficiency) return 'highestEfficiency';
  if (r.isHighestRecovery) return 'highestRecovery';
  if (r.inPlateau) return 'plateau';
  return null;
}

export function SlIntelligenceTable({ intel }: { intel: SlIntelligence }) {
  const [sortKey, setSortKey] = useState<SortKey>('stopLoss');
  const [desc, setDesc] = useState(false);

  const sorted = useMemo(() => {
    const out = [...intel.rows];
    out.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      return desc ? bv - av : av - bv;
    });
    return out;
  }, [intel.rows, sortKey, desc]);

  const toggle = (k: SortKey) => {
    if (k === sortKey) setDesc((d) => !d);
    else {
      setSortKey(k);
      setDesc(k !== 'stopLoss');
    }
  };

  return (
    <section className="card overflow-hidden">
      <header className="flex flex-wrap items-center gap-2 border-b border-panel-border px-5 py-3">
        <TableIcon className="text-base text-accent" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink">
          Intelligence Table
        </h2>
        <span className="text-xs text-ink-faint">{intel.rows.length} SL levels</span>
        <div className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-faint">
          {(Object.keys(HIGHLIGHT_STYLE) as HighlightKind[]).map((k) => (
            <span key={k} className="inline-flex items-center gap-1.5">
              <span className={['h-2.5 w-2.5 rounded-sm', HIGHLIGHT_STYLE[k].chip].join(' ')} />
              {HIGHLIGHT_STYLE[k].label}
            </span>
          ))}
        </div>
      </header>
      <div className="max-h-[32rem] overflow-auto">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 z-10 bg-panel text-xs uppercase tracking-wide text-ink-faint">
            <tr>
              {COLUMNS.map((c) => (
                <th
                  key={c.key}
                  onClick={c.sortable ? () => toggle(c.key as SortKey) : undefined}
                  className={[
                    'whitespace-nowrap px-3 py-2 font-medium',
                    c.align === 'left' ? 'text-left' : c.align === 'center' ? 'text-center' : 'text-right',
                    c.sortable ? 'cursor-pointer select-none' : '',
                  ].join(' ')}
                >
                  <span className="inline-flex items-center gap-0.5">
                    {c.label}
                    {c.tooltip ? <InfoTip text={c.tooltip} /> : null}
                    {c.sortable && sortKey === c.key ? (
                      <span className="text-ink-faint">{desc ? '▼' : '▲'}</span>
                    ) : null}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-panel-border font-mono text-xs">
            {sorted.map((r) => {
              const hl = highlightFor(r);
              return (
                <tr
                  key={r.stopLoss}
                  className={['transition-colors', hl ? HIGHLIGHT_STYLE[hl].row : 'hover:bg-panel/50'].join(' ')}
                >
                  {COLUMNS.map((c, idx) => (
                    <td
                      key={c.key}
                      className={[
                        'whitespace-nowrap px-3 py-1.5',
                        c.align === 'left' ? 'text-left' : c.align === 'center' ? 'text-center' : 'text-right',
                        c.align === 'left' ? 'text-ink' : 'text-ink-muted',
                      ].join(' ')}
                    >
                      {idx === 0 && hl ? (
                        <span className="inline-flex items-center gap-1.5">
                          {c.render(r)}
                          <span className={['rounded px-1 text-[10px]', HIGHLIGHT_STYLE[hl].chip].join(' ')}>
                            {HIGHLIGHT_STYLE[hl].label}
                          </span>
                        </span>
                      ) : (
                        c.render(r)
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
            {intel.rows.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length} className="px-3 py-6 text-center text-ink-faint">
                  No SL levels to analyze.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <footer className="border-t border-panel-border px-5 py-2 text-[11px] text-ink-faint">
        Recovery Gain, Additional Risk and Efficiency come straight from the
        frozen optimizer; Plateau and Balanced Zone are historical observations
        derived from them. Descriptive only — never a recommendation.
      </footer>
    </section>
  );
}
