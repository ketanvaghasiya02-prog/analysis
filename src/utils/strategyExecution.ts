/**
 * Historical Strategy Finder — Research Execution (Phase 11B).
 *
 * Executes the FROZEN Research Engine v1.0 (computeScenario) for a single
 * READY parameter combination and packages the result. It NEVER reimplements
 * scenario logic, never ranks, never scores, never compares — it only runs the
 * engine and stores the historical result.
 *
 * The orchestration (sequential loop, cache, pause/resume/stop, live updates)
 * lives in the useStrategyExecution hook; this file is the pure executor plus
 * the shared types and cache key.
 */

import type { GapSample } from '@/types/gap';
import {
  computeScenario,
  CONFIDENCE_LABELS,
  type ConfidenceLevel,
  type ScenarioInput,
  type ScenarioOutcome,
} from '@/utils/scenario';
import type { StrategyCombination } from '@/utils/strategyFinder';

export type ExecStatus = 'READY' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CACHED';

/**
 * One historical occurrence of a strategy — a flattened view of a single
 * ScenarioEvent already produced by the FROZEN Research Engine. Captured (not
 * recomputed) so the read-only Strategy Dossier can show per-occurrence
 * evidence without ever rerunning the engine.
 */
export interface OccurrenceRecord {
  date: string;
  time: string;
  session: string;
  entryGap: number;
  maxGap: number;
  minGap: number;
  recoveryGap: number;
  recoveryTimeSec: number | null;
  holdingSec: number | null;
  outcome: ScenarioOutcome;
}

/** The complete research result stored for every executed strategy. */
export interface StrategyResearchResult {
  entryGap: number;
  recoveryGap: number;
  stopLoss: number;
  totalPositions: number;
  recoveredBeforeSl: number;
  recoveredAfterSl: number;
  slNotRecovered: number;
  recoveryBeforeSlPct: number;
  recoveryAfterSlPct: number;
  recoveryIgnoringSlPct: number;
  slHitPct: number;
  avgRecoverySec: number | null;
  medianRecoverySec: number | null;
  avgMaxGap: number | null;
  worstMaxGap: number | null;
  p95MaxGap: number | null;
  p99MaxGap: number | null;
  avgHoldingSec: number | null;
  confidenceLevel: ConfidenceLevel;
  confidenceLabel: string;
  /** Wall-clock execution time for this strategy, in ms. */
  executionMs: number;
  /** Epoch ms when the result completed. */
  completedAt: number;
  /** Per-occurrence evidence, captured from the engine's events (read-only). */
  occurrences: OccurrenceRecord[];
}

/** One strategy's execution record (status + result), updated live. */
export interface StrategyExecution {
  id: string;
  entryGap: number;
  recoveryGap: number;
  stopLoss: number;
  status: ExecStatus;
  result: StrategyResearchResult | null;
  error: string | null;
}

function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

/**
 * Cache key — two strategies are identical when Entry, Recovery, Stop Loss,
 * Same Day, Date Range and Session all match.
 */
export function strategyCacheKey(c: StrategyCombination): string {
  const sessions = [...c.sessions].sort().join(',');
  return [
    c.entryGap,
    c.recoveryGap,
    c.stopLoss,
    c.sameDayOnly ? 1 : 0,
    c.dateRange.from,
    c.dateRange.to,
    sessions,
  ].join('|');
}

/**
 * Runs the Research Engine once for a single combination and returns the
 * complete result. Throws on engine failure (the caller marks it FAILED).
 */
export function executeStrategy(
  samples: GapSample[],
  c: StrategyCombination,
  minEvents: number,
): StrategyResearchResult {
  const t0 = nowMs();
  const input: ScenarioInput = {
    entryGap: c.entryGap,
    recoveryGap: c.recoveryGap,
    stopLoss: c.stopLoss,
    maxHoldingMinutes: c.holdingMinutes,
    sameDayOnly: c.sameDayOnly,
    sessions: c.sessions,
    syncStatuses: [],
    minEvents,
  };
  const r = computeScenario(samples, input);

  const holdings = r.events
    .map((e) => e.durationSec)
    .filter((v): v is number => v !== null);
  const avgHoldingSec = holdings.length
    ? holdings.reduce((a, b) => a + b, 0) / holdings.length
    : null;

  return {
    entryGap: c.entryGap,
    recoveryGap: c.recoveryGap,
    stopLoss: c.stopLoss,
    totalPositions: r.validEvents,
    recoveredBeforeSl: r.recoveredBeforeSl,
    recoveredAfterSl: r.recoveredAfterSl,
    slNotRecovered: r.slNotRecovered,
    recoveryBeforeSlPct: r.recoveryBeforeSlPct,
    recoveryAfterSlPct: r.recoveredAfterSlPct,
    recoveryIgnoringSlPct: r.recoveryPctIgnoringSl,
    slHitPct: r.slHitPct,
    avgRecoverySec: r.avgRecoveryTimeSec,
    medianRecoverySec: r.medianRecoveryTimeSec,
    avgMaxGap: r.adverse.avg,
    worstMaxGap: r.adverse.worst,
    p95MaxGap: r.adverse.p95,
    p99MaxGap: r.adverse.p99,
    avgHoldingSec,
    confidenceLevel: r.confidence.level,
    confidenceLabel: CONFIDENCE_LABELS[r.confidence.level],
    executionMs: nowMs() - t0,
    completedAt: Date.now(),
    // Capture (do not recompute) the engine's per-occurrence events so the
    // read-only dossier has full evidence without rerunning the engine.
    occurrences: r.events.map((e) => ({
      date: e.date,
      time: e.entryTime,
      session: e.session,
      entryGap: e.entryGap,
      maxGap: e.maxGap,
      minGap: e.minGap,
      recoveryGap: c.recoveryGap,
      recoveryTimeSec: e.recoveryTimeSec,
      holdingSec: e.durationSec,
      outcome: e.outcome,
    })),
  };
}
