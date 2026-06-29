/**
 * Statistical aggregation utilities. Pure functions over GapSample arrays.
 */

import type { GapSample } from '@/types/gap';

export interface NumericSummary {
  count: number;
  mean: number | null;
  min: number | null;
  max: number | null;
  stdDev: number | null;
  median: number | null;
}

const EMPTY_SUMMARY: NumericSummary = {
  count: 0,
  mean: null,
  min: null,
  max: null,
  stdDev: null,
  median: null,
};

/** Computes summary statistics over an array of nullable numbers. */
export function summarise(values: Array<number | null>): NumericSummary {
  const nums = values.filter((v): v is number => v !== null && Number.isFinite(v));
  if (nums.length === 0) return { ...EMPTY_SUMMARY };

  let sum = 0;
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const n of nums) {
    sum += n;
    if (n < min) min = n;
    if (n > max) max = n;
  }
  const mean = sum / nums.length;

  let variance = 0;
  for (const n of nums) variance += (n - mean) ** 2;
  variance /= nums.length;
  const stdDev = Math.sqrt(variance);

  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0
      ? ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2
      : (sorted[mid] as number);

  return { count: nums.length, mean, min, max, stdDev, median };
}

/**
 * Linear-interpolation percentile (type-7, numpy default) for p in 0–100.
 * Returns null for an empty input.
 */
export function percentile(
  values: Array<number | null>,
  p: number,
): number | null {
  const a = values
    .filter((v): v is number => v !== null && Number.isFinite(v))
    .sort((x, y) => x - y);
  if (a.length === 0) return null;
  if (a.length === 1) return a[0] as number;
  const rank = (p / 100) * (a.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  const loVal = a[lo] as number;
  if (lo === hi) return loVal;
  const hiVal = a[hi] as number;
  return loVal + (hiVal - loVal) * (rank - lo);
}

/** Convenience: summary of the `gap` field across samples. */
export function gapSummary(samples: GapSample[]): NumericSummary {
  return summarise(samples.map((s) => s.gap));
}

/**
 * Sync quality as a 0–100 percentage: share of samples whose SyncStatus
 * indicates a synced / OK state.
 */
export function syncQualityPct(samples: GapSample[]): number | null {
  if (samples.length === 0) return null;
  const ok = samples.filter((s) => isSynced(s.syncStatus)).length;
  return (ok / samples.length) * 100;
}

/** Heuristic: which SyncStatus labels count as "good". */
export function isSynced(status: string): boolean {
  const s = status.trim().toUpperCase();
  return s === 'SYNCED' || s === 'OK' || s === 'IN_SYNC' || s === 'INSYNC';
}

/** Counts occurrences of each SyncStatus label. */
export function syncStatusCounts(samples: GapSample[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const s of samples) {
    const key = s.syncStatus || 'UNKNOWN';
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

/** Counts occurrences of each session label. */
export function sessionCounts(samples: GapSample[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const s of samples) {
    const key = s.currentSession || 'UNKNOWN';
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}
