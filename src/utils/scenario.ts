/**
 * Research Lab scenario engine (additive).
 *
 * Interactive "what happened historically" scenario testing. The user defines an
 * entry gap zone, a recovery target zone and a stop-loss gap; this engine scans
 * the already-filtered samples and classifies each entry event's outcome.
 *
 * RESEARCH ONLY — gap points, no money, no trading signals. Reuses the shared
 * filtered dataset; no CSV is re-parsed.
 */

import type { GapSample } from '@/types/gap';
import { isSynced, percentile, summarise } from '@/utils/statistics';
import type { SerializedExport } from '@/utils/reports';

const EPS = 1e-9;

export interface ScenarioInput {
  entryFrom: number;
  entryTo: number;
  recoveryFrom: number;
  recoveryTo: number;
  stopLoss: number;
  /** Optional cap on holding time, in minutes. */
  maxHoldingMinutes: number | null;
  sameDayOnly: boolean;
  sessions: string[];
  syncStatuses: string[];
  minEvents: number;
}

export const DEFAULT_SCENARIO_INPUT: ScenarioInput = {
  entryFrom: 18.0,
  entryTo: 18.5,
  recoveryFrom: 15.0,
  recoveryTo: 15.5,
  stopLoss: 19.0,
  maxHoldingMinutes: null,
  sameDayOnly: true,
  sessions: [],
  syncStatuses: [],
  minEvents: 10,
};

export type ScenarioOutcome =
  | 'RECOVERED_BEFORE_SL'
  | 'SL_HIT_THEN_RECOVERED'
  | 'SL_HIT_NOT_RECOVERED'
  | 'DAY_END_NO_RESOLUTION'
  | 'DATASET_END_NO_RESOLUTION'
  | 'MAX_HOLDING_EXPIRED';

export const OUTCOME_LABELS: Record<ScenarioOutcome, string> = {
  RECOVERED_BEFORE_SL: 'Recovered before SL',
  SL_HIT_THEN_RECOVERED: 'SL hit then recovered',
  SL_HIT_NOT_RECOVERED: 'SL hit not recovered',
  DAY_END_NO_RESOLUTION: 'Day end no resolution',
  DATASET_END_NO_RESOLUTION: 'Dataset end no resolution',
  MAX_HOLDING_EXPIRED: 'Max holding expired',
};

export const OUTCOME_ORDER: ScenarioOutcome[] = [
  'RECOVERED_BEFORE_SL',
  'SL_HIT_THEN_RECOVERED',
  'SL_HIT_NOT_RECOVERED',
  'DAY_END_NO_RESOLUTION',
  'DATASET_END_NO_RESOLUTION',
  'MAX_HOLDING_EXPIRED',
];

type TerminalReason = 'recovery' | 'day' | 'holding' | 'dataset';

export interface ScenarioEvent {
  id: string;
  startIndex: number;
  endIndex: number;
  recoveryIndex: number | null;
  date: string;
  entryTime: string;
  entryGap: number;
  /** Highest gap reached after entry within the scan window. */
  maxGap: number;
  /** Lowest gap reached after entry within the scan window. */
  minGap: number;
  /** entryGap − minGap (favorable move toward recovery, gap points). */
  favorableMove: number;
  recovered: boolean;
  /** True when the gap reached recovery (gap <= recoveryTo) within the window. */
  recoveryHit: boolean;
  /** True when the gap reached the stop-loss level within the window. */
  slHit: boolean;
  recoveryTimeSec: number | null;
  slHitTimeSec: number | null;
  durationSec: number | null;
  terminal: TerminalReason;
  outcome: ScenarioOutcome;
  session: string;
  syncStatus: string;
}

export interface DistributionStats {
  avg: number | null;
  median: number | null;
  p90: number | null;
  p95: number | null;
  p99: number | null;
  worst: number | null;
}

export type ConfidenceLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface ScenarioConfidence {
  level: ConfidenceLevel;
  score: number;
  factors: {
    events: number;
    syncQualityPct: number | null;
    unresolvedPct: number;
    daysCovered: number;
  };
}

export interface ScenarioResult {
  input: ScenarioInput;
  totalEvents: number;
  validEvents: number;

  counts: Record<ScenarioOutcome, number>;
  recoveredBeforeSl: number;
  slHitThenRecovered: number;
  slHitNotRecovered: number;
  dayEndNoResolution: number;
  datasetEndNoResolution: number;
  maxHoldingExpired: number;
  unresolved: number;

