/**
 * Stop Loss Intelligence — summary cards (Phase 10C, observations only).
 *
 * Reads the intelligence analysis (itself derived from already-computed
 * optimizer results) and presents the headline historical observations. No
 * metric is recalculated and nothing here is a recommendation.
 */

import type { SlIntelligence } from '@/utils/slIntelligence';
import { StatCard } from '@/components/overview/StatCard';
import { fmtNumber, fmtPercent } from '@/utils/format';
import { INTEL_TOOLTIPS } from '@/components/sloptimizer/metrics';

export function SlIntelligenceSummary({ intel }: { intel: SlIntelligence }) {
  const {
    balanced,
    plateau,
    largestGain,
    highestEfficiency,
    highestRecovery,
    lowestSlHit,
  } = intel;

  return (
    <section>
      <h2 className="stat-label mb-2">Intelligence Summary</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        <StatCard
          label="Historically Balanced SL"
          tone="positive"
          value={balanced ? fmtNumber(balanced.stopLoss, 2) : '—'}
          hint={balanced ? `recovery ${fmtPercent(balanced.recoveryBeforeSlPct)}` : undefined}
          tooltip={INTEL_TOOLTIPS.balanced}
        />
        <StatCard
          label="Recovery Plateau"
          tone="accent"
          value={
            plateau
              ? `${fmtNumber(plateau.startStopLoss, 2)}–${fmtNumber(plateau.endStopLoss, 2)}`
              : 'none'
          }
          hint={plateau ? `~${fmtPercent(plateau.recoveryPct)} · ${plateau.length} steps` : undefined}
          tooltip={INTEL_TOOLTIPS.plateau}
        />
        <StatCard
          label="Plateau Starts At"
          tone="accent"
          value={plateau ? fmtNumber(plateau.startStopLoss, 2) : '—'}
          tooltip={INTEL_TOOLTIPS.plateauStart}
        />
        <StatCard
          label="Largest Recovery Gain"
          tone="warning"
          value={largestGain ? `+${fmtPercent(largestGain.recoveryGain)}` : '—'}
          hint={largestGain ? `at SL ${fmtNumber(largestGain.stopLoss, 2)}` : undefined}
          tooltip={INTEL_TOOLTIPS.largestGain}
        />
        <StatCard
          label="Highest Efficiency"
          tone="default"
          value={highestEfficiency ? fmtNumber(highestEfficiency.efficiency, 2) : '—'}
          hint={highestEfficiency ? `at SL ${fmtNumber(highestEfficiency.stopLoss, 2)}` : undefined}
          tooltip={INTEL_TOOLTIPS.highestEfficiency}
        />
        <StatCard
          label="Highest Recovery"
          tone="positive"
          value={highestRecovery ? fmtPercent(highestRecovery.recoveryBeforeSlPct) : '—'}
          hint={highestRecovery ? `at SL ${fmtNumber(highestRecovery.stopLoss, 2)}` : undefined}
          tooltip={INTEL_TOOLTIPS.highestRecovery}
        />
        <StatCard
          label="Lowest SL Hit"
          tone="accent"
          value={lowestSlHit ? fmtPercent(lowestSlHit.slHitPct) : '—'}
          hint={lowestSlHit ? `at SL ${fmtNumber(lowestSlHit.stopLoss, 2)}` : undefined}
          tooltip={INTEL_TOOLTIPS.lowestSlHit}
        />
      </div>
    </section>
  );
}
