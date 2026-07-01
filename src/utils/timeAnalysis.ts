/**
 * Time Analysis (Time Analysis module) — pure, read-only, timezone-aware.
 *
 * Slices the ALREADY-parsed CSV samples for a user-selected date + time window
 * and reports Spot / Future / Gap movement. The window times are entered in the
 * user's chosen timezone and converted to the broker server clock (which the CSV
 * stores) purely for filtering — the original timestamps are never modified.
 * Descriptive only; no prediction, no recommendation, no engine calls.
 */

import type { GapSample } from '@/types/gap';
import { syncQualityPct } from '@/utils/statistics';
import {
  inputToServerAbsSec,
  parseClock,
  serverAbsSec,
  type TzConfig,
  type TzKind,
} from '@/utils/timezone';

// Re-exported for existing consumers.
export { parseClock, hhmm } from '@/utils/timezone';

export interface TimeRangeInput {
  date: string; // YYYY-MM-DD, interpreted in `inputTz`
  start: string; // HH:MM in inputTz
  end: string; // HH:MM in inputTz
  inputTz: TzKind; // timezone the times are entered in
}

export type RangeStatus = 'ok' | 'empty' | 'invalid';

export interface SeriesPoint {
  /** Absolute server-timeline seconds (canonical; tz labels derive from this). */
  absSec: number;
  serverFull: string; // HH:MM:SS server
  serverHHMM: string; // HH:MM server
  spot: number | null;
  future: number | null;
  gap: number | null;
}

export interface TimeRangeStats {
  startAbsSec: number; // first row (server timeline)
  endAbsSec: number; // last row
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
  maxGapAbsSec: number | null;
  minGap: number | null;
  minGapAbsSec: number | null;
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
  /** Requested window bounds on the server timeline (for the window summary). */
  reqStartAbsSec: number | null;
  reqEndAbsSec: number | null;
  /** Overall available data range on the server timeline (nearest-range hint). */
  datasetStartAbsSec: number | null;
  datasetEndAbsSec: number | null;
  series: SeriesPoint[];
  stats: TimeRangeStats | null;
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

function datasetBounds(samples: GapSample[]): { min: number | null; max: number | null } {
  let min: number | null = null;
  let max: number | null = null;
  for (const s of samples) {
    const a = serverAbsSec(s.dayKey, s.time);
    if (a === null) continue;
    if (min === null || a < min) min = a;
    if (max === null || a > max) max = a;
  }
  return { min, max };
}

/** Analyses one date + time window (entered in inputTz) over the samples. Pure. */
export function analyzeTimeRange(samples: GapSample[], input: TimeRangeInput, cfg: TzConfig): TimeRangeResult {
  const bounds = datasetBounds(samples);
  const base: TimeRangeResult = {
    input,
    status: 'ok',
    message: null,
    reqStartAbsSec: null,
    reqEndAbsSec: null,
    datasetStartAbsSec: bounds.min,
    datasetEndAbsSec: bounds.max,
    series: [],
    stats: null,
  };

  if (!input.date) return { ...base, status: 'invalid', message: 'Date is required.' };
  const startSec = parseClock(input.start);
  const endSec = parseClock(input.end);
  if (startSec === null || endSec === null) {
    return { ...base, status: 'invalid', message: 'Enter a valid start and end time.' };
  }
  if (startSec >= endSec) {
    return { ...base, status: 'invalid', message: 'Start time must be before end time.' };
  }

  // Convert the entered (inputTz) window to the absolute SERVER timeline. The
  // end minute is inclusive (times are entered as HH:MM).
  const reqStartAbsSec = inputToServerAbsSec(input.date, startSec, input.inputTz, cfg);
  const reqEndAbsSec = inputToServerAbsSec(input.date, endSec, input.inputTz, cfg);
  const filterEndAbsSec = inputToServerAbsSec(input.date, endSec + 59, input.inputTz, cfg);

  const rows = samples
    .map((s) => ({ s, abs: serverAbsSec(s.dayKey, s.time) }))
    .filter((x): x is { s: GapSample; abs: number } => x.abs !== null && x.abs >= reqStartAbsSec && x.abs <= filterEndAbsSec)
    .sort((a, b) => a.abs - b.abs);

  if (rows.length === 0) {
    return {
      ...base,
      status: 'empty',
      message: 'No data exists for this converted time range.',
      reqStartAbsSec,
      reqEndAbsSec,
    };
  }

  const series: SeriesPoint[] = rows.map(({ s, abs }) => ({
    absSec: abs,
    serverFull: s.time,
    serverHHMM: s.time.slice(0, 5),
    spot: spotOf(s),
    future: futureOf(s),
    gap: s.gap,
  }));

  const first = rows[0]!.s;
  const last = rows[rows.length - 1]!.s;
  const change = (a: number | null, b: number | null) => (a !== null && b !== null ? b - a : null);

  const gapRows = rows.filter((r) => r.s.gap !== null) as Array<{ s: GapSample & { gap: number }; abs: number }>;
  const gaps = gapRows.map((r) => r.s.gap);
  let maxGap: number | null = null;
  let maxGapAbsSec: number | null = null;
  let minGap: number | null = null;
  let minGapAbsSec: number | null = null;
  for (const r of gapRows) {
    if (maxGap === null || r.s.gap > maxGap) { maxGap = r.s.gap; maxGapAbsSec = r.abs; }
    if (minGap === null || r.s.gap < minGap) { minGap = r.s.gap; minGapAbsSec = r.abs; }
  }
  const avgGap = mean(gaps);
  const medianGap = median(gaps);
  const gapRange = maxGap !== null && minGap !== null ? maxGap - minGap : null;

  const startSpot = spotOf(first);
  const endSpot = spotOf(last);
  const startFuture = futureOf(first);
  const endFuture = futureOf(last);

  const stats: TimeRangeStats = {
    startAbsSec: rows[0]!.abs,
    endAbsSec: rows[rows.length - 1]!.abs,
    startSpot,
    endSpot,
    spotChange: change(startSpot, endSpot),
    startFuture,
    endFuture,
    futureChange: change(startFuture, endFuture),
    startGap: first.gap,
    endGap: last.gap,
    gapChange: change(first.gap, last.gap),
    maxGap,
    maxGapAbsSec,
    minGap,
    minGapAbsSec,
    avgGap,
    medianGap,
    gapRange,
    totalSamples: rows.length,
    sessions: [...new Set(rows.map((r) => r.s.currentSession).filter(Boolean))].sort(),
    syncQualityPct: syncQualityPct(rows.map((r) => r.s)),
  };

  return { ...base, status: 'ok', reqStartAbsSec, reqEndAbsSec, series, stats };
}
