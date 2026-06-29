/**
 * Overview Dashboard 2.0 statistics engine (additive, read-only).
 *
 * Pure statistical descriptions of the uploaded CSV history. This module does
 * NOT simulate trades and does NOT reimplement the Research Engine — sections
 * that need position/recovery numbers consume `computeScenario` (Research Engine
 * v1.0) via `buildReferenceScenario` elsewhere. Everything here is descriptive
 * statistics over the already-filtered samples.
 */

import type { GapSample } from '@/types/gap';
import type { ValidationReport } from '@/utils/validation';
import type { ScenarioInput } from '@/utils/scenario';
import { percentile } from '@/utils/statistics';

/** Numeric gap values from samples (nulls dropped). */
export function gapValues(samples: GapSample[]): number[] {
  const out: number[] = [];
  for (const s of samples) if (s.gap !== null && Number.isFinite(s.gap)) out.push(s.gap);
  return out;
}

export interface GapStats {
  count: number;
  current: number | null;
  avg: number | null;
  median: number | null;
  mode: number | null;
  min: number | null;
  max: number | null;
  range: number | null;
  stdDev: number | null;
  variance: number | null;
  p95: number | null;
  p99: number | null;
  avgDailyGap: number | null;
  avgHourlyGap: number | null;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Most frequent gap value, rounded to 2 decimals. */
function modeOf(values: number[]): number | null {
  if (values.length === 0) return null;
  const counts = new Map<number, number>();
  let best: number | null = null;
  let bestCount = -1;
  for (const v of values) {
    const k = Math.round(v * 100) / 100;
    const c = (counts.get(k) ?? 0) + 1;
    counts.set(k, c);
    if (c > bestCount) {
      bestCount = c;
      best = k;
    }
  }
  return best;
}

export function computeGapStats(samples: GapSample[]): GapStats {
  const vals = gapValues(samples);
  if (vals.length === 0) {
    return {
      count: 0, current: null, avg: null, median: null, mode: null, min: null,
      max: null, range: null, stdDev: null, variance: null, p95: null, p99: null,
      avgDailyGap: null, avgHourlyGap: null,
    };
  }

  const avg = mean(vals)!;
  const variance = vals.reduce((a, v) => a + (v - avg) ** 2, 0) / vals.length;
  const min = Math.min(...vals);
  const max = Math.max(...vals);

  // Current = the most recent sample with a gap (samples are chronological).
  let current: number | null = null;
  for (let i = samples.length - 1; i >= 0; i -= 1) {
    if (samples[i]!.gap !== null) {
      current = samples[i]!.gap;
      break;
    }
  }

  // Average daily gap = mean of per-day average gaps.
  const byDay = new Map<string, number[]>();
  // Average hourly gap = mean of per-hour-of-day average gaps.
  const byHour = new Map<number, number[]>();
  for (const s of samples) {
    if (s.gap === null) continue;
    (byDay.get(s.dayKey) ?? byDay.set(s.dayKey, []).get(s.dayKey)!).push(s.gap);
    const hour =
      s.timestampMs !== null ? new Date(s.timestampMs).getUTCHours() : -1;
    (byHour.get(hour) ?? byHour.set(hour, []).get(hour)!).push(s.gap);
  }
  const dailyAverages = [...byDay.values()].map((g) => mean(g)!);
  const hourlyAverages = [...byHour.values()].map((g) => mean(g)!);

  return {
    count: vals.length,
    current,
    avg,
    median: percentile(vals, 50),
    mode: modeOf(vals),
    min,
    max,
    range: max - min,
    stdDev: Math.sqrt(variance),
    variance,
    p95: percentile(vals, 95),
    p99: percentile(vals, 99),
    avgDailyGap: mean(dailyAverages),
    avgHourlyGap: mean(hourlyAverages),
  };
}

export interface DistributionPoint {
  x: number; // bin center gap value
  low: number;
  high: number;
  count: number;
  density: number; // empirical pdf
  cumulative: number; // 0–100 cdf
  normal: number; // fitted normal pdf
}

export interface GapDistribution {
  points: DistributionPoint[];
  mean: number | null;
  median: number | null;
  mode: number | null;
  p95: number | null;
  p99: number | null;
  total: number;
}

const SQRT_2PI = Math.sqrt(2 * Math.PI);

export function buildGapDistribution(
  samples: GapSample[],
  bins = 40,
): GapDistribution {
  const vals = gapValues(samples);
  const stats = computeGapStats(samples);
  if (vals.length === 0 || stats.min === null || stats.max === null) {
    return { points: [], mean: null, median: null, mode: null, p95: null, p99: null, total: 0 };
  }
  const min = stats.min;
  const max = stats.max;
  const width = (max - min) / Math.max(1, bins) || 1;
  const counts = new Array(bins).fill(0);
  for (const v of vals) {
    let idx = Math.floor((v - min) / width);
    if (idx < 0) idx = 0;
    if (idx >= bins) idx = bins - 1;
    counts[idx] += 1;
  }
  const total = vals.length;
  const mu = stats.avg ?? 0;
  const sigma = stats.stdDev && stats.stdDev > 0 ? stats.stdDev : 1;

  let cum = 0;
  const points: DistributionPoint[] = counts.map((count: number, i: number) => {
    const low = min + i * width;
    const high = low + width;
    const x = low + width / 2;
    cum += count;
    const normal =
      (1 / (sigma * SQRT_2PI)) * Math.exp(-((x - mu) ** 2) / (2 * sigma * sigma));
    return {
      x,
      low,
      high,
      count,
      density: total > 0 ? count / (total * width) : 0,
      cumulative: total > 0 ? (cum / total) * 100 : 0,
      normal,
    };
  });

  return {
    points,
    mean: stats.avg,
    median: stats.median,
    mode: stats.mode,
    p95: stats.p95,
    p99: stats.p99,
    total,
  };
}

export interface FrequencyRow {
  gap: number;
  occurrences: number;
  percentage: number;
  cumulative: number;
}

/** Frequency table bucketed to `step` (default 0.5). */
export function buildFrequencyTable(samples: GapSample[], step = 0.5): FrequencyRow[] {
  const vals = gapValues(samples);
  if (vals.length === 0) return [];
  const buckets = new Map<number, number>();
  for (const v of vals) {
    const b = Math.round(v / step) * step;
    buckets.set(b, (buckets.get(b) ?? 0) + 1);
  }
  const total = vals.length;
  const sorted = [...buckets.entries()].sort((a, b) => a[0] - b[0]);
  let cum = 0;
  return sorted.map(([gap, occurrences]) => {
    cum += occurrences;
    return {
      gap,
      occurrences,
      percentage: (occurrences / total) * 100,
      cumulative: (cum / total) * 100,
    };
  });
}

export interface DatasetInfo {
  filesLoaded: number;
  tradingDays: number;
  dateRange: { start: string | null; end: string | null };
  totalSamples: number;
  rowsIgnored: number;
  duplicateRows: number;
  missingSamples: number;
}

export function buildDatasetInfo(
  filteredSamples: GapSample[],
  validation: ValidationReport,
): DatasetInfo {
  const days = new Set(filteredSamples.map((s) => s.dayKey));
  days.delete('unknown');
  const realDays = [...days].sort();
  return {
    filesLoaded: validation.filesUploaded,
    tradingDays: days.size,
    dateRange: {
      start: realDays[0] ?? null,
      end: realDays[realDays.length - 1] ?? null,
    },
    totalSamples: filteredSamples.length,
    rowsIgnored: validation.invalidRows,
    duplicateRows: validation.duplicateTimestampCount,
    missingSamples: filteredSamples.filter((s) => s.gap === null).length,
  };
}

export type QualityBand = 'green' | 'yellow' | 'red';

export interface DataQuality {
  validSamples: number;
  invalidSamples: number;
  duplicateSamples: number;
  missingSamples: number;
  syncFailures: number;
  coveragePct: number;
  confidenceScore: number;
  band: QualityBand;
}

function isSyncedStatus(status: string): boolean {
  const s = status.trim().toUpperCase();
  return s === 'SYNCED' || s === 'OK' || s === 'IN_SYNC' || s === 'INSYNC';
}

export function buildDataQuality(
  filteredSamples: GapSample[],
  validation: ValidationReport,
): DataQuality {
  const valid = filteredSamples.length;
  const invalid = validation.invalidRows;
  const missing = filteredSamples.filter((s) => s.gap === null).length;
  const syncFailures = filteredSamples.filter((s) => !isSyncedStatus(s.syncStatus)).length;
  const totalRows = valid + invalid;
  const coveragePct = totalRows > 0 ? (valid / totalRows) * 100 : 0;
  const syncPct = valid > 0 ? ((valid - syncFailures) / valid) * 100 : 0;
  const missingPct = valid > 0 ? (missing / valid) * 100 : 0;

  // Composite 0–100 confidence.
  const score = Math.max(
    0,
    Math.min(
      100,
      coveragePct * 0.4 + syncPct * 0.4 + (100 - missingPct) * 0.2,
    ),
  );
  const band: QualityBand = score >= 90 ? 'green' : score >= 70 ? 'yellow' : 'red';

  return {
    validSamples: valid,
    invalidSamples: invalid,
    duplicateSamples: validation.duplicateTimestampCount,
    missingSamples: missing,
    syncFailures,
    coveragePct,
    confidenceScore: score,
    band,
  };
}

export interface RareGapLevel {
  threshold: number;
  occurrences: number;
  percentage: number;
  firstSeen: string | null;
  lastSeen: string | null;
  maxExpansion: number | null;
}

/**
 * Detects rare high-gap levels. Thresholds step down from the maximum so the
 * tail of the distribution is described (occurrences at/above each level).
 */
export function buildRareGaps(samples: GapSample[], step = 1): RareGapLevel[] {
  const vals = gapValues(samples);
  if (vals.length === 0) return [];
  const max = Math.max(...vals);
  const total = vals.length;

  // Up to 6 descending thresholds from floor(max).
  const top = Math.floor(max / step) * step;
  const thresholds: number[] = [];
  for (let t = top; thresholds.length < 6 && t > 0; t -= step) thresholds.push(t);

  return thresholds.map((threshold) => {
    const hit = samples.filter((s) => s.gap !== null && s.gap >= threshold);
    let first: string | null = null;
    let last: string | null = null;
    let maxExp = -Infinity;
    for (const s of hit) {
      if (first === null) first = s.serverTime;
      last = s.serverTime;
      if (s.gap! > maxExp) maxExp = s.gap!;
    }
    return {
      threshold,
      occurrences: hit.length,
      percentage: total > 0 ? (hit.length / total) * 100 : 0,
      firstSeen: first,
      lastSeen: last,
      maxExpansion: hit.length > 0 ? maxExp : null,
    };
  });
}

export interface MarketSummary {
  tradingDays: number;
  totalSamples: number;
  averageGap: number | null;
  /** 95% central range (2.5th–97.5th percentile). */
  range95: { low: number | null; high: number | null };
  rareThreshold: number | null;
  rarePct: number | null;
  largestGap: number | null;
  confidence: string;
}

/** Auto-generates a descriptive market summary from the statistics. */
export function buildMarketSummary(
  samples: GapSample[],
  info: DatasetInfo,
  confidence: string,
): MarketSummary {
  const vals = gapValues(samples);
  const stats = computeGapStats(samples);
  const round2 = (n: number | null) => (n === null ? null : Math.round(n * 100) / 100);
  const rareThreshold = round2(percentile(vals, 99));
  const rareCount =
    rareThreshold !== null
      ? vals.filter((v) => v >= rareThreshold).length
      : 0;
  return {
    tradingDays: info.tradingDays,
    totalSamples: info.totalSamples,
    averageGap: round2(stats.avg),
    range95: { low: round2(percentile(vals, 2.5)), high: round2(percentile(vals, 97.5)) },
    rareThreshold,
    rarePct: vals.length > 0 ? (rareCount / vals.length) * 100 : null,
    largestGap: round2(stats.max),
    confidence,
  };
}

/**
 * Builds a reference ScenarioInput from the data's own distribution so the
 * Research Engine produces meaningful positions for the descriptive overview.
 * Entry = P75 gap, Recovery = P25 gap, Stop Loss = P95 gap.
 */
export function buildReferenceScenario(samples: GapSample[]): ScenarioInput {
  const vals = gapValues(samples);
  const round2 = (n: number | null) => (n === null ? 0 : Math.round(n * 100) / 100);
  const entry = round2(percentile(vals, 75));
  const recovery = round2(percentile(vals, 25));
  let sl = round2(percentile(vals, 95));
  if (sl <= entry) sl = round2(entry + (vals.length ? 0.5 : 0));
  return {
    entryGap: entry,
    recoveryGap: recovery,
    stopLoss: sl,
    maxHoldingMinutes: null,
    sameDayOnly: true,
    sessions: [],
    syncStatuses: [],
    minEvents: 10,
  };
}