  recoveryPctIgnoringSl: number;
  recoveryBeforeSlPct: number;
  /** SL Hit % = (SL hit then recovered + SL hit not recovered) / total. */
  slHitPct: number;
  /** Recovery After SL % = SL hit then recovered / total. */
  recoveredAfterSlPct: number;
  unresolvedPct: number;

  /** Sum of all six outcome counts — must equal validEvents. */
  outcomeTotal: number;
  accountingOk: boolean;

  avgRecoveryTimeSec: number | null;
  medianRecoveryTimeSec: number | null;
  maxRecoveryTimeSec: number | null;

  adverse: DistributionStats;
  favorable: { avg: number | null; median: number | null; best: number | null };

  entryGapAvg: number | null;
  riskReward: { reward: number; risk: number; rr: number | null } | null;

  confidence: ScenarioConfidence;
  events: ScenarioEvent[];
}

function distributionStats(values: number[]): DistributionStats {
  if (values.length === 0) {
    return { avg: null, median: null, p90: null, p95: null, p99: null, worst: null };
  }
  const sum = values.reduce((a, b) => a + b, 0);
  return {
    avg: sum / values.length,
    median: percentile(values, 50),
    p90: percentile(values, 90),
    p95: percentile(values, 95),
    p99: percentile(values, 99),
    worst: Math.max(...values),
  };
}

/** Classifies an event for an arbitrary stop-loss level (no re-scan needed). */
export function classifyAtSl(
  event: Pick<ScenarioEvent, 'recovered' | 'maxGap' | 'terminal'>,
  sl: number,
): ScenarioOutcome {
  if (event.recovered) {
    // Recovered: did the gap touch the SL level before recovering?
    return event.maxGap >= sl - EPS
      ? 'SL_HIT_THEN_RECOVERED'
      : 'RECOVERED_BEFORE_SL';
  }
  if (event.maxGap >= sl - EPS) return 'SL_HIT_NOT_RECOVERED';
  switch (event.terminal) {
    case 'day':
      return 'DAY_END_NO_RESOLUTION';
    case 'holding':
      return 'MAX_HOLDING_EXPIRED';
    default:
      return 'DATASET_END_NO_RESOLUTION';
  }
}

/** Runs the scenario over the (already filtered) sample array. */
export function computeScenario(
  samples: GapSample[],
  input: ScenarioInput,
): ScenarioResult {
  const {
    entryFrom,
    entryTo,
    recoveryTo,
    stopLoss,
    maxHoldingMinutes,
    sameDayOnly,
    sessions,
    syncStatuses,
  } = input;

  const sessionSet = sessions.length ? new Set(sessions) : null;
  const syncSet = syncStatuses.length ? new Set(syncStatuses) : null;
  const maxHoldingSec =
    maxHoldingMinutes !== null && maxHoldingMinutes > 0
      ? maxHoldingMinutes * 60
      : null;

  const events: ScenarioEvent[] = [];
  let totalEvents = 0;
  let counter = 0;
  const n = samples.length;

  for (let i = 1; i < n; i += 1) {
    const prev = samples[i - 1]!;
    const cur = samples[i]!;
    if (prev.gap === null || cur.gap === null) continue;

    // Entry: cross into the entry zone from below entryFrom, landing in zone.
    const isEntry =
      prev.gap < entryFrom &&
      cur.gap >= entryFrom - EPS &&
      cur.gap <= entryTo + EPS;
    if (!isEntry) continue;

    totalEvents += 1;

    // Lab-specific session / sync filters on the entry sample.
    if (sessionSet && !sessionSet.has(cur.currentSession)) continue;
    if (syncSet && !syncSet.has(cur.syncStatus)) continue;

    const entryDay = cur.dayKey;
    const entryGap = cur.gap;
    const entryTs = cur.timestampMs;

    let maxGap = entryGap;
    let minGap = entryGap;
    let lastIndex = i;
    let lastTimeSec: number | null = 0;
    let firstSlHitSec: number | null = null;
    let recovered = false;
    let recoveryIndex: number | null = null;
    let recoveryTimeSec: number | null = null;
    let terminal: TerminalReason = 'dataset';

    for (let j = i + 1; j < n; j += 1) {
      const s = samples[j]!;

      if (sameDayOnly && s.dayKey !== entryDay) {
        terminal = 'day';
        break;
      }
      const tsec =
        entryTs !== null && s.timestampMs !== null
          ? (s.timestampMs - entryTs) / 1000
          : null;
      if (maxHoldingSec !== null && tsec !== null && tsec > maxHoldingSec) {
        terminal = 'holding';
        break;
      }
      if (s.gap === null) continue;

      lastIndex = j;
      if (tsec !== null) lastTimeSec = tsec;
      if (s.gap > maxGap) maxGap = s.gap;
      if (s.gap < minGap) minGap = s.gap;
      if (firstSlHitSec === null && s.gap >= stopLoss - EPS) firstSlHitSec = tsec;

      if (s.gap <= recoveryTo + EPS) {
        recovered = true;
        recoveryIndex = j;
        recoveryTimeSec = tsec;
        terminal = 'recovery';
        break;
      }
    }

    const outcome = classifyAtSl({ recovered, maxGap, terminal }, stopLoss);
    const slHit = maxGap >= stopLoss - EPS;
    const slInvolved =
      outcome === 'SL_HIT_NOT_RECOVERED' || outcome === 'SL_HIT_THEN_RECOVERED';
    const durationSec = recovered
      ? recoveryTimeSec
      : outcome === 'SL_HIT_NOT_RECOVERED'
        ? firstSlHitSec
        : lastTimeSec;

    counter += 1;
    events.push({
      id: `RL-${String(counter).padStart(4, '0')}`,
      startIndex: i,
      endIndex: recovered && recoveryIndex !== null ? recoveryIndex : lastIndex,
      recoveryIndex,
      date: entryDay,
      entryTime: cur.serverTime,
      entryGap,
      maxGap,
      minGap,
      favorableMove: entryGap - minGap,
      recovered,
      recoveryHit: recovered,
      slHit,
      recoveryTimeSec,
      slHitTimeSec: slInvolved ? firstSlHitSec : null,
      durationSec,
      terminal,
      outcome,
      session: cur.currentSession,
      syncStatus: cur.syncStatus,
    });
  }

  return summariseScenario(events, totalEvents, input, samples);
}

