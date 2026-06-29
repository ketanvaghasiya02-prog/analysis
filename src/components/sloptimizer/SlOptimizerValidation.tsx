/**
 * Stop Loss Optimizer — validation / run metadata panel (Phase 10A).
 *
 * Surfaces how the sweep ran: how many stop-loss values were tested, the range,
 * the step, the wall-clock calculation time, and the number of Research Engine
 * calls made (one per stop-loss).
 */

import { StatCard } from '@/components/overview/StatCard';
import { fmtInt, fmtNumber } from '@/utils/format';
import type { SlOptimizerMeta } from '@/utils/slOptimizer';

export function SlOptimizerValidation({ meta }: { meta: SlOptimizerMeta }) {
  return (
    <section>
      <h2 className="stat-label mb-2">Validation</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="Total SL Tested"
          value={fmtInt(meta.totalTested)}
          tooltip="Number of stop-loss values evaluated in this sweep."
        />
        <StatCard label="Minimum SL" value={fmtNumber(meta.minStopLoss, 2)} />
        <StatCard label="Maximum SL" value={fmtNumber(meta.maxStopLoss, 2)} />
        <StatCard label="Current Step" value={fmtNumber(meta.step, 2)} />
        <StatCard
          label="Calculation Time"
          value={`${fmtNumber(meta.calcTimeMs, 1)} ms`}
          tone="accent"
          tooltip="Wall-clock time spent running the Research Engine sweep (memoized — only recomputes when inputs change)."
        />
        <StatCard
          label="Research Engine Calls"
          value={fmtInt(meta.engineCalls)}
          tooltip="Each stop-loss value calls the frozen Research Engine v1.0 exactly once. No logic is duplicated here."
        />
      </div>
    </section>
  );
}
