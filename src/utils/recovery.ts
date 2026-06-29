/**
 * Recovery matrix engine (Phase R5).
 *
 * Recovery definition:
 *   After a zone event, scan forward until one of:
 *     1. the gap reaches a target recovery level (gap <= target), OR
 *     2. the server day changes, OR
 *     3. the dataset ends.
 *
 * For every zone we compute aggregate recovery stats (to the zone low) and a
 * recovery-target matrix: for each lower target gap, how many events recovered,
 * the recovery probability, and the time distribution.
 *
 * Pure — reuses the already-detected events and the shared sample array; no CSV
 * is re-parsed.
 */

import type { GapSample } from '@/types/gap';
import type { GapZone } from '@/utils/histogram';
import type { ZoneEvent } from '@/utils/events';
import { summarise } from '@/utils/statistics';

export interface RecoverySettings {
  /** Step between successive lower recovery targets. */
  step: number;
  /** Lowest recovery target gap to evaluate. */
  minTargetGap: number;
  /** Minimum events for a zone to be considered statistically meaningful. */
  minEventsPerZone: number;
}

export const DEFAULT_RECOVERY_SETTINGS: RecoverySettings = {
  step: 0.5,
  minTargetGap: 10,
  minEventsPerZone: 10,
};

export interface RecoveryTargetRow {
  target: number;
  recovered: number;
  recoveryPct: number;
  avgTimeSec: number | null;
  medianTimeSec: number | null;
  maxTimeSec: number | null;
}

export interface ZoneRecovery {
  zoneId: string;
  zoneLow: number;
  zoneHigh: number;
  label: string;
  totalEvents: number;
  meetsMinEvents: boolean;

  // Aggregate recovery to the zone low.
  recoveredToLow: number;
  recoveryProbabilityPct: number;
  avgDistance: number | null;
  medianDistance: number | null;
  maxDistance: number | null;
  avgTimeSec: number | null;
  medianTimeSec: number | null;
  maxTimeSec: number | null;

  // Recovery-target matrix (descending by target gap).
  targets: RecoveryTargetRow[];
}

export interface RecoveryAnalysis {
  zones: ZoneRecovery[];
  settings: RecoverySettings;
}

const EPS = 1e-9;

function decimalsFor(step: number): number {
  const s = String(step);
  const dot = s.indexOf('.');
  return dot === -1 ? 0 : Math.min(6, s.length - dot - 1);
}

function roundTo(value: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

/** Generates descending target gaps for a zone: low, low−step, … ≥ minTargetGap. */
function targetsForZone(
  low: number,
  settings: RecoverySettings,
): number[] {
  const { step, minTargetGap } = settings;
  if (step <= 0) return [low];
  const decimals = decimalsFor(step);
  const targets: number[] = [];
  let t = roundTo(low, decimals);
  // Safety bound on iterations in case of pathological inputs.
  let guard = 0;
  while (t >= minTargetGap - EPS && guard < 10000) {
    targets.push(t);
    t = roundTo(t - step, decimals);
    guard += 1;
  }
  return targets;
}

interface PerTargetAcc {
  recovered: number;
  times: number[]; // seconds, only where both timestamps known
  distances: number[]; // entryGap − recoveredGap
}

/**
 * Scans forward from a single event, recording the first recovery time for each
 * target. Targets are descending, so once the gap reaches a lower target it has
 * necessarily reached every higher target — a single pass with an advancing
 * pointer captures all first-recovery times.
 */
function scanEvent(
  samples: GapSample[],
  event: ZoneEvent,
  targets: number[],
  acc: PerTargetAcc[],
): void {
  const entry = samples[event.startIndex];
  if (!entry) return;
  const entryTs = entry.timestampMs;
  const entryGap = event.entryGap;

  let ptr = 0;
  for (
    let j = event.startIndex + 1;
    j <= event.dayBoundaryIndex && ptr < targets.length;
    j += 1
  ) {
    const s = samples[j]!;
    if (s.dayKey !== event.date) break; // server day changed
    if (s.gap === null) continue;

    while (ptr < targets.length && s.gap <= targets[ptr]! + EPS) {
      const a = acc[ptr]!;
      a.recovered += 1;
      a.distances.push(entryGap - s.gap);
      if (entryTs !== null && s.timestampMs !== null) {
        a.times.push((s.timestampMs - entryTs) / 1000);
      }
      ptr += 1;
    }
  }
}

/** Builds the full recovery analysis across all zones. */
export function buildRecoveryAnalysis(
  samples: GapSample[],
  zones: GapZone[],
  events: ZoneEvent[],
  settings: RecoverySettings,
): RecoveryAnalysis {
  const eventsByZone = new Map<string, ZoneEvent[]>();
  for (const e of events) {
    const list = eventsByZone.get(e.zoneId);
    if (list) list.push(e);
    else eventsByZone.set(e.zoneId, [e]);
  }

  const zoneResults: ZoneRecovery[] = zones.map((zone) => {
    const zoneEvents = eventsByZone.get(zone.id) ?? [];
    const targets = targetsForZone(zone.low, settings);
    const acc: PerTargetAcc[] = targets.map(() => ({
      recovered: 0,
      times: [],
      distances: [],
    }));

    for (const event of zoneEvents) {
      scanEvent(samples, event, targets, acc);
    }

    const total = zoneEvents.length;
    const targetRows: RecoveryTargetRow[] = targets.map((target, idx) => {
      const a = acc[idx]!;
      const times = summarise(a.times);
      return {
        target,
        recovered: a.recovered,
        recoveryPct: total > 0 ? (a.recovered / total) * 100 : 0,
        avgTimeSec: times.mean,
        medianTimeSec: times.median,
        maxTimeSec: times.max,
      };
    });

    // Aggregate "to zone low" is the first (highest) target row plus distances.
    const lowAcc = acc[0];
    const lowDist = summarise(lowAcc?.distances ?? []);
    const lowTime = summarise(lowAcc?.times ?? []);
    const recoveredToLow = lowAcc?.recovered ?? 0;

    return {
      zoneId: zone.id,
      zoneLow: zone.low,
      zoneHigh: zone.high,
      label: zone.label,
      totalEvents: total,
      meetsMinEvents: total >= settings.minEventsPerZone,
      recoveredToLow,
      recoveryProbabilityPct: total > 0 ? (recoveredToLow / total) * 100 : 0,
      avgDistance: lowDist.mean,
      medianDistance: lowDist.median,
      maxDistance: lowDist.max,
      avgTimeSec: lowTime.mean,
      medianTimeSec: lowTime.median,
      maxTimeSec: lowTime.max,
      targets: targetRows,
    };
  });

  return { zones: zoneResults, settings };
}

/** Colour band for a recovery percentage (UI helper). */
export type RecoveryBand = 'high' | 'mid' | 'low';

export function recoveryBand(pct: number): RecoveryBand {
  if (pct >= 90) return 'high';
  if (pct >= 70) return 'mid';
  return 'low';
}
