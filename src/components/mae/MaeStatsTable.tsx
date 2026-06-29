/**
 * Max-gap distribution table for a group of events (recovered or failed).
 */

import type { MaeStats } from '@/utils/mae';
import { fmtInt, fmtNumber } from '@/utils/format';
import { TableIcon } from '@/components/common/icons';

interface MaeStatsTableProps {
  title: string;
  stats: MaeStats;
  /** Accent colour class for the title dot. */
  accent: string;
}

const DECIMALS = 3;

export function MaeStatsTable({ title, stats, accent }: MaeStatsTableProps) {
  const rows: Array<{ label: string; value: string; strong?: boolean }> = [
    { label: 'Events', value: fmtInt(stats.count) },
    { label: 'Average Max Gap', value: fmtNumber(stats.avg, DECIMALS) },
    { label: 'Median Max Gap', value: fmtNumber(stats.median, DECIMALS) },
    { label: 'P75 Max Gap', value: fmtNumber(stats.p75, DECIMALS) },
    { label: 'P90 Max Gap', value: fmtNumber(stats.p90, DECIMALS) },
    { label: 'P95 Max Gap', value: fmtNumber(stats.p95, DECIMALS) },
    { label: 'P99 Max Gap', value: fmtNumber(stats.p99, DECIMALS) },
    {
      label: 'Worst Max Gap',
      value: fmtNumber(stats.worst, DECIMALS),
      strong: true,
    },
  ];

  return (
    <section className="card overflow-hidden">
      <header className="flex items-center gap-2 border-b border-panel-border px-5 py-3">
        <TableIcon className="text-base text-accent" />
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-ink">
          <span className={['h-2.5 w-2.5 rounded-sm', accent].join(' ')} />
          {title}
        </h2>
      </header>

      {stats.count === 0 ? (
        <div className="p-6 text-center text-sm text-ink-muted">
          No events in this group for the selected zone.
        </div>
      ) : (
        <table className="w-full text-left text-sm">
          <tbody className="divide-y divide-panel-border">
            {rows.map((r) => (
              <tr key={r.label} className="hover:bg-panel/50">
                <td className="px-5 py-2 text-ink-muted">{r.label}</td>
                <td
                  className={[
                    'px-5 py-2 text-right font-mono',
                    r.strong ? 'font-semibold text-negative' : 'text-ink',
                  ].join(' ')}
                >
                  {r.value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
