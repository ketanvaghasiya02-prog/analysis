/**
 * Maximum Adverse Excursion (MAE) engine (Phase R6).
 *
 * Even events that ultimately recover often first EXPAND to a higher gap before
 * coming back. For stop-loss research we measure, for each event, the maximum
 * gap reached after entry before recovery / day-end / dataset-end, then split
 * events into recovered vs failed and summarise each group's max-gap distribution.
 *
 * Recovery here means returning to the zone low (gap <= zone.low), consistent
 * with the recovery-matrix aggregate. Pure — reuses detected events and the
 * shared sample array; no CSV is re-parsed.
 */

import type { GapSample } from '@/types/gap';
import type { GapZone } from '@/utils/histogram';
import type { ZoneEvent } from '@/utils/events';
import { percentile } from '@/utils/statistics';

const EPS = 1e-9;

export interface EventMae {
  eventId: string;
  zoneId: string;
  date: string;
  entryTime: string;
  entryGap: number;
  /** Highest gap reached from entry (inclusive) before recovery/boundary. */
  maxGap: number;
  /** maxGap − entryGap (≥ 0). */
  adverseExpansion: number;
  recovered: boolean;
  /** Zone low when recovered, else null. */
  recoveryTargetReached: number | null;
  recoveryTimeSec: number | null;
}

export interface MaeStats {
  count: number;
  avg: number | null;
  median: number | null;
  p75: number | null;
  p90: number | null;
  p95: number | null;
  p99: number | null;
  /** Worst (largest) observed max gap. */
  worst: number | null;
}

export interface ZoneMae {
  zoneId: string;
  zoneLow: number;
  zoneHigh: number;
  label: string;
  totalEvents: number;
  recovered: EventMae[];
  failed: EventMae[];
  recoveredStats: MaeStats;
  failedStats: MaeStats;
}

export interface MaeAnalysis {
  zones: ZoneMae[];
}

/** Computes max-gap distribution statistics for a group of events. */
export function computeMaeStats(events: EventMae[]): MaeStats {
  const maxGaps = events.map((e) => e.maxGap);
  if (maxGaps.length === 0) {
    return {
      count: 0,
      avg: null,
      median: null,
      p75: null,
      p90: null,
      p95: null,
      p99: null,
      worst: null,
    };
  }
  const sum = maxGaps.reduce((a, b) => a + b, 0);
  return {
    count: maxGaps.length,
    avg: sum / maxGaps.length,
    median: percentile(maxGaps, 50),
    p75: percentile(maxGaps, 75),
    p90: percentile(maxGaps, 90),
    p95: percentile(maxGaps, 95),
    p99: percentile(maxGaps, 99),
    worst: Math.max(...maxGaps),
  };
}

/** Computes the MAE of a single event by scanning forward to recovery/boundary. */
export function computeEventMae(
  samples: GapSample[],
  event: ZoneEvent,
  zoneLow: number,
): EventMae {
  const entry = samples[event.startIndex]!;
  const entryGap = event.entryGap;
  const entryTs = entry.timestampMs;

  let maxGap = entryGap; // include entry so adverse expansion is ≥ 0
  let recovered = false;
  let recoveryTimeSec: number | null = null;

  for (let j = event.startIndex + 1; j <= event.dayBoundaryIndex; j += 1) {
    const s = samples[j]!;
    if (s.dayKey !== event.date) break; // server day changed
    if (s.gap === null) continue;

    if (s.gap <= zoneLow + EPS) {
      recovered = true;
      if (entryTs !== null && s.timestampMs !== null) {
        recoveryTimeSec = (s.timestampMs - entryTs) / 1000;
      }
      break;
    }
    if (s.gap > maxGap) maxGap = s.gap;
  }

  return {
    eventId: event.id,
    zoneId: event.zoneId,
    date: event.date,
    entryTime: event.entryTime,
    entryGap,
    maxGap,
    adverseExpansion: maxGap - entryGap,
    recovered,
    recoveryTargetReached: recovered ? zoneLow : null,
    recoveryTimeSec,
  };
}

/** Builds the MAE analysis across all zones. */
export function buildMaeAnalysis(
  samples: GapSample[],
  zones: GapZone[],
  events: ZoneEvent[],
): MaeAnalysis {
  const eventsByZone = new Map<string, ZoneEvent[]>();
  for (const e of events) {
    const list = eventsByZone.get(e.zoneId);
    if (list) list.push(e);
    else eventsByZone.set(e.zoneId, [e]);
  }

  const zoneResults: ZoneMae[] = zones.map((zone) => {
    const zoneEvents = eventsByZone.get(zone.id) ?? [];
    const recovered: EventMae[] = [];
    const failed: EventMae[] = [];

    for (const event of zoneEvents) {
      const mae = computeEventMae(samples, event, zone.low);
      if (mae.recovered) recovered.push(mae);
      else failed.push(mae);
    }

    return {
      zoneId: zone.id,
      zoneLow: zone.low,
      zoneHigh: zone.high,
      label: zone.label,
      totalEvents: zoneEvents.length,
      recovered,
      failed,
      recoveredStats: computeMaeStats(recovered),
      failedStats: computeMaeStats(failed),
    };
  });

  return { zones: zoneResults };
}

export interface MaeDistributionBin {
  label: string;
  low: number;
  high: number;
  recovered: number;
  failed: number;
}

/**
 * Bins the max-gap values of a zone's recovered + failed events into a small
 * number of buckets for the distribution chart.
 */
export function buildMaeDistribution(
  zone: ZoneMae,
  binCount = 16,
): MaeDistributionBin[] {
  const all = [...zone.recovered, ...zone.failed].map((e) => e.maxGap);
  if (all.length === 0) return [];

  let min = Math.min(...all);
  let max = Math.max(...all);
  if (min === max) {
    // Single value — one bin.
    return [
      {
        label: min.toFixed(2),
        low: min,
        high: max,
        recovered: zone.recovered.length,
        failed: zone.failed.length,
      },
    ];
  }

  const bins = Math.max(1, binCount);
  const width = (max - min) / bins;
  const result: MaeDistributionBin[] = Array.from({ length: bins }, (_, i) => {
    const low = min + i * width;
    const high = low + width;
    return {
      label: `${low.toFixed(2)}`,
      low,
      high,
      recovered: 0,
      failed: 0,
    };
  });

  const place = (value: number): number => {
    let idx = Math.floor((value - min) / width);
    if (idx < 0) idx = 0;
    if (idx >= bins) idx = bins - 1;
    return idx;
  };

  for (const e of zone.recovered) result[place(e.maxGap)]!.recovered += 1;
  for (const e of zone.failed) result[place(e.maxGap)]!.failed += 1;

  return result;
}
