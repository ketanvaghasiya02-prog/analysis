/**
 * Stop Loss Optimizer — institutional summary cards (visualization only).
 *
 * Every figure is read straight from the already-computed optimizer result.
 * No metric is recalculated here.
 */

import { useMemo } from 'react';
import type { SlOptimizerResult, SlOptimizerRow } from '@/utils/slOptimizer';
import { StatCard } from '@/components/overview/StatCard';
import { fmtInt, fmtNumber, fmtPercent } from '@/utils/format';

/** Minimum SL Hit % across rows that actually have positions. */
function lowestSlHit(rows: SlOptimizerRow[]): SlOptimizerRow | null {
  const withPos = rows.filter((r) => r.totalPositions > 0);
  if (withPos.length === 0) return null;
  return withPos.reduce((best, r) => (r.slHitPct < best.slHitPct ? r : best));
}

export function SlOptimizerSummary({ result }: { result: SlOptimizerResult }) {
  const { meta, maxSuccess, highestScore, balanced } = result;

  const lowestHit = useMemo(() => lowestSlHit(result.rows), [result.rows]);

  // Research confidence shown is the confidence at the best-scoring SL — a
  // representative read of how much history backs the recommendation surface.
  const confidenceLabel = highestScore?.confidenceLabel ?? '—';

  return (
    <section>
      <h2 className="stat-label mb-2">Summary</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <StatCard
          label="Total SL Tested"
          value={fmtInt(meta.totalTested)}
          tooltip="Number of stop-loss values evaluated in this sweep."
        />
        <StatCard label="Minimum Stop Loss" value={fmtNumber(meta.minStopLoss, 2)} />
        <StatCard label="Maximum Stop Loss" value={fmtNumber(meta.maxStopLoss, 2)} />
        <StatCard label="Step Size" value={fmtNumber(meta.step, 2)} />
        <StatCard
          label="Best Historical Recovery"
          tone="positive"
          value={maxSuccess ? fmtPercent(maxSuccess.recoveryBeforeSlPct) : '—'}
          hint={maxSuccess ? `at SL ${fmtNumber(maxSuccess.stopLoss, 2)}` : undefined}
          tooltip="Highest historical recovery-before-SL across all tested stop-losses."
        />
        <StatCard
          label="Lowest Historical SL Hit"
          tone="accent"
          value={lowestHit ? fmtPercent(lowestHit.slHitPct) : '—'}
          hint={lowestHit ? `at SL ${fmtNumber(lowestHit.stopLoss, 2)}` : undefined}
          tooltip="Lowest historical stop-loss hit rate across all tested stop-losses."
        />
        <StatCard
          label="Best Overall Score"
          tone="warning"
          value={highestScore ? fmtNumber(highestScore.score, 1) : '—'}
          hint={highestScore ? `at SL ${fmtNumber(highestScore.stopLoss, 2)}` : undefined}
          tooltip="Highest Phase 10A composite score. Descriptive only — not a recommendation."
        />
        <StatCard
          label="Balanced Stop Loss"
          tone="default"
          value={balanced ? fmtNumber(balanced.stopLoss, 2) : '—'}
          hint="refined in Phase 10C"
          tooltip="First stop-loss where higher values add almost no historical recovery. A dedicated balanced-SL engine arrives in Phase 10C."
        />
        <StatCard
          label="Research Confidence"
          value={confidenceLabel}
          tooltip="Research confidence at the best-scoring stop-loss, based on the historical sample size."
        />
      </div>
    </section>
  );
}
