/**
 * Zone event-detection engine (Phase R4).
 *
 * Event definition:
 *   A zone event occurs when the gap ENTERS a zone from below — i.e. the
 *   previous sample's gap is strictly below the zone's lower bound and the
 *   current sample's gap is at or above it.
 *
 *     Zone = [18.00, 18.50)
 *     prev.gap < 18.00  AND  cur.gap >= 18.00   →  one event
 *
 * A single continuous stay inside (or above) a zone produces exactly one event:
 * because an event requires the previous sample to be below the lower bound,
 * samples that merely remain at/above it never re-trigger. The gap must dip
 * back below the bound and cross it again to create a new event.
 *
 * Pure — operates on an ordered (chronological) sample array, typically the
 * shared `filteredSamples`. No CSV is re-parsed.
 */

import type { GapSample } from '@/types/gap';
import type { GapZone } from '@/utils/histogram';
import { isSynced } from '@/utils/statistics';

export type EventQuality =
  | 'valid'
  | 'invalid'
  | 'day-ended-before-recovery'
  | 'dataset-ended-before-recovery';

export const EVENT_QUALITY_LABELS: Record<EventQuality, string> = {
  valid: 'Valid event',
  invalid: 'Invalid event',
  'day-ended-before-recovery': 'Day ended before recovery',
  'dataset-ended-before-recovery': 'Dataset ended before recovery',
};

export interface ZoneEvent {
  id: string;
  zoneId: string;
  zoneLow: number;
  zoneHigh: number;
  /** Day bucket (YYYY-MM-DD) of the entry sample. */
  date: string;
  /** ServerTime of the entry sample. */
  entryTime: string;
  /** Gap value at entry. */
  entryGap: number;
  session: string;
  syncStatus: string;
  /** Index of the entry sample within the analysed array. */
  startIndex: number;
  /** Index of the last sample sharing the entry's day (recovery window end). */
  dayBoundaryIndex: number;
  /** Index at which the gap recovered below the zone low, or null. */
  recoveryIndex: number | null;
  quality: EventQuality;
}

export interface EventDetectionResult {
  events: ZoneEvent[];
  /** Event count keyed by zone id. */
  countByZone: Record<string, number>;
  /** Event count keyed by quality classification. */
  countByQuality: Record<EventQuality, number>;
}

/** Builds a map of dayKey → last sample index (recovery-window boundary). */
function lastIndexByDay(samples: GapSample[]): Map<string, number> {
  const map = new Map<string, number>();
  for (let i = 0; i < samples.length; i += 1) {
    map.set(samples[i]!.dayKey, i);
  }
  return map;
}

/**
 * Classifies an event by scanning forward for a recovery (gap dropping back
 * below the zone low) within the entry's day.
 *
 *  - invalid: the entry tick is not in-sync, so the crossing is unreliable.
 *  - valid: the gap recovered below the zone low within the same day.
 *  - day-ended-before-recovery: the day ended while still at/above the bound,
 *    and more days follow in the dataset.
 *  - dataset-ended-before-recovery: the dataset ended while still at/above the
 *    bound (this was the final day).
 */
function classifyEvent(
  samples: GapSample[],
  entry: GapSample,
  startIndex: number,
  dayBoundaryIndex: number,
  low: number,
): { quality: EventQuality; recoveryIndex: number | null } {
  if (!isSynced(entry.syncStatus)) {
    return { quality: 'invalid', recoveryIndex: null };
  }

  for (let j = startIndex + 1; j <= dayBoundaryIndex; j += 1) {
    const s = samples[j]!;
    if (s.dayKey !== entry.dayKey) break;
    if (s.gap !== null && s.gap < low) {
      return { quality: 'valid', recoveryIndex: j };
    }
  }

  const datasetEnded = dayBoundaryIndex >= samples.length - 1;
  return {
    quality: datasetEnded
      ? 'dataset-ended-before-recovery'
      : 'day-ended-before-recovery',
    recoveryIndex: null,
  };
}

/**
 * Detects zone-entry events across every zone for an ordered sample array.
 */
export function detectZoneEvents(
  samples: GapSample[],
  zones: GapZone[],
): EventDetectionResult {
  const countByZone: Record<string, number> = {};
  for (const z of zones) countByZone[z.id] = 0;

  const countByQuality: Record<EventQuality, number> = {
    valid: 0,
    invalid: 0,
    'day-ended-before-recovery': 0,
    'dataset-ended-before-recovery': 0,
  };

  const events: ZoneEvent[] = [];
  if (zones.length === 0 || samples.length < 2) {
    return { events, countByZone, countByQuality };
  }

  const dayLast = lastIndexByDay(samples);
  let counter = 0;

  for (let i = 1; i < samples.length; i += 1) {
    const prev = samples[i - 1]!;
    const cur = samples[i]!;
    if (prev.gap === null || cur.gap === null) continue;

    // Crossing from below covers every zone whose lower bound L satisfies
    // prev.gap < L <= cur.gap. Zones are sorted ascending by `low`.
    for (const zone of zones) {
      if (zone.low <= prev.gap) continue; // not crossed from below
      if (zone.low > cur.gap) break; // and nothing further can be crossed

      const startIndex = i;
      const dayBoundaryIndex = dayLast.get(cur.dayKey) ?? samples.length - 1;
      const { quality, recoveryIndex } = classifyEvent(
        samples,
        cur,
        startIndex,
        dayBoundaryIndex,
        zone.low,
      );

      counter += 1;
      events.push({
        id: `EVT-${String(counter).padStart(4, '0')}`,
        zoneId: zone.id,
        zoneLow: zone.low,
        zoneHigh: zone.high,
        date: cur.dayKey,
        entryTime: cur.serverTime,
        entryGap: cur.gap,
        session: cur.currentSession,
        syncStatus: cur.syncStatus,
        startIndex,
        dayBoundaryIndex,
        recoveryIndex,
        quality,
      });
      countByZone[zone.id] = (countByZone[zone.id] ?? 0) + 1;
      countByQuality[quality] += 1;
    }
  }

  return { events, countByZone, countByQuality };
}
