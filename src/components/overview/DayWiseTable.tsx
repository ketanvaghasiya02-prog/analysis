/**
 * Per-day statistical breakdown shown in "Day Wise Analysis" mode.
 */

import { useMemo } from 'react';
import { useData } from '@/context/DataContext';
import { gapSummary, syncQualityPct } from '@/utils/statistics';
import { fmtInt, fmtNumber, fmtPercent } from '@/utils/format';
import { LayersIcon } from '@/components/common/icons';

export function DayWiseTable() {
  const { dataset } = useData();

  const rows = useMemo(() => {
    if (!dataset) return [];
    return dataset.dayKeys.map((day) => {
      const samples = dataset.byDay[day] ?? [];
      const gaps = gapSummary(samples);
      return {
        day,
        count: samples.length,
        mean: gaps.mean,
        min: gaps.min,
        max: gaps.max,
        std: gaps.stdDev,
        sync: syncQualityPct(samples),
      };
    });
  }, [dataset]);

  if (!dataset) return null;

  return (
    <section className="card overflow-hidden">
      <header className="flex items-center gap-2 border-b border-panel-border px-5 py-3">
        <LayersIcon className="text-base text-accent" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink">
          Day-wise Breakdown
        </h2>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-panel text-xs uppercase tracking-wide text-ink-faint">
            <tr>
              <th className="px-3 py-2 font-medium">Day</th>
              <th className="px-3 py-2 text-right font-medium">Samples</th>
              <th className="px-3 py-2 text-right font-medium">Avg Gap</th>
              <th className="px-3 py-2 text-right font-medium">Min Gap</th>
              <th className="px-3 py-2 text-right font-medium">Max Gap</th>
              <th className="px-3 py-2 text-right font-medium">Std Dev</th>
              <th className="px-3 py-2 text-right font-medium">Sync %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-panel-border font-mono text-xs">
            {rows.map((r) => (
              <tr key={r.day} className="hover:bg-panel/50">
                <td className="px-3 py-2 text-ink">{r.day}</td>
                <td className="px-3 py-2 text-right text-ink-muted">
                  {fmtInt(r.count)}
                </td>
                <td className="px-3 py-2 text-right text-accent">
                  {fmtNumber(r.mean, 3)}
                </td>
                <td className="px-3 py-2 text-right text-negative">
                  {fmtNumber(r.min, 3)}
                </td>
                <td className="px-3 py-2 text-right text-positive">
                  {fmtNumber(r.max, 3)}
                </td>
                <td className="px-3 py-2 text-right text-ink-muted">
                  {fmtNumber(r.std, 3)}
                </td>
                <td
                  className={[
                    'px-3 py-2 text-right',
                    r.sync !== null && r.sync >= 95
                      ? 'text-positive'
                      : 'text-warning',
                  ].join(' ')}
                >
                  {fmtPercent(r.sync)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
