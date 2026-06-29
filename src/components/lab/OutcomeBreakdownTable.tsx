/**
 * Research Lab outcome breakdown table (additive).
 */

import type { ScenarioResult } from '@/utils/scenario';
import { OUTCOME_LABELS, OUTCOME_ORDER } from '@/utils/scenario';
import { fmtInt, fmtPercent } from '@/utils/format';
import { TableIcon } from '@/components/common/icons';

const TONE: Record<string, string> = {
  RECOVERED_WITHOUT_SL: 'text-positive',
  RECOVERED_AFTER_SL: 'text-warning',
  SL_HIT: 'text-negative',
  DAY_END_NO_RESOLUTION: 'text-ink-muted',
  MAX_HOLDING_NO_RESOLUTION: 'text-ink-muted',
  DATASET_END_NO_RESOLUTION: 'text-ink-muted',
};

export function OutcomeBreakdownTable({ result }: { result: ScenarioResult }) {
  const valid = result.validEvents;

  return (
    <section className="card overflow-hidden">
      <header className="flex items-center gap-2 border-b border-panel-border px-5 py-3">
        <TableIcon className="text-base text-accent" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink">
          Outcome Breakdown
        </h2>
      </header>
      <table className="w-full text-left text-sm">
        <thead className="bg-panel text-xs uppercase tracking-wide text-ink-faint">
          <tr>
            <th className="px-4 py-2 font-medium">Outcome</th>
            <th className="px-4 py-2 text-right font-medium">Count</th>
            <th className="px-4 py-2 text-right font-medium">Percentage</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-panel-border text-sm">
          {OUTCOME_ORDER.map((o) => {
            const count = result.counts[o];
            if (count === 0) return null;
            return (
              <tr key={o} className="hover:bg-panel/50">
                <td className={['px-4 py-2', TONE[o]].join(' ')}>
                  {OUTCOME_LABELS[o]}
                </td>
                <td className="px-4 py-2 text-right font-mono text-ink">
                  {fmtInt(count)}
                </td>
                <td className="px-4 py-2 text-right font-mono text-ink-muted">
                  {fmtPercent(valid > 0 ? (count / valid) * 100 : 0)}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-panel-border">
            <td className="px-4 py-2 text-xs uppercase tracking-wide text-ink-faint">
              Valid total
            </td>
            <td className="px-4 py-2 text-right font-mono text-ink">
              {fmtInt(valid)}
            </td>
            <td className="px-4 py-2 text-right font-mono text-ink-faint">100%</td>
          </tr>
        </tfoot>
      </table>
    </section>
  );
}
