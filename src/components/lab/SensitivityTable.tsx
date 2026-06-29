/**
 * Research Lab stop-loss sensitivity table (additive).
 */

import type { SensitivityRow } from '@/utils/scenario';
import { fmtInt, fmtNumber, fmtPercent } from '@/utils/format';
import { TableIcon } from '@/components/common/icons';

function effTone(v: number): string {
  if (v >= 25) return 'text-positive';
  if (v <= -25) return 'text-negative';
  return 'text-warning';
}

export function SensitivityTable({
  rows,
  currentSl,
}: {
  rows: SensitivityRow[];
  currentSl: number;
}) {
  return (
    <section className="card overflow-hidden">
      <header className="flex items-center gap-2 border-b border-panel-border px-5 py-3">
        <TableIcon className="text-base text-accent" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink">
          Stop-Loss Sensitivity
        </h2>
        <span className="ml-auto text-xs text-ink-faint">
          {rows.length} SL levels
        </span>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-panel text-xs uppercase tracking-wide text-ink-faint">
            <tr>
              <th className="px-3 py-2 font-medium">SL Level</th>
              <th className="px-3 py-2 text-right font-medium">Recovery Before SL %</th>
              <th className="px-3 py-2 text-right font-medium">SL Hit %</th>
              <th className="px-3 py-2 text-right font-medium">Recovered Stopped</th>
              <th className="px-3 py-2 text-right font-medium">Failed Cut</th>
              <th className="px-3 py-2 text-right font-medium">Unresolved %</th>
              <th className="px-3 py-2 text-right font-medium">Efficiency</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-panel-border font-mono text-xs">
            {rows.map((r) => {
              const near = Math.abs(r.slLevel - currentSl) < 0.25;
              return (
                <tr
                  key={r.slLevel}
                  className={
                    near
                      ? 'bg-accent/10 ring-1 ring-inset ring-accent/30'
                      : 'hover:bg-panel/50'
                  }
                >
                  <td className="px-3 py-2 text-ink">{fmtNumber(r.slLevel, 2)}</td>
                  <td className="px-3 py-2 text-right text-positive">
                    {fmtPercent(r.recoveryBeforeSlPct)}
                  </td>
                  <td className="px-3 py-2 text-right text-negative">
                    {fmtPercent(r.slHitPct)}
                  </td>
                  <td className="px-3 py-2 text-right text-warning">
                    {fmtInt(r.recoveredEventsStopped)}
                  </td>
                  <td className="px-3 py-2 text-right text-ink-muted">
                    {fmtInt(r.failedEventsCut)}
                  </td>
                  <td className="px-3 py-2 text-right text-ink-muted">
                    {fmtPercent(r.unresolvedPct)}
                  </td>
                  <td
                    className={[
                      'px-3 py-2 text-right font-semibold',
                      effTone(r.efficiency),
                    ].join(' ')}
                  >
                    {fmtNumber(r.efficiency, 1)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