function summariseScenario(
  events: ScenarioEvent[],
  totalEvents: number,
  input: ScenarioInput,
  samples: GapSample[],
): ScenarioResult {
  const counts: Record<ScenarioOutcome, number> = {
    RECOVERED_BEFORE_SL: 0,
    SL_HIT_THEN_RECOVERED: 0,
    SL_HIT_NOT_RECOVERED: 0,
    DAY_END_NO_RESOLUTION: 0,
    DATASET_END_NO_RESOLUTION: 0,
    MAX_HOLDING_EXPIRED: 0,
  };
  for (const e of events) counts[e.outcome] += 1;

  const valid = events.length;
  const unresolved =
    counts.DAY_END_NO_RESOLUTION +
    counts.DATASET_END_NO_RESOLUTION +
    counts.MAX_HOLDING_EXPIRED;

  // Accounting: every event must land in exactly one outcome.
  const outcomeTotal = OUTCOME_ORDER.reduce((a, o) => a + counts[o], 0);
  const accountingOk = outcomeTotal === valid;

  const pct = (x: number) => (valid > 0 ? (x / valid) * 100 : 0);

  const recoveryTimes = events
    .filter((e) => e.recovered)
    .map((e) => e.recoveryTimeSec)
    .filter((v): v is number => v !== null);
  const recTimeSummary = summarise(recoveryTimes);

  const adverse = distributionStats(events.map((e) => e.maxGap));
  const favorableValues = events.map((e) => e.favorableMove);
  const favorable = {
    avg:
      favorableValues.length > 0
        ? favorableValues.reduce((a, b) => a + b, 0) / favorableValues.length
        : null,
    median: percentile(favorableValues, 50),
    best: favorableValues.length > 0 ? Math.max(...favorableValues) : null,
  };

  const entryGapAvg =
    valid > 0
      ? events.reduce((a, e) => a + e.entryGap, 0) / valid
      : null;

  let riskReward: ScenarioResult['riskReward'] = null;
  if (entryGapAvg !== null) {
    const reward = entryGapAvg - input.recoveryTo;
    const risk = input.stopLoss - entryGapAvg;
    riskReward = { reward, risk, rr: risk > EPS ? reward / risk : null };
  }

  // Confidence factors.
  const daysCovered = new Set(events.map((e) => e.date)).size;
  const syncedEntries = events.filter((e) => isSynced(e.syncStatus)).length;
  const syncQualityPct = valid > 0 ? (syncedEntries / valid) * 100 : null;
  const unresolvedPct = pct(unresolved);

  const eventsScore =
    valid >= 100 ? 1 : valid >= 30 ? 0.6 : valid >= input.minEvents ? 0.3 : 0;
  const syncScore =
    syncQualityPct === null ? 0.3 : syncQualityPct >= 98 ? 1 : syncQualityPct >= 90 ? 0.6 : 0.2;
  const unresolvedScore =
    unresolvedPct <= 10 ? 1 : unresolvedPct <= 30 ? 0.6 : 0.2;
  const coverageScore = daysCovered >= 5 ? 1 : daysCovered >= 2 ? 0.6 : 0.3;
  const score = (eventsScore + syncScore + unresolvedScore + coverageScore) / 4;
  const level: ConfidenceLevel =
    score >= 0.7 ? 'HIGH' : score >= 0.45 ? 'MEDIUM' : 'LOW';

  // `samples` retained for signature symmetry / potential future coverage use.
  void samples;

  return {
    input,
    totalEvents,
    validEvents: valid,
    counts,
    recoveredBeforeSl: counts.RECOVERED_BEFORE_SL,
    slHitThenRecovered: counts.SL_HIT_THEN_RECOVERED,
    slHitNotRecovered: counts.SL_HIT_NOT_RECOVERED,
    dayEndNoResolution: counts.DAY_END_NO_RESOLUTION,
    datasetEndNoResolution: counts.DATASET_END_NO_RESOLUTION,
    maxHoldingExpired: counts.MAX_HOLDING_EXPIRED,
    unresolved,
    recoveryPctIgnoringSl: pct(
      counts.RECOVERED_BEFORE_SL + counts.SL_HIT_THEN_RECOVERED,
    ),
    recoveryBeforeSlPct: pct(counts.RECOVERED_BEFORE_SL),
    slHitPct: pct(counts.SL_HIT_THEN_RECOVERED + counts.SL_HIT_NOT_RECOVERED),
    recoveredAfterSlPct: pct(counts.SL_HIT_THEN_RECOVERED),
    unresolvedPct,
    outcomeTotal,
    accountingOk,
    avgRecoveryTimeSec: recTimeSummary.mean,
    medianRecoveryTimeSec: recTimeSummary.median,
    maxRecoveryTimeSec: recTimeSummary.max,
    adverse,
    favorable,
    entryGapAvg,
    riskReward,
    confidence: {
      level,
      score,
      factors: { events: valid, syncQualityPct, unresolvedPct, daysCovered },
    },
    events,
  };
}

