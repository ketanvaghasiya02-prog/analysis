/**
 * Stop Loss Optimizer — metric labels, tooltips and chart palette.
 *
 * Presentation metadata only. Every string here describes a metric that is
 * already computed by the frozen optimizer; nothing is calculated here.
 */

export const METRIC_TOOLTIPS: Record<string, string> = {
  stopLoss: 'The stop-loss level being tested, in gap points.',
  recoveryBeforeSlPct:
    'Percentage of positions that recovered before touching the stop-loss.',
  recoveryAfterSlPct:
    'Percentage of positions that touched the stop-loss first, then recovered afterwards.',
  recoveryIgnoringSlPct:
    'Percentage of positions that eventually recovered, regardless of the stop-loss.',
  slHitPct:
    'Percentage of positions whose maximum adverse gap reached the stop-loss.',
  avgRecoverySec: 'Average historical time taken to recover.',
  medianRecoverySec: 'Median historical time taken to recover.',
  avgMaxGap: 'Average of the largest adverse gap observed after entry.',
  p95MaxGap: '95th-percentile largest adverse gap observed after entry.',
  worstMaxGap: 'Largest adverse gap historically observed after entry.',
  avgHoldingSec: 'Average time a position was held before it closed.',
  score:
    'Composite 0–100 score from Phase 10A (recovery, risk, holding, confidence). Descriptive only.',
  efficiency: 'Recovery gained per extra point of stop-loss risk.',
  confidenceLabel:
    'Research confidence in this row, based on the number of historical positions.',
};

/** Chart series palette (kept consistent across all optimizer charts). */
export const SERIES_COLORS = {
  recoveryBefore: '#34d399',
  recoveryAfter: '#fbbf24',
  recoveryIgnoring: '#38bdf8',
  slHit: '#f87171',
  avgRecovery: '#a78bfa',
  medianRecovery: '#22d3ee',
  avgGap: '#f59e0b',
  p95Gap: '#fb923c',
  worstGap: '#f87171',
  score: '#facc15',
  balanced: '#38bdf8',
} as const;
