/**
 * Stop-loss survival analysis (Phase R7).
 *
 * RESEARCH ONLY. This module produces statistical evidence about how a given
 * stop-loss gap level would have interacted with historical zone events. It
 * does NOT generate trading signals, recommendations, or instructions to act.
 *
 * Outcome model for a stop-loss level `sl` (a gap level above entry):
 *   - An event is "stopped" iff its max gap after entry exceeds `sl`.
 *   - Recovered & maxGap <= sl  → recovered survived (reached recovery).
 *   - Recovered & maxGap >  sl  → recovered stopped (stopped before recovery).
 *   - Failed   & maxGap >  sl   → failed cut (stop removed the failure).
 *   - Failed   & maxGap <= sl   → failed not cut (never stopped, never recovered).
 *
 * Reuses the MAE per-event results; no CSV is re-parsed.
 */

import type { ZoneMae } from '@/utils/mae';

export interface StopLossSettings {
  /** Lowest SL gap level to evaluate; null = auto-fit to the zone. */
  start: number | null;
  /** Highest SL gap level to evaluate; null = auto-fit to the zone. */
  end: number | null;
  step: number;
}

export const DEFAULT_SL_SETTINGS: StopLossSettings = {
  start: null,
  end: null,
  step: 0.5,
};

export interface SurvivalRow {
  slLevel: number;
  recoveredSurvivedPct: number;
  recoveredStoppedPct: number;
  failedCutPct: number;
  failedNotCutPct: number;
  overallRecoveryPct: number;
  expectedFailurePct: number;
  /**
   * Stop efficiency (−100…100): how well the level separates failures from
   * recoveries — failedCutRate − recoveredStoppedRate (equivalent to Youden's J
   * scaled to a percentage). Higher means it cuts more failures while wrongly
   * stopping fewer recoveries.
   */
  stopEfficiency: number;
}

const EPS = 1e-9;

/** Computes the survival outcome row for one SL level over a zone's events. */
export function survivalAt(zone: ZoneMae, sl: number): SurvivalRow {
  const R = zone.recovered;
  const F = zone.failed;
  const total = R.length + F.length;

  const recSurvived = R.filter((e) => e.maxGap <= sl + EPS).length;
  const recStopped = R.length - recSurvived;
  const failCut = F.filter((e) => e.maxGap > sl + EPS).length;
  const failNotCut = F.length - failCut;

  const recoveredSurvivedPct = R.length ? (recSurvived / R.length) * 100 : 0;
  const recoveredStoppedPct = R.length ? (recStopped / R.length) * 100 : 0;
  const failedCutPct = F.length ? (failCut / F.length) * 100 : 0;
  const failedNotCutPct = F.length ? (failNotCut / F.length) * 100 : 0;

  const overallRecoveryPct = total ? (recSurvived / total) * 100 : 0;
  const expectedFailurePct = total ? (failNotCut / total) * 100 : 0;

  const failedCutRate = F.length ? failCut / F.length : 0;
  const recoveredStoppedRate = R.length ? recStopped / R.length : 0;
  const stopEfficiency = (failedCutRate - recoveredStoppedRate) * 100;

  return {
    slLevel: sl,
    recoveredSurvivedPct,
    recoveredStoppedPct,
    failedCutPct,
    failedNotCutPct,
    overallRecoveryPct,
    expectedFailurePct,
    stopEfficiency,
  };
}

function decimalsFor(step: number): number {
  const s = String(step);
  const dot = s.indexOf('.');
  return dot === -1 ? 0 : Math.min(6, s.length - dot - 1);
}

function roundTo(value: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

export interface SurvivalCurve {
  rows: SurvivalRow[];
  effectiveStart: number;
  effectiveEnd: number;
  step: number;
}

/**
 * Builds the survival curve across SL levels. When start/end are null they are
 * auto-fitted to the zone: from the zone low up to the worst recovered max gap
 * (so every recovered event's excursion is covered).
 */
export function buildSurvivalCurve(
  zone: ZoneMae,
  settings: StopLossSettings,
): SurvivalCurve {
  const step = settings.step > 0 ? settings.step : 0.5;
  const decimals = decimalsFor(step);

  const worstRecovered = zone.recoveredStats.worst ?? zone.zoneHigh;
  const autoStart = roundTo(Math.floor(zone.zoneLow / step) * step, decimals);
  const autoEnd = roundTo(Math.ceil(worstRecovered / step) * step, decimals);

  let start = settings.start ?? autoStart;
  let end = settings.end ?? autoEnd;
  if (end < start) [start, end] = [end, start];

  const rows: SurvivalRow[] = [];
  let guard = 0;
  for (let lvl = start; lvl <= end + EPS && guard < 10000; guard += 1) {
    const sl = roundTo(lvl, decimals);
    rows.push(survivalAt(zone, sl));
    lvl = roundTo(lvl + step, decimals);
  }

  return { rows, effectiveStart: start, effectiveEnd: end, step };
}

export type SlStyle = 'aggressive' | 'balanced' | 'conservative' | 'worst-case';

export interface SuggestedStopLoss {
  style: SlStyle;
  label: string;
  basis: string;
  description: string;
  slLevel: number | null;
  row: SurvivalRow | null;
}

/**
 * Derives statistical SL reference levels from the recovered-event max-gap
 * distribution. These are evidence points, not recommendations.
 */
export function suggestedStopLosses(zone: ZoneMae): SuggestedStopLoss[] {
  const s = zone.recoveredStats;
  const defs: Array<{
    style: SlStyle;
    label: string;
    basis: string;
    description: string;
    level: number | null;
  }> = [
    {
      style: 'aggressive',
      label: 'Aggressive',
      basis: 'Recovered P90 max gap',
      description:
        'Tightest reference. ~10% of recovered events historically expanded beyond this level and would have been stopped before recovering.',
      level: s.p90,
    },
    {
      style: 'balanced',
      label: 'Balanced',
      basis: 'Recovered P95 max gap',
      description:
        'Covers the max-gap excursion of ~95% of recovered events; ~5% expanded beyond it before recovering.',
      level: s.p95,
    },
    {
      style: 'conservative',
      label: 'Conservative',
      basis: 'Recovered P99 max gap',
      description:
        'Covers ~99% of recovered events; only the most extreme ~1% expanded beyond it before recovering.',
      level: s.p99,
    },
    {
      style: 'worst-case',
      label: 'Worst-case',
      basis: 'Worst recovered max gap',
      description:
        'Covers every recovered event in this sample — no historical recovery expanded beyond this level.',
      level: s.worst,
    },
  ];

  return defs.map((d) => ({
    style: d.style,
    label: d.label,
    basis: d.basis,
    description: d.description,
    slLevel: d.level,
    row: d.level !== null ? survivalAt(zone, d.level) : null,
  }));
}
