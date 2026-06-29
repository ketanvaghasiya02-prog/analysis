/**
 * Recovery-target matrix table (Phase R5).
 *
 * For the selected zone, one row per lower target gap:
 * Target gap · Recovered events · Recovery % · Avg / Median / Max time.
 * Recovery % is colour-coded: green ≥ 90%, yellow 70–90%, red < 70%.
 */

import type { ZoneRecovery } from '@/utils/recovery';
import { recoveryBand } from '@/utils/recovery';
import { fmtDuration, fmtInt, fmtNumber, fmtPercent } from '@/utils/format';
import { TableIcon } from '@/components/common/icons';

const BAND_TEXT = {
  high: 'text-positive',
  mid: 'text-warning',
  low: 'text-negative',
} as const;

const BAND_BG = {
  high: 'bg-positive/10',
  mid: 'bg-warning/10',
  low: 'bg-negative/10',
} as const;

export function RecoveryMatrixTable({ zone }: { zone: ZoneRecovery }) {
  return (
    <section className="card overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-panel-border px-5 py-3">
        <div className="flex items-center gap-2">
          <TableIcon className="text-base text-accent" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink">
            Recovery Target Matrix
          </h2>
        </div>
        <span className="font-mono text-xs text-ink-faint">
          Zone {zone.label} · {fmtInt(zone.totalEvents)} events
        </span>
      </header>

      {zone.targets.length === 0 ? (
        <div className="p-6 text-center text-sm text-ink-muted">
          No recovery targets for this zone at the current settings.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-panel text-xs uppercase tracking-wide text-ink-faint">
              <tr>
                <th className="px-3 py-2 font-medium">Target Gap</th>
                <th className="px-3 py-2 text-right font-medium">Recovered</th>
                <th className="px-3 py-2 text-right font-medium">Recovery %</th>
                <th className="px-3 py-2 text-right font-medium">Avg Time</th>
                <th className="px-3 py-2 text-right font-medium">Median Time</th>
                <th className="px-3 py-2 text-right font-medium">Max Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-panel-border font-mono text-xs">
              {zone.targets.map((t) => {
                const band = recoveryBand(t.recoveryPct);
                return (
                  <tr key={t.target} className="hover:bg-panel/50">
                    <td className="px-3 py-2 text-ink">
                      {fmtNumber(t.target, 2)}
                    </td>
                    <td className="px-3 py-2 text-right text-ink-muted">
                      {fmtInt(t.recovered)}
                    </td>
                    <td
                      className={[
                        'px-3 py-2 text-right font-semibold',
                        BAND_BG[band],
                        BAND_TEXT[band],
                      ].join(' ')}
                    >
                      {fmtPercent(t.recoveryPct)}
                    </td>
                    <td className="px-3 py-2 text-right text-ink-muted">
                      {fmtDuration(t.avgTimeSec)}
                    </td>
                    <td className="px-3 py-2 text-right text-ink-muted">
                      {fmtDuration(t.medianTimeSec)}
                    </td>
                    <td className="px-3 py-2 text-right text-ink-muted">
                      {fmtDuration(t.maxTimeSec)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      <footer className="flex flex-wrap items-center gap-4 border-t border-panel-border px-5 py-2 text-[11px] text-ink-faint">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-positive" /> ≥ 90%
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-warning" /> 70–90%
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-negative" /> &lt; 70%
        </span>
      </footer>
    </section>
  );
}
