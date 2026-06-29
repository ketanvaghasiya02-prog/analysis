/**
 * Stop-loss survival table (Phase R7).
 *
 * One row per SL gap level. Research evidence only — no recommendations.
 */

import type { SurvivalRow } from '@/utils/stoploss';
import { fmtNumber, fmtPercent } from '@/utils/format';
import { TableIcon } from '@/components/common/icons';

interface SurvivalTableProps {
  rows: SurvivalRow[];
  /** SL levels to highlight (e.g. suggested reference levels). */
  highlight?: number[];
}

function effTone(value: number): string {
  if (value >= 25) return 'text-positive';
  if (value <= -25) return 'text-negative';
  return 'text-warning';
}

export function SurvivalTable({ rows, highlight = [] }: SurvivalTableProps) {
  const hi = new Set(highlight.map((h) => h.toFixed(4)));

  return (
    <section className="card overflow-hidden">
      <header className="flex items-center gap-2 border-b border-panel-border px-5 py-3">
        <TableIcon className="text-base text-accent" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink">
          Survival Table
        </h2>
        <span className="ml-auto text-xs text-ink-faint">
          {rows.length} SL level{rows.length === 1 ? '' : 's'}
        </span>
      </header>

      {rows.length === 0 ? (
        <div className="p-6 text-center text-sm text-ink-muted">
          No SL levels to evaluate for the current settings.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-panel text-xs uppercase tracking-wide text-ink-faint">
              <tr>
                <th className="px-3 py-2 font-medium">SL Level</th>
                <th className="px-3 py-2 text-right font-medium">Rec. Survived</th>
                <th className="px-3 py-2 text-right font-medium">Rec. Stopped</th>
                <th className="px-3 py-2 text-right font-medium">Failed Cut</th>
                <th className="px-3 py-2 text-right font-medium">Failed Not Cut</th>
                <th className="px-3 py-2 text-right font-medium">Overall Recovery</th>
                <th className="px-3 py-2 text-right font-medium">Expected Failure</th>
                <th className="px-3 py-2 text-right font-medium">Stop Efficiency</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-panel-border font-mono text-xs">
              {rows.map((r) => {
                const highlighted = hi.has(r.slLevel.toFixed(4));
                return (
                  <tr
                    key={r.slLevel}
                    className={
                      highlighted
                        ? 'bg-accent/10 ring-1 ring-inset ring-accent/30'
                        : 'hover:bg-panel/50'
                    }
                  >
                    <td className="px-3 py-2 text-ink">
                      {fmtNumber(r.slLevel, 2)}
                    </td>
                    <td className="px-3 py-2 text-right text-positive">
                      {fmtPercent(r.recoveredSurvivedPct)}
                    </td>
                    <td className="px-3 py-2 text-right text-negative">
                      {fmtPercent(r.recoveredStoppedPct)}
                    </td>
                    <td className="px-3 py-2 text-right text-positive">
                      {fmtPercent(r.failedCutPct)}
                    </td>
                    <td className="px-3 py-2 text-right text-warning">
                      {fmtPercent(r.failedNotCutPct)}
                    </td>
                    <td className="px-3 py-2 text-right text-accent">
                      {fmtPercent(r.overallRecoveryPct)}
                    </td>
                    <td className="px-3 py-2 text-right text-ink-muted">
                      {fmtPercent(r.expectedFailurePct)}
                    </td>
                    <td
                      className={[
                        'px-3 py-2 text-right font-semibold',
                        effTone(r.stopEfficiency),
                      ].join(' ')}
                    >
                      {fmtNumber(r.stopEfficiency, 1)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
