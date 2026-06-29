/**
 * Day comparison table (Phase R2, feature #3).
 *
 * Columns: Date · Samples · Average Gap · Max Gap · Min Gap · Std Dev ·
 * Best Session · Sync Quality · Data Quality.
 *
 * "Best Session" is the most active session for the day. Reads
 * `filteredSamples`, so it honours the analysis mode and global filters.
 */

import { useMemo } from 'react';
import { useData } from '@/context/DataContext';
import { computeDayStats } from '@/utils/dayAnalysis';
import { fmtInt, fmtNumber, fmtPercent } from '@/utils/format';
import { TableIcon } from '@/components/common/icons';

function QualityCell({ value }: { value: number | null }) {
  const tone =
    value === null
      ? 'text-ink-faint'
      : value >= 95
        ? 'text-positive'
        : value >= 80
          ? 'text-warning'
          : 'text-negative';
  return <span className={tone}>{fmtPercent(value)}</span>;
}

export function DayComparisonTable() {
  const { filteredSamples } = useData();
  const rows = useMemo(
    () => computeDayStats(filteredSamples),
    [filteredSamples],
  );

  return (
    <section className="card overflow-hidden">
      <header className="flex items-center gap-2 border-b border-panel-border px-5 py-3">
        <TableIcon className="text-base text-accent" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink">
          Day Comparison
        </h2>
        <span className="ml-auto text-xs text-ink-faint">
          {rows.length} day{rows.length === 1 ? '' : 's'}
        </span>
      </header>

      {rows.length === 0 ? (
        <div className="p-6 text-center text-sm text-ink-muted">
          No samples in the current selection.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-panel text-xs uppercase tracking-wide text-ink-faint">
              <tr>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 text-right font-medium">Samples</th>
                <th className="px-3 py-2 text-right font-medium">Average Gap</th>
                <th className="px-3 py-2 text-right font-medium">Max Gap</th>
                <th className="px-3 py-2 text-right font-medium">Min Gap</th>
                <th className="px-3 py-2 text-right font-medium">Std Dev</th>
                <th className="px-3 py-2 font-medium">Best Session</th>
                <th className="px-3 py-2 text-right font-medium">Sync Quality</th>
                <th className="px-3 py-2 text-right font-medium">Data Quality</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-panel-border font-mono text-xs">
              {rows.map((r) => (
                <tr key={r.day} className="hover:bg-panel/50">
                  <td className="px-3 py-2 text-ink">{r.day}</td>
                  <td className="px-3 py-2 text-right text-ink-muted">
                    {fmtInt(r.samples)}
                  </td>
                  <td className="px-3 py-2 text-right text-accent">
                    {fmtNumber(r.avgGap, 3)}
                  </td>
                  <td className="px-3 py-2 text-right text-positive">
                    {fmtNumber(r.maxGap, 3)}
                  </td>
                  <td className="px-3 py-2 text-right text-negative">
                    {fmtNumber(r.minGap, 3)}
                  </td>
                  <td className="px-3 py-2 text-right text-ink-muted">
                    {fmtNumber(r.stdDev, 3)}
                  </td>
                  <td className="px-3 py-2 font-sans text-ink-muted">
                    {r.mostCommonSession}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <QualityCell value={r.syncQualityPct} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <QualityCell value={r.dataQualityPct} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
