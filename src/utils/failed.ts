/**
 * Failed recovery analysis (Phase R8).
 *
 * A "failed" event is a zone event that did NOT recover to its zone low within
 * its own server day (the recovered=false set from the MAE/recovery model). For
 * each zone we summarise the failed events' max-gap distribution, break them
 * down by session and day, and — crucially — check whether each failed event
 * recovered LATER in the dataset (same day / next day / within 2 days / never).
 *
 * Pure — reuses detected events and the shared sample array; no CSV is re-parsed.
 */

import type { GapSample } from '@/types/gap';
import type { GapZone } from '@/utils/histogram';
import type { ZoneEvent } from '@/utils/events';
import { computeEventMae, computeMaeStats, type MaeStats } from '@/utils/mae';
import { parseTimestamp } from '@/utils/date';

const EPS = 1e-9;
const DAY_MS = 86_400_000;

export type PostFailureRecovery =
  | 'same-day'
  | 'next-day'
  | 'within-2-days'
  | 'later'
  | 'never';

export const POST_RECOVERY_LABELS: Record<PostFailureRecovery, string> = {
  'same-day': 'Same day',
  'next-day': 'Next day',
  'within-2-days': 'Within 2 days',
  later: 'Later (3+ days)',
  never: 'Never in dataset',
};

export const POST_RECOVERY_ORDER: PostFailureRecovery[] = [
  'same-day',
  'next-day',
  'within-2-days',
  'later',
  'never',
];

export interface FailedEvent {
  eventId: string;
  zoneId: string;
  date: string;
  entryTime: string;
  entryGap: number;
  maxGap: number;
  adverseExpansion: number;
  session: string;
  syncStatus: string;
  startIndex: number;
  dayBoundaryIndex: number;
  /** When the gap later returned to the zone low, if ever. */
  postRecovery: PostFailureRecovery;
  recoveryDate: string | null;
  recoveryTime: string | null;
  daysToRecovery: number | null;
}

export interface FailedZoneAnalysis {
  zoneId: string;
  zoneLow: number;
  zoneHigh: number;
  label: string;
  totalEvents: number;
  failedCount: number;
  failedPct: number;
  maxGapStats: MaeStats;
  bySession: Record<string, number>;
  byDay: Record<string, number>;
  postRecoveryCounts: Record<PostFailureRecovery, number>;
  events: FailedEvent[];
}

export interface FailedAnalysis {
  zones: FailedZoneAnalysis[];
}

/** Calendar-day difference between two YYYY-MM-DD day keys, or null. */
function dayDiff(fromDay: string, toDay: string): number | null {
  const a = parseTimestamp(`${fromDay} 00:00:00`);
  const b = parseTimestamp(`${toDay} 00:00:00`);
  if (a === null || b === null) return null;
  return Math.round((b - a) / DAY_MS);
}

function bucketForDiff(diff: number | null): PostFailureRecovery {
  if (diff === null) return 'never';
  if (diff <= 0) return 'same-day';
  if (diff === 1) return 'next-day';
  if (diff === 2) return 'within-2-days';
  return 'later';
}

/**
 * Scans the whole dataset forward from an event for the first later sample
 * whose gap returns to (or below) the zone low.
 */
function findLaterRecovery(
  samples: GapSample[],
  event: ZoneEvent,
  zoneLow: number,
): { date: string; time: string; daysToRecovery: number | null } | null {
  for (let j = event.startIndex + 1; j < samples.length; j += 1) {
    const s = samples[j]!;
    if (s.gap !== null && s.gap <= zoneLow + EPS) {
      return {
        date: s.dayKey,
        time: s.serverTime,
        daysToRecovery: dayDiff(event.date, s.dayKey),
      };
    }
  }
  return null;
}

/** Builds the failed recovery analysis across all zones. */
export function buildFailedAnalysis(
  samples: GapSample[],
  zones: GapZone[],
  events: ZoneEvent[],
): FailedAnalysis {
  const eventsByZone = new Map<string, ZoneEvent[]>();
  for (const e of events) {
    const list = eventsByZone.get(e.zoneId);
    if (list) list.push(e);
    else eventsByZone.set(e.zoneId, [e]);
  }

  const zoneResults: FailedZoneAnalysis[] = zones.map((zone) => {
    const zoneEvents = eventsByZone.get(zone.id) ?? [];
    const failedEvents: FailedEvent[] = [];
    const failedMae: ReturnType<typeof computeEventMae>[] = [];

    const bySession: Record<string, number> = {};
    const byDay: Record<string, number> = {};
    const postRecoveryCounts: Record<PostFailureRecovery, number> = {
      'same-day': 0,
      'next-day': 0,
      'within-2-days': 0,
      later: 0,
      never: 0,
    };

    for (const event of zoneEvents) {
      const mae = computeEventMae(samples, event, zone.low);
      if (mae.recovered) continue; // only failed events

      failedMae.push(mae);

      const later = findLaterRecovery(samples, event, zone.low);
      const bucket = later
        ? bucketForDiff(later.daysToRecovery)
        : 'never';

      const failed: FailedEvent = {
        eventId: event.id,
        zoneId: event.zoneId,
        date: event.date,
        entryTime: event.entryTime,
        entryGap: event.entryGap,
        maxGap: mae.maxGap,
        adverseExpansion: mae.adverseExpansion,
        session: event.session,
        syncStatus: event.syncStatus,
        startIndex: event.startIndex,
        dayBoundaryIndex: event.dayBoundaryIndex,
        postRecovery: bucket,
        recoveryDate: later?.date ?? null,
        recoveryTime: later?.time ?? null,
        daysToRecovery: later?.daysToRecovery ?? null,
      };

      failedEvents.push(failed);
      bySession[event.session] = (bySession[event.session] ?? 0) + 1;
      byDay[event.date] = (byDay[event.date] ?? 0) + 1;
      postRecoveryCounts[bucket] += 1;
    }

    const total = zoneEvents.length;
    return {
      zoneId: zone.id,
      zoneLow: zone.low,
      zoneHigh: zone.high,
      label: zone.label,
      totalEvents: total,
      failedCount: failedEvents.length,
      failedPct: total > 0 ? (failedEvents.length / total) * 100 : 0,
      maxGapStats: computeMaeStats(failedMae),
      bySession,
      byDay,
      postRecoveryCounts,
      events: failedEvents,
    };
  });

  return { zones: zoneResults };
}

export interface FailedMaxGapBin {
  label: string;
  low: number;
  high: number;
  count: number;
}

/** Bins failed-event max gaps for the distribution chart. */
export function buildFailedMaxGapDistribution(
  events: FailedEvent[],
  binCount = 16,
): FailedMaxGapBin[] {
  const values = events.map((e) => e.maxGap);
  if (values.length === 0) return [];

  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) {
    return [{ label: min.toFixed(2), low: min, high: max, count: values.length }];
  }

  const bins = Math.max(1, binCount);
  const width = (max - min) / bins;
  const result: FailedMaxGapBin[] = Array.from({ length: bins }, (_, i) => {
    const low = min + i * width;
    return { label: low.toFixed(2), low, high: low + width, count: 0 };
  });

  for (const v of values) {
    let idx = Math.floor((v - min) / width);
    if (idx < 0) idx = 0;
    if (idx >= bins) idx = bins - 1;
    result[idx]!.count += 1;
  }
  return result;
}
