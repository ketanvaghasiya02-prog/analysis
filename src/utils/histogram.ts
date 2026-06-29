/**
 * Gap distribution / binning engine (Phase R3).
 *
 * Buckets samples into fixed-width gap zones and computes per-zone statistics
 * for the histogram, the zone summary table and the selected-zone panel.
 * Pure — operates on whatever (already filtered) sample set it is handed.
 */

import type { GapSample } from '@/types/gap';

export const DEFAULT_BIN_SIZE = 0.5;

export interface GapZone {
  /** Zero-based zone index, ascending by gap value. */
  index: number;
  /** Stable id (derived from the lower bound) for selection across rerenders. */
  id: string;
  /** Inclusive lower bound. */
  low: number;
  /** Exclusive upper bound (inclusive for the final zone). */
  high: number;
  /** Display label, e.g. "13.50 – 14.00". */
  label: string;
  count: number;
  /** Share of all gap-bearing samples, 0–100. */
  percentage: number;
  /** ServerTime of the earliest sample in the zone (chronological). */
  firstSeen: string | null;
  /** ServerTime of the latest sample in the zone. */
  lastSeen: string | null;
  avgGap: number | null;
  maxGap: number | null;
  minGap: number | null;
  /** Distinct sessions observed in the zone. */
  sessions: string[];
}

/** Number of decimals to show for a given bin size. */
function decimalsFor(binSize: number): number {
  const s = String(binSize);
  const dot = s.indexOf('.');
  const dec = dot === -1 ? 0 : s.length - dot - 1;
  return Math.min(6, Math.max(2, dec));
}

/** Builds a stable zone id from its lower bound. */
function zoneId(low: number): string {
  return low.toFixed(6);
}

interface ZoneAccumulator {
  count: number;
  sum: number;
  min: number;
  max: number;
  firstSeen: string | null;
  lastSeen: string | null;
  sessions: Set<string>;
}

/**
 * Bins gap-bearing samples into contiguous zones of width `binSize`.
 * Empty interior zones are preserved so the histogram stays continuous.
 *
 * Assumes `samples` is roughly chronological (the merged dataset is sorted by
 * timestamp), so first/last-seen are taken from encounter order.
 */
export function buildGapZones(
  samples: GapSample[],
  binSize: number,
): GapZone[] {
  const size = binSize > 0 ? binSize : DEFAULT_BIN_SIZE;

  const withGap = samples.filter(
    (s): s is GapSample & { gap: number } =>
      s.gap !== null && Number.isFinite(s.gap),
  );
  if (withGap.length === 0) return [];

  let minGap = Number.POSITIVE_INFINITY;
  let maxGap = Number.NEGATIVE_INFINITY;
  for (const s of withGap) {
    if (s.gap < minGap) minGap = s.gap;
    if (s.gap > maxGap) maxGap = s.gap;
  }

  // Align the grid to multiples of the bin size.
  const start = Math.floor(minGap / size) * size;
  const zoneCount = Math.max(1, Math.floor((maxGap - start) / size + 1e-9) + 1);

  const acc: ZoneAccumulator[] = Array.from({ length: zoneCount }, () => ({
    count: 0,
    sum: 0,
    min: Number.POSITIVE_INFINITY,
    max: Number.NEGATIVE_INFINITY,
    firstSeen: null,
    lastSeen: null,
    sessions: new Set<string>(),
  }));

  for (const s of withGap) {
    let idx = Math.floor((s.gap - start) / size + 1e-9);
    if (idx < 0) idx = 0;
    if (idx >= zoneCount) idx = zoneCount - 1;
    const z = acc[idx]!;

    z.count += 1;
    z.sum += s.gap;
    if (s.gap < z.min) z.min = s.gap;
    if (s.gap > z.max) z.max = s.gap;
    if (s.currentSession) z.sessions.add(s.currentSession);
    if (z.firstSeen === null && s.serverTime) z.firstSeen = s.serverTime;
    if (s.serverTime) z.lastSeen = s.serverTime;
  }

  const decimals = decimalsFor(size);
  const total = withGap.length;

  return acc.map((z, i) => {
    const low = start + i * size;
    const high = low + size;
    return {
      index: i,
      id: zoneId(low),
      low,
      high,
      label: `${low.toFixed(decimals)} – ${high.toFixed(decimals)}`,
      count: z.count,
      percentage: total > 0 ? (z.count / total) * 100 : 0,
      firstSeen: z.firstSeen,
      lastSeen: z.lastSeen,
      avgGap: z.count > 0 ? z.sum / z.count : null,
      maxGap: z.count > 0 ? z.max : null,
      minGap: z.count > 0 ? z.min : null,
      sessions: [...z.sessions].sort(),
    };
  });
}

/** Finds a zone by its stable id. */
export function findZone(
  zones: GapZone[],
  id: string | null,
): GapZone | null {
  if (id === null) return null;
  return zones.find((z) => z.id === id) ?? null;
}
