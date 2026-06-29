/**
 * Date-time range scoping for the Research Lab (additive).
 *
 * Narrows an (already globally filtered) sample array to a user-selected
 * start/end date-time window. Empty bounds mean "all uploaded data". Pure.
 */

import type { GapSample } from '@/types/gap';
import { parseTimestamp, formatDayLabel } from '@/utils/date';

export interface DateTimeRange {
  startDate: string | null;
  startTime: string | null;
  endDate: string | null;
  endTime: string | null;
}

export const EMPTY_DT_RANGE: DateTimeRange = {
  startDate: null,
  startTime: null,
  endDate: null,
  endTime: null,
};

function toMs(
  date: string | null,
  time: string | null,
  endOfDay: boolean,
): number | null {
  if (!date) return null;
  const t = time && time.length >= 4 ? `${time}:00` : endOfDay ? '23:59:59' : '00:00:00';
  return parseTimestamp(`${date} ${t}`);
}

export interface DateTimeBounds {
  startMs: number | null;
  endMs: number | null;
}

export function dateTimeBounds(range: DateTimeRange): DateTimeBounds {
  return {
    startMs: toMs(range.startDate, range.startTime, false),
    endMs: toMs(range.endDate, range.endTime, true),
  };
}

/** True when at least one bound is set. */
export function isDtRangeActive(range: DateTimeRange): boolean {
  return Boolean(range.startDate || range.endDate);
}

/**
 * Scopes samples to the range. With no bounds, returns the input unchanged
 * (including rows whose timestamp could not be parsed). When any bound is set,
 * only rows with a parseable timestamp inside the window are kept.
 */
export function scopeByDateTime(
  samples: GapSample[],
  range: DateTimeRange,
): GapSample[] {
  const { startMs, endMs } = dateTimeBounds(range);
  if (startMs === null && endMs === null) return samples;
  return samples.filter((s) => {
    if (s.timestampMs === null) return false;
    if (startMs !== null && s.timestampMs < startMs) return false;
    if (endMs !== null && s.timestampMs > endMs) return false;
    return true;
  });
}

/** Human label for the active range, or "All Uploaded Data". */
export function describeDtRange(range: DateTimeRange): string {
  if (!isDtRangeActive(range)) return 'All Uploaded Data';
  const startLabel = range.startDate
    ? `${formatDayLabel(range.startDate)}${range.startTime ? ` ${range.startTime}` : ''}`
    : 'start of data';
  const endLabel = range.endDate
    ? `${formatDayLabel(range.endDate)}${range.endTime ? ` ${range.endTime}` : ''}`
    : 'end of data';
  return `${startLabel} → ${endLabel}`;
}