export interface SensitivityRow {
  slLevel: number;
  recoveryBeforeSlPct: number;
  slHitPct: number;
  recoveredEventsStopped: number;
  failedEventsCut: number;
  unresolvedPct: number;
  efficiency: number;
}

/**
 * Stop-loss sensitivity sweep from entryTo to entryTo + 6.00 in 0.50 steps,
 * reclassifying the existing events (no re-scan).
 */
export function computeSensitivity(
  events: ScenarioEvent[],
  input: ScenarioInput,
): SensitivityRow[] {
  const valid = events.length;
  const recoveredCount = events.filter((e) => e.recovered).length;
  const notRecoveredCount = valid - recoveredCount;

  const rows: SensitivityRow[] = [];
  const start = input.entryTo;
  const end = input.entryTo + 6;
  for (let sl = start; sl <= end + EPS; sl = Math.round((sl + 0.5) * 1e6) / 1e6) {
    let recoveredWithout = 0;
    let slHit = 0;
    let recoveredStopped = 0;
    let failedCut = 0;
    let unresolved = 0;

    for (const e of events) {
      const outcome = classifyAtSl(e, sl);
      switch (outcome) {
        case 'RECOVERED_BEFORE_SL':
          recoveredWithout += 1;
          break;
        case 'SL_HIT_THEN_RECOVERED':
          recoveredStopped += 1; // a recovery this SL would have stopped
          break;
        case 'SL_HIT_NOT_RECOVERED':
          slHit += 1;
          failedCut += 1; // a non-recovering event this SL would have cut
          break;
        default:
          unresolved += 1;
      }
    }

    const failedCutRate = notRecoveredCount > 0 ? failedCut / notRecoveredCount : 0;
    const recoveredStoppedRate =
      recoveredCount > 0 ? recoveredStopped / recoveredCount : 0;

    rows.push({
      slLevel: sl,
      recoveryBeforeSlPct: valid > 0 ? (recoveredWithout / valid) * 100 : 0,
      slHitPct: valid > 0 ? (slHit / valid) * 100 : 0,
      recoveredEventsStopped: recoveredStopped,
      failedEventsCut: failedCut,
      unresolvedPct: valid > 0 ? (unresolved / valid) * 100 : 0,
      efficiency: (failedCutRate - recoveredStoppedRate) * 100,
    });
  }
  return rows;
}

