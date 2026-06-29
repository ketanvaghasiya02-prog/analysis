/**
 * Day-wise analysis engine (Phase R2).
 *
 * Groups samples by their day bucket and computes per-day statistics used by
 * the day-wise table, the day-comparison table and the comparison charts.
 * Operates on whatever sample set it is handed (already filtered) — it does
 * not re-parse the source CSV.
 */

import type { GapSample } from '@/types/gap';
import { isSynced, sessionCounts, summarise } from '@/utils/statistics';

export interface DayStat {
  day: string;
  samples: number;
  avgGap: number | null;
  medianGap: number | null;
  maxGap: number | null;
  minGap: number | null;
  /** max − min of the Gap field. */
  range: number | null;
  stdDev: number | null;
  /** Share of in-sync samples, 0–100. */
  syncQualityPct: number | null;
  /** Session with the most samples that day. */
  mostCommonSession: string;
  /**
   * Data-quality proxy, 0–100: share of the day's samples that are "complete"
   * (parseable timestamp AND a numeric Gap value).
   */
  dataQualityPct: number | null;
}

/** Returns the most frequently observed session label, or "—" when empty. */
export function mostCommonSession(samples: GapSample[]): string {
  const counts = sessionCounts(samples);
  let best = '—';
  let bestCount = -1;
  for (const [session, count] of Object.entries(counts)) {
    if (count > bestCount) {
      best = session;
      bestCount = count;
    }
  }
  return best;
}

/** Data-completeness proxy for a sample set (0–100). */
export function dataQualityPct(samples: GapSample[]): number | null {
  if (samples.length === 0) return null;
  const complete = samples.filter(
    (s) => s.timestampMs !== null && s.gap !== null,
  ).length;
  return (complete / samples.length) * 100;
}

/** Sync quality (0–100) for a sample set. */
function syncQuality(samples: GapSample[]): number | null {
  if (samples.length === 0) return null;
  const ok = samples.filter((s) => isSynced(s.syncStatus)).length;
  return (ok / samples.length) * 100;
}

/** Computes per-day statistics for one bucket of samples. */
export function computeDayStat(day: string, samples: GapSample[]): DayStat {
  const gaps = summarise(samples.map((s) => s.gap));
  const range =
    gaps.max !== null && gaps.min !== null ? gaps.max - gaps.min : null;

  return {
    day,
    samples: samples.length,
    avgGap: gaps.mean,
    medianGap: gaps.median,
    maxGap: gaps.max,
    minGap: gaps.min,
    range,
    stdDev: gaps.stdDev,
    syncQualityPct: syncQuality(samples),
    mostCommonSession: mostCommonSession(samples),
    dataQualityPct: dataQualityPct(samples),
  };
}

/**
 * Groups samples by day key and returns per-day statistics, sorted by day.
 * `unknown` day buckets are included last so corrupt-timestamp rows remain
 * visible rather than silently dropped.
 */
export function computeDayStats(samples: GapSample[]): DayStat[] {
  const byDay = new Map<string, GapSample[]>();
  for (const s of samples) {
    const bucket = byDay.get(s.dayKey);
    if (bucket) bucket.push(s);
    else byDay.set(s.dayKey, [s]);
  }

  const stats = [...byDay.entries()].map(([day, group]) =>
    computeDayStat(day, group),
  );

  stats.sort((a, b) => {
    if (a.day === 'unknown') return 1;
    if (b.day === 'unknown') return -1;
    return a.day.localeCompare(b.day);
  });

  return stats;
}
