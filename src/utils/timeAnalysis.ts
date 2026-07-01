/**
 * Time Analysis (new module) — pure, read-only.
 *
 * Analyses Spot / Future / Gap movement for a user-selected date + time window
 * over the ALREADY-parsed CSV samples. It never re-parses CSV, never calls the
 * Research/Probability engines, and computes no research metrics — only simple
 * descriptive statistics over the selected rows. Descriptive only; no
 * prediction, no recommendation.
 */

import type { GapSample } from '@/types/gap';
import { syncQualityPct } from '@/utils/statistics';

export interface TimeRangeInput {
  date: string; // YYYY-MM-DD (matches sample.dayKey)
  start: string; // HH:MM
  end: string; // HH:MM
}

export type RangeStatus = 'ok' | 'empty' | 'no-date' | 'invalid';

export interface SeriesPoint {
  time: string; // HH:MM (axis label)
  full: string; // HH:MM:SS (tooltip)
  spot: number | null;
  future: number | null;
  gap: number | null;
}

export interface TimeRangeStats {
  startTime: string;
  endTime: string;
  startSpot: number | null;
  endSpot: number | null;
  spotChange: number | null;
  startFuture: number | null;
  endFuture: number | null;
  futureChange: number | null;
  startGap: number | null;
  endGap: number | null;
  gapChange: number | null;
  maxGap: number | null;
  maxGapTime: string | null;
  minGap: number | null;
  minGapTime: string | null;
  avgGap: number | null;
  medianGap: number | null;
  gapRange: number | null;
  totalSamples: number;
  sessions: string[];
  syncQualityPct: number | null;
}

export interface TimeRangeResult {
  input: TimeRangeInput;
  status: RangeStatus;
  message: string | null;
  /** First / last sample time available on the selected date (nearest-range hint). */
  availableStart: string | null;
  availableEnd: string | null;
  series: SeriesPoint[];
  stats: TimeRangeStats | null;
  description: string;
}

/** Parses "HH:MM" or "HH:MM:SS" into seconds-of-day, or null. */
export function parseClock(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(s.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  const sec = m[3] ? Number(m[3]) : 0;
  if (h > 23 || min > 59 || sec > 59) return null;
  return h * 3600 + min * 60 + sec;
}

/** HH:MM slice of a time string. */
export function hhmm(time: string): string {
  return time.length >= 5 ? time.slice(0, 5) : time;
}

const spotOf = (s: GapSample): number | null => s.spotMid ?? s.spotBid ?? null;
const futureOf = (s: GapSample): number | null => s.futureMid ?? s.futureBid ?? null;

function mean(v: number[]): number | null {
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}
function median(v: number[]): number | null {
  if (v.length === 0) return null;
  const s = [...v].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}
function fmt(n: number | null, d = 2): string {
  return n === null || Number.isNaN(n)
    ? '—'
    : n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

/** Analyses one date + time window over the parsed samples. Pure. */
export function analyzeTimeRange(samples: GapSample[], input: TimeRangeInput): TimeRangeResult {
  const base: TimeRangeResult = {
    input,
    status: 'ok',
    message: null,
    availableStart: null,
    availableEnd: null,
    series: [],
    stats: null,
    description: '',
  };

  if (!input.date) {
    return { ...base, status: 'invalid', message: 'Date is required.' };
  }
  const startSec = parseClock(input.start);
  const endSec = parseClock(input.end);
  if (startSec === null || endSec === null) {
    return { ...base, status: 'invalid', message: 'Enter a valid start and end time.' };
  }
  if (startSec >= endSec) {
    return { ...base, status: 'invalid', message: 'Start time must be before end time.' };
  }

  // Rows for the selected date, chronological.
  const daySamples = samples
    .filter((s) => s.dayKey === input.date)
    .sort((a, b) => (parseClock(a.time) ?? 0) - (parseClock(b.time) ?? 0));

  if (daySamples.length === 0) {
    return { ...base, status: 'no-date', message: 'Selected date not found in uploaded CSV.' };
  }

  const availableStart = hhmm(daySamples[0]!.time);
  const availableEnd = hhmm(daySamples[daySamples.length - 1]!.time);

  // Include the full end minute (end given as HH:MM).
  const endInclusive = endSec + 59;
  const rows = daySamples.filter((s) => {
    const t = parseClock(s.time);
    return t !== null && t >= startSec && t <= endInclusive;
  });

  if (rows.length === 0) {
    return {
      ...base,
      status: 'empty',
      message: 'No samples found for selected time range.',
      availableStart,
      availableEnd,
    };
  }

  const series: SeriesPoint[] = rows.map((s) => ({
    time: hhmm(s.time),
    full: s.time,
    spot: spotOf(s),
    future: futureOf(s),
    gap: s.gap,
  }));

  const first = rows[0]!;
  const last = rows[rows.length - 1]!;
  const change = (a: number | null, b: number | null) => (a !== null && b !== null ? b - a : null);

  const gapRows = rows.filter((s) => s.gap !== null) as Array<GapSample & { gap: number }>;
  const gaps = gapRows.map((s) => s.gap);
  let maxGap: number | null = null;
  let maxGapTime: string | null = null;
  let minGap: number | null = null;
  let minGapTime: string | null = null;
  for (const s of gapRows) {
    if (maxGap === null || s.gap > maxGap) {
      maxGap = s.gap;
      maxGapTime = hhmm(s.time);
    }
    if (minGap === null || s.gap < minGap) {
      minGap = s.gap;
      minGapTime = hhmm(s.time);
    }
  }
  const avgGap = mean(gaps);
  const medianGap = median(gaps);
  const gapRange = maxGap !== null && minGap !== null ? maxGap - minGap : null;

  const startSpot = spotOf(first);
  const endSpot = spotOf(last);
  const startFuture = futureOf(first);
  const endFuture = futureOf(last);
  const startGap = first.gap;
  const endGap = last.gap;

  const stats: TimeRangeStats = {
    startTime: hhmm(first.time),
    endTime: hhmm(last.time),
    startSpot,
    endSpot,
    spotChange: change(startSpot, endSpot),
    startFuture,
    endFuture,
    futureChange: change(startFuture, endFuture),
    startGap,
    endGap,
    gapChange: change(startGap, endGap),
    maxGap,
    maxGapTime,
    minGap,
    minGapTime,
    avgGap,
    medianGap,
    gapRange,
    totalSamples: rows.length,
    sessions: [...new Set(rows.map((s) => s.currentSession).filter(Boolean))].sort(),
    syncQualityPct: syncQualityPct(rows),
  };

  const description =
    `From ${stats.startTime} to ${stats.endTime} on ${input.date}, ` +
    `Spot moved from ${fmt(startSpot)} to ${fmt(endSpot)}, ` +
    `Future moved from ${fmt(startFuture)} to ${fmt(endFuture)}, ` +
    `and Gap changed from ${fmt(startGap)} to ${fmt(endGap)}. ` +
    `The maximum gap during this period was ${fmt(maxGap)}${maxGapTime ? ` at ${maxGapTime}` : ''}, ` +
    `while the minimum gap was ${fmt(minGap)}${minGapTime ? ` at ${minGapTime}` : ''}.`;

  return { ...base, status: 'ok', availableStart, availableEnd, series, stats, description };
}