export interface ScenarioPathPoint {
  i: number;
  gap: number;
  time: string;
  globalIndex: number;
}

export interface ScenarioPath {
  points: ScenarioPathPoint[];
  entryPos: number | null;
  slHitPos: number | null;
  recoveryPos: number | null;
}

/** Builds the gap path for one event: ~lookback before entry → terminal. */
export function buildScenarioPath(
  samples: GapSample[],
  event: ScenarioEvent,
  stopLoss: number,
  lookbackSec = 600,
): ScenarioPath {
  const entryTs = samples[event.startIndex]?.timestampMs ?? null;
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

  const points: ScenarioPathPoint[] = [];
  const posByGlobal = new Map<number, number>();
  let slHitGlobal: number | null = null;
  for (let g = start; g <= end; g += 1) {
    const s = samples[g]!;
    if (s.gap === null) continue;
    if (slHitGlobal === null && g > event.startIndex && s.gap >= stopLoss - EPS) {
      slHitGlobal = g;
    }
    posByGlobal.set(g, points.length);
    points.push({ i: points.length, gap: s.gap, time: s.serverTime, globalIndex: g });
  }

  return {
    points,
    entryPos: posByGlobal.get(event.startIndex) ?? null,
    slHitPos: slHitGlobal !== null ? (posByGlobal.get(slHitGlobal) ?? null) : null,
    recoveryPos:
      event.recoveryIndex !== null
        ? (posByGlobal.get(event.recoveryIndex) ?? null)
        : null,
  };
}

// --- exports ------------------------------------------------------------------

function csvCell(v: string | number | null): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const r3 = (n: number | null): number | null =>
  n === null ? null : Math.round(n * 1000) / 1000;
const r1 = (n: number | null): number | null =>
  n === null ? null : Math.round(n * 10) / 10;
const rt = (sec: number | null): number | null =>
  sec === null ? null : Math.round(sec);

/** Research Lab event list as CSV. */
export function scenarioEventListCsv(result: ScenarioResult): SerializedExport {
  const cols = [
    'Event ID', 'Date', 'Entry Time', 'Entry Gap', 'Max Gap After Entry',
    'Min Gap After Entry', 'Outcome', 'SL Hit Time (s)', 'Recovery Time (s)',
    'Duration (s)', 'Session', 'SyncStatus',
  ];
  const lines = [cols.map(csvCell).join(',')];
  for (const e of result.events) {
    lines.push(
      [
        e.id, e.date, e.entryTime, r3(e.entryGap), r3(e.maxGap), r3(e.minGap),
        OUTCOME_LABELS[e.outcome], rt(e.slHitTimeSec), rt(e.recoveryTimeSec),
        rt(e.durationSec), e.session, e.syncStatus,
      ]
        .map(csvCell)
        .join(','),
    );
  }
  return {
    filename: 'ResearchLab_Events.csv',
    content: lines.join('\n'),
    mime: 'text/csv',
  };
}

/** Scenario summary as JSON (input + headline metrics, without the event list). */
export function scenarioSummaryJson(
  result: ScenarioResult,
  generatedAt: string,
): SerializedExport {
  const { events: _events, ...summary } = result;
  void _events;
  const payload = {
    note:
      'Research only. This summarises what happened historically for this scenario. Not a trading signal.',
    generatedAt,
    ...summary,
  };
  return {
    filename: 'ResearchLab_ScenarioSummary.json',
    content: JSON.stringify(payload, null, 2),
    mime: 'application/json',
  };
}

/** Stop-loss sensitivity table as CSV. */
export function sensitivityCsv(rows: SensitivityRow[]): SerializedExport {
  const cols = [
    'SL Level', 'Recovery Before SL %', 'SL Hit %', 'Recovered Events Stopped',
    'Failed Events Cut', 'Unresolved %', 'Efficiency',
  ];
  const lines = [cols.map(csvCell).join(',')];
  for (const row of rows) {
    lines.push(
      [
        r3(row.slLevel), r1(row.recoveryBeforeSlPct), r1(row.slHitPct),
        row.recoveredEventsStopped, row.failedEventsCut, r1(row.unresolvedPct),
        r1(row.efficiency),
      ]
        .map(csvCell)
        .join(','),
    );
  }
  return {
    filename: 'ResearchLab_StopLossSensitivity.csv',
    content: lines.join('\n'),
    mime: 'text/csv',
  };
}
