/**
 * Probability Engine v1.0 — Core (Phase 12A).
 *
 * Answers, from uploaded CSV history only: "given a current gap, what is the
 * historical probability the gap compresses to each lower target gap?"
 *
 * This is a NEW, standalone engine. It does NOT modify or call the frozen
 * Research Engine v1.0. It uses the same position model (one simulated position
 * at a time, no repeated entries while the gap stays above the current gap) and
 * scans every target together in a single forward pass per event.
 *
 * RESEARCH ONLY — gap points, no money, no trading signals, no recommendations.
 */

import type { GapSample } from '@/types/gap';
import { CONFIDENCE_LABELS, type ConfidenceLevel } from '@/utils/scenario';

const EPS = 1e-9;
const MAX_TARGETS = 400;

export interface ProbabilityDateRange {
  from: string;
  to: string;
}

export interface ProbabilityInput {
  currentGap: number;
  targetStart: number;
  targetEnd: number;
  targetStep: number;
  stopLossGap: number | null;
  maxHoldingMinutes: number | null;
  sameDayOnly: boolean;
  dateRange: ProbabilityDateRange;
  sessions: string[];
  syncStatuses: string[];
  minEvents: number;
}

export const DEFAULT_PROBABILITY_INPUT: ProbabilityInput = {
  currentGap: 18.4,
  targetStart: 18.2,
  targetEnd: 15.0,
  targetStep: 0.1,
  stopLossGap: null,
  maxHoldingMinutes: null,
  sameDayOnly: true,
  dateRange: { from: '', to: '' },
  sessions: [],
  syncStatuses: [],
  minEvents: 10,
};

export interface ProbabilityTargetRow {
  targetGap: number;
  totalEvents: number;
  reachedCount: number;
  probabilityPct: number;
  avgTimeSec: number | null;
  medianTimeSec: number | null;
  fastestSec: number | null;
  slowestSec: number | null;
  avgMaxGap: number | null;
  p90MaxGap: number | null;
  p95MaxGap: number | null;
  worstMaxGap: number | null;
  avgAdverseExpansion: number | null;
  /** Null when no stop-loss gap is set. */
  slBeforeTargetPct: number | null;
  unresolvedPct: number;
  confidenceLevel: ConfidenceLevel;
  confidenceLabel: string;
}

export interface ProbabilityMeta {
  currentGap: number;
  targetsTested: number;
  totalEvents: number;
  calcTimeMs: number;
  eventScans: number;
  truncated: boolean;
  rejectedTargets: number;
}

export interface ProbabilityResult {
  rows: ProbabilityTargetRow[];
  totalEvents: number;
  meta: ProbabilityMeta;
  input: ProbabilityInput;
}

type Terminal = 'recovery' | 'sl' | 'holding' | 'day' | 'dataset';

interface EventRecord {
  entryGap: number;
  /** First elapsed seconds at which each target was reached (null = not reached). */
  timeToTarget: Array<number | null>;
  /** Max gap reached up to the moment each target was first reached. */
  maxGapBeforeTarget: Array<number | null>;
  terminal: Terminal;
}

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : 0;
}

