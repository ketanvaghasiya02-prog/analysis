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

/** Intelligence Layer (Phase 10C) tooltips — observations, never advice. */
export const INTEL_TOOLTIPS: Record<string, string> = {
  balanced:
    'Historical point where increasing the stop-loss produced very little additional recovery.',
  plateau:
    'Historical area where recovery remained nearly unchanged despite an increasing stop-loss.',
  plateauStart:
    'The stop-loss at which the historical recovery plateau begins.',
  recoveryGain:
    'Change in recovery-before-SL compared with the previous stop-loss step.',
  riskIncrease:
    'Additional stop-loss risk (gap points) compared with the previous stop-loss step.',
  efficiency:
    'Recovery gain divided by additional risk — recovery gained per extra point of stop-loss.',
  largestGain:
    'Stop-loss step with the largest single historical recovery gain.',
  highestEfficiency:
    'Stop-loss step that historically gained the most recovery per point of added risk.',
  highestRecovery:
    'Stop-loss with the highest historical recovery-before-SL.',
  lowestSlHit:
    'Stop-loss with the lowest historical stop-loss hit rate.',
  balancedZone:
    'Stop-losses at or above the historically balanced point, where extra recovery is marginal.',
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
