/**
 * Section 8 — Rare Gap Analysis (Overview 2.0).
 *
 * Tail description (occurrences/%/dates/expansion) is pure stats; average
 * recovery and confidence are consumed from the Research Engine.
 */

import { useMemo } from 'react';
import type { GapSample } from '@/types/gap';
import {
  computeScenario,
  CONFIDENCE_LABELS,
  type ScenarioInput,
} from '@/utils/scenario';
import { buildRareGaps } from '@/utils/overviewStats';
import { fmtDuration, fmtInt, fmtNumber, fmtPercent } from '@/utils/format';
import { AlertIcon } from '@/components/common/icons';

export function RareGapSection({
  samples,
  reference,
}: {
  samples: GapSample[];
  reference: ScenarioInput;
}) {
  const rows = useMemo(() => {
    const levels = buildRareGaps(samples).filter((l) => l.occurrences > 0);
    return levels.map((l) => {
      // Reference scenario anchored at the rare threshold.
      const scenario: ScenarioInput = {
        ...reference,
        entryGap: l.threshold,
        recoveryGap: Math.min(reference.recoveryGap, l.threshold - 0.5),
        stopLoss: Math.max(reference.stopLoss, l.threshold + 0.5),
      };
      const res = computeScenario(samples, scenario);
      return {
        ...l,
        avgRecoverySec: res.avgRecoveryTimeSec,
        confidence: CONFIDENCE_LABELS[res.confidence.level],
      };
    });
  }, [samples, reference]);

  return (
    <section className="card overflow-hidden">
      <header className="flex items-center gap-2 border-b border-panel-border px-5 py-3">
        <AlertIcon className="text-base text-accent" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink">
          Rare Gap Analysis
        </h2>
        <span className="ml-auto text-xs text-ink-faint">tail levels (gap ≥ threshold)</span>
      </header>
      {rows.length === 0 ? (
        <div className="p-6 text-center text-sm text-ink-muted">No rare gap levels.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-panel text-xs uppercase tracking-wide text-ink-faint">
              <tr>
                <th className="px-3 py-2 font-medium">Gap ≥</th>
                <th className="px-3 py-2 text-right font-medium">Occurrences</th>
                <th className="px-3 py-2 text-right font-medium">Percentage</th>
                <th className="px-3 py-2 font-medium">First Seen</th>
                <th className="px-3 py-2 font-medium">Last Occurrence</th>
                <th className="px-3 py-2 text-right font-medium">Max Expansion</th>
                <th className="px-3 py-2 text-right font-medium">Avg Recovery</th>
                <th className="px-3 py-2 font-medium">Confidence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-panel-border font-mono text-xs">
              {rows.map((r) => (
                <tr key={r.threshold} className="hover:bg-panel/50">
                  <td className="px-3 py-2 text-ink">{fmtNumber(r.threshold, 2)}</td>
                  <td className="px-3 py-2 text-right text-accent">{fmtInt(r.occurrences)}</td>
                  <td className="px-3 py-2 text-right text-ink-muted">{fmtPercent(r.percentage, 2)}</td>
                  <td className="px-3 py-2 text-ink-muted">{r.firstSeen ?? '—'}</td>
                  <td className="px-3 py-2 text-ink-muted">{r.lastSeen ?? '—'}</td>
                  <td className="px-3 py-2 text-right text-negative">{fmtNumber(r.maxExpansion, 3)}</td>
                  <td className="px-3 py-2 text-right text-ink-muted">{fmtDuration(r.avgRecoverySec)}</td>
                  <td className="px-3 py-2 font-sans text-ink-muted">{r.confidence}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