function round(value: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

function decimalsFor(step: number): number {
  const s = String(step);
  const dot = s.indexOf('.');
  return dot === -1 ? 0 : Math.min(6, s.length - dot - 1);
}

function mean(values: number[]): number | null {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  if (values.length === 1) return values[0]!;
  const s = [...values].sort((a, b) => a - b);
  const idx = (p / 100) * (s.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return s[lo]!;
  const w = idx - lo;
  return s[lo]! * (1 - w) + s[hi]! * w;
}

/** Event-count based research confidence (binomial denominator). */
function confidenceFor(totalEvents: number): ConfidenceLevel {
  if (totalEvents < 10) return 'VERY_LOW';
  if (totalEvents < 25) return 'LOW';
  if (totalEvents < 50) return 'MEDIUM';
  if (totalEvents < 100) return 'HIGH';
  return 'VERY_HIGH';
}

/** Builds the descending target ladder, rejecting any target >= current gap. */
export function buildTargetLadder(input: ProbabilityInput): { targets: number[]; truncated: boolean; rejected: number } {
  const step = input.targetStep > 0 ? input.targetStep : 0.1;
  const decimals = decimalsFor(step);
  const targets: number[] = [];
  let rejected = 0;
  let truncated = false;

  let t = input.targetStart;
  let guard = 0;
  // Walk from start down to end (inclusive).
  while (t >= input.targetEnd - EPS) {
    const value = round(t, decimals);
    // Validation: targets must be strictly below the current gap.
    if (value >= input.currentGap - EPS) {
      rejected += 1;
    } else {
      targets.push(value);
    }
    t = round(t - step, decimals);
    guard += 1;
    if (guard >= MAX_TARGETS) {
      truncated = true;
      break;
    }
  }
  return { targets, truncated, rejected };
}

function passesDateRange(sample: GapSample, range: ProbabilityDateRange): boolean {
  if (range.from && sample.dayKey < range.from) return false;
  if (range.to && sample.dayKey > range.to) return false;
  return true;
}

function passesEventFilters(entry: GapSample, input: ProbabilityInput): boolean {
  if (input.sessions.length > 0 && !input.sessions.includes(entry.currentSession)) return false;
  if (input.syncStatuses.length > 0 && !input.syncStatuses.includes(entry.syncStatus)) return false;
  return true;
}

/**
 * Runs the probability scan. One forward pass per event evaluates ALL targets
 * together — the Research Engine is never invoked, and no target is scanned
 * separately.
 */
export function computeProbability(samples: GapSample[], input: ProbabilityInput): ProbabilityResult {
  const t0 = now();
  const { targets, truncated, rejected } = buildTargetLadder(input);
  const currentGap = input.currentGap;
  const targetEnd = targets.length ? targets[targets.length - 1]! : input.targetEnd;
  const slGap = input.stopLossGap;
  const maxHoldingSec = input.maxHoldingMinutes != null ? input.maxHoldingMinutes * 60 : null;

  const events: EventRecord[] = [];
  let eventScans = 0;

  const n = samples.length;
  let i = 0;
  while (i < n - 1) {
    const prev = samples[i]!;
    const cur = samples[i + 1]!;
    const entryIndex = i + 1;

    const isEntry =
      prev.gap !== null &&
      cur.gap !== null &&
      prev.gap < currentGap &&
      cur.gap >= currentGap - EPS;

    if (!isEntry || !passesDateRange(cur, input.dateRange) || !passesEventFilters(cur, input)) {
      i += 1;
      continue;
    }

    // Open a position at `cur`. Scan forward, evaluating all targets together.
    eventScans += 1;
    const entryGap = cur.gap!;
    const entryDay = cur.dayKey;
    const entryTs = cur.timestampMs;
    let maxGap = entryGap;
    const timeToTarget: Array<number | null> = targets.map(() => null);
    const maxGapBeforeTarget: Array<number | null> = targets.map(() => null);

    let terminal: Terminal = 'dataset';
    let exitIndex = n - 1;

    for (let j = entryIndex + 1; j < n; j += 1) {
      const s = samples[j]!;
      if (input.sameDayOnly && s.dayKey !== entryDay) {
        terminal = 'day';
        exitIndex = j - 1;
        break;
      }
      if (s.gap === null) continue;
      const tsec =
        entryTs !== null && s.timestampMs !== null ? (s.timestampMs - entryTs) / 1000 : 0;
      if (maxHoldingSec !== null && tsec > maxHoldingSec) {
        terminal = 'holding';
        exitIndex = j - 1;
        break;
      }

      if (s.gap > maxGap) maxGap = s.gap;

      // Stop loss closes the position before any further target can be reached.
      if (slGap !== null && s.gap >= slGap - EPS) {
        terminal = 'sl';
        exitIndex = j;
        break;
      }

      // Target reach (gap <= target). Record first touch + max gap up to here.
      for (let ti = 0; ti < targets.length; ti += 1) {
        if (timeToTarget[ti] === null && s.gap <= targets[ti]! + EPS) {
          timeToTarget[ti] = tsec;
          maxGapBeforeTarget[ti] = maxGap;
        }
      }

      // Reaching the deepest target resolves the position (full compression).
      if (s.gap <= targetEnd + EPS) {
        terminal = 'recovery';
        exitIndex = j;
        break;
      }
    }

    events.push({ entryGap, timeToTarget, maxGapBeforeTarget, terminal });
    i = exitIndex + 1;
  }

  const totalEvents = events.length;
  const confidenceLevel = confidenceFor(totalEvents);
  const confidenceLabel = CONFIDENCE_LABELS[confidenceLevel];

  const rows: ProbabilityTargetRow[] = targets.map((targetGap, ti) => {
    const reachedTimes: number[] = [];
    const reachedMaxGaps: number[] = [];
    const adverse: number[] = [];
    let slBefore = 0;
    let unresolved = 0;

    for (const e of events) {
      const tt = e.timeToTarget[ti];
      if (tt != null) {
        reachedTimes.push(tt);
        const mg = e.maxGapBeforeTarget[ti];
        if (mg != null) {
          reachedMaxGaps.push(mg);
          adverse.push(mg - e.entryGap);
        }
      } else if (slGap !== null && e.terminal === 'sl') {
        slBefore += 1;
      } else {
        unresolved += 1;
      }
    }

    const reachedCount = reachedTimes.length;
    return {
      targetGap,
      totalEvents,
      reachedCount,
      probabilityPct: totalEvents ? (reachedCount / totalEvents) * 100 : 0,
      avgTimeSec: mean(reachedTimes),
      medianTimeSec: median(reachedTimes),
      fastestSec: reachedTimes.length ? Math.min(...reachedTimes) : null,
      slowestSec: reachedTimes.length ? Math.max(...reachedTimes) : null,
      avgMaxGap: mean(reachedMaxGaps),
      p90MaxGap: percentile(reachedMaxGaps, 90),
      p95MaxGap: percentile(reachedMaxGaps, 95),
      worstMaxGap: reachedMaxGaps.length ? Math.max(...reachedMaxGaps) : null,
      avgAdverseExpansion: mean(adverse),
      slBeforeTargetPct: slGap !== null && totalEvents ? (slBefore / totalEvents) * 100 : slGap !== null ? 0 : null,
      unresolvedPct: totalEvents ? (unresolved / totalEvents) * 100 : 0,
      confidenceLevel,
      confidenceLabel,
    };
  });

  return {
    rows,
    totalEvents,
    meta: {
      currentGap,
      targetsTested: targets.length,
      totalEvents,
      calcTimeMs: now() - t0,
      eventScans,
      truncated,
      rejectedTargets: rejected,
    },
    input,
  };
}
