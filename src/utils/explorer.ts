/**
 * Event explorer & replay engine (Phase R9).
 *
 * Produces a rich per-event record for a zone (entry, max adverse excursion,
 * recovery, indices) and builds a replay series around a chosen event — the gap
 * line from ~10 minutes before entry until recovery / day-end / dataset-end,
 * with the positions of the key markers.
 *
 * Pure — reuses detected events and the shared sample array; no CSV is re-parsed.
 */

import type { GapSample } from '@/types/gap';
import type { ZoneEvent } from '@/utils/events';

const EPS = 1e-9;

export interface ExplorerEvent {
  eventId: string;
  zoneId: string;
  zoneLow: number;
  zoneHigh: number;
  date: string;
  entryTime: string;
  entryGap: number;
  session: string;
  syncStatus: string;

  startIndex: number;
  dayBoundaryIndex: number;

  maxGap: number;
  adverseExpansion: number;
  maxIndex: number;

  recovered: boolean;
  recoveryTarget: number | null;
  recoveryTimeSec: number | null;
  recoveryIndex: number | null;

  /** Last index of the replay window (recovery if recovered, else day boundary). */
  endIndex: number;
}

/** Builds explorer records for a zone's events. */
export function buildExplorerEvents(
  samples: GapSample[],
  zoneEvents: ZoneEvent[],
  zoneLow: number,
  zoneHigh: number,
): ExplorerEvent[] {
  return zoneEvents.map((event) => {
    const entry = samples[event.startIndex]!;
    const entryGap = event.entryGap;
    const entryTs = entry.timestampMs;

    let maxGap = entryGap;
    let maxIndex = event.startIndex;
    let recovered = false;
    let recoveryIndex: number | null = null;
    let recoveryTimeSec: number | null = null;

    for (let j = event.startIndex + 1; j <= event.dayBoundaryIndex; j += 1) {
      const s = samples[j]!;
      if (s.dayKey !== event.date) break;
      if (s.gap === null) continue;

      if (s.gap <= zoneLow + EPS) {
        recovered = true;
        recoveryIndex = j;
        if (entryTs !== null && s.timestampMs !== null) {
          recoveryTimeSec = (s.timestampMs - entryTs) / 1000;
        }
        break;
      }
      if (s.gap > maxGap) {
        maxGap = s.gap;
        maxIndex = j;
      }
    }

    return {
      eventId: event.id,
      zoneId: event.zoneId,
      zoneLow,
      zoneHigh,
      date: event.date,
      entryTime: event.entryTime,
      entryGap,
      session: event.session,
      syncStatus: event.syncStatus,
      startIndex: event.startIndex,
      dayBoundaryIndex: event.dayBoundaryIndex,
      maxGap,
      adverseExpansion: maxGap - entryGap,
      maxIndex,
      recovered,
      recoveryTarget: recovered ? zoneLow : null,
      recoveryTimeSec,
      recoveryIndex,
      endIndex: recovered && recoveryIndex !== null
        ? recoveryIndex
        : event.dayBoundaryIndex,
    };
  });
}

/** True when the event would have been stopped at the given SL gap level. */
export function wouldStopAt(event: ExplorerEvent, slLevel: number): boolean {
  return event.maxGap > slLevel + EPS;
}

export interface ReplayPoint {
  i: number;
  gap: number;
  time: string;
  globalIndex: number;
}

export interface ReplaySeries {
  points: ReplayPoint[];
  entryPos: number | null;
  maxPos: number | null;
  recoveryPos: number | null;
  dayBoundaryPos: number | null;
}

/**
 * Builds the replay series for one event: gap samples from ~`lookbackSec`
 * before entry through the event's end index, plus the local positions of the
 * entry, max-adverse, recovery and day-boundary markers.
 */
export function buildReplaySeries(
  samples: GapSample[],
  event: ExplorerEvent,
  lookbackSec = 600,
): ReplaySeries {
  const entryTs = samples[event.startIndex]?.timestampMs ?? null;

  // Find the window start ~lookbackSec before entry.
  let start = event.startIndex;
  if (entryTs !== null) {
    const cutoff = entryTs - lookbackSec * 1000;
    while (start > 0) {
      const prev = samples[start - 1]!;
      if (prev.timestampMs !== null && prev.timestampMs < cutoff) break;
      start -= 1;
    }
  } else {
    start = Math.max(0, event.startIndex - 60);
  }

  const end = Math.min(samples.length - 1, event.endIndex);

  const points: ReplayPoint[] = [];
  const posByGlobal = new Map<number, number>();
  for (let g = start; g <= end; g += 1) {
    const s = samples[g]!;
    if (s.gap === null) continue;
    posByGlobal.set(g, points.length);
    points.push({
      i: points.length,
      gap: s.gap,
      time: s.serverTime,
      globalIndex: g,
    });
  }

  const nearestPos = (globalIndex: number): number | null => {
    if (posByGlobal.has(globalIndex)) return posByGlobal.get(globalIndex)!;
    // Fall back to the closest earlier plotted sample.
    for (let g = globalIndex; g >= start; g -= 1) {
      if (posByGlobal.has(g)) return posByGlobal.get(g)!;
    }
    return null;
  };

  const dayBoundaryPos =
    event.dayBoundaryIndex <= end ? nearestPos(event.dayBoundaryIndex) : null;

  return {
    points,
    entryPos: nearestPos(event.startIndex),
    maxPos: nearestPos(event.maxIndex),
    recoveryPos:
      event.recoveryIndex !== null ? nearestPos(event.recoveryIndex) : null,
    dayBoundaryPos,
  };
}
