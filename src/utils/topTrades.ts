/**
 * Top Trade Finder engine (additive).
 *
 * Finds historical *opportunities* where a high gap later compressed lower, and
 * ranks them. These are descriptions of what happened in the data — NOT live
 * signals, NOT trades, NOT buy/sell recommendations. Gap points only.
 *
 * Reuses the shared filtered (and date-time scoped) sample array; no re-parse.
 */

import type { GapSample } from '@/types/gap';
import { isSynced } from '@/utils/statistics';

const EPS = 1e-9;
const SETUP_BUCKET = 0.5;

// Ranking weights (gap-point scale).
const RECOVERY_BONUS_WEIGHT = 2; // per 100% setup compression rate
const RECOVERY_TARGET_BONUS = 0.5; // reached the scenario recovery target
const ADVERSE_PENALTY_WEIGHT = 1; // per gap point of adverse expansion
const TIME_PENALTY_WEIGHT = 0.5; // per hour of holding
const SYNC_PENALTY = 1; // entry tick out of sync

export interface TopTradeInput {
  count: number;
  minEntryGap: number;
  maxEntryGap: number | null;
  minCompressionTarget: number | null;
  minProfitGapPoints: number;
  maxAdverseGap: number | null;
  minRecoveryProbability: number; // 0–100
  maxHoldingMinutes: number | null;
  sameDayOnly: boolean;
  sessions: string[];
  minEventsPerSetup: number;
}

export const DEFAULT_TOP_TRADE_INPUT: TopTradeInput = {
  count: 10,
  minEntryGap: 14,
  maxEntryGap: null,
  minCompressionTarget: null,
  minProfitGapPoints: 0.3,
  maxAdverseGap: null,
  minRecoveryProbability: 0,
  maxHoldingMinutes: null,
  sameDayOnly: true,
  sessions: [],
  minEventsPerSetup: 5,
};

export interface ScoreBreakdown {
  compression: number;
  recoveryBonus: number;
  adversePenalty: number;
  timePenalty: number;
  syncPenalty: number;
  final: number;
}

export interface TopTradeOpportunity {
  rank: number;
  id: string;
  date: string;
  entryTime: string;
  entryGap: number;
  exitTime: string;
  exitGap: number;
  compression: number;
  maxAdverseGap: number;
  adverseExpansion: number;
  holdingSec: number | null;
  session: string;
  syncStatus: string;
  reachedRecoveryTarget: boolean;
  setupRecoveryPct: number;
  startIndex: number;
  exitIndex: number;
  maxAdverseIndex: number;
  score: number;
  breakdown: ScoreBreakdown;
}

export interface TopTradeResult {
  input: TopTradeInput;
  requested: number;
  totalValid: number;
  trades: TopTradeOpportunity[];
  avgCompression: number | null;
  avgHoldingSec: number | null;
  worstAdverseExpansion: number | null;
  best: TopTradeOpportunity | null;
  lowestRisk: TopTradeOpportunity | null;
}

interface Candidate {
  startIndex: number;
  exitIndex: number;
  maxAdverseIndex: number;
  date: string;
  entryTime: string;
  entryGap: number;
  exitTime: string;
  exitGap: number;
  compression: number;
  maxAdverseGap: number;
  adverseExpansion: number;
  holdingSec: number | null;
  session: string;
  syncStatus: string;
  reachedRecoveryTarget: boolean;
  bucket: number;
  success: boolean;
}

/** Finds the best (lowest-gap) exit for an entry within the holding window. */
function evaluateEntry(
  samples: GapSample[],
  i: number,
  input: TopTradeInput,
  recoveryTargetTo: number | null,
): Candidate {
  const entry = samples[i]!;
  const entryGap = entry.gap as number;
  const entryTs = entry.timestampMs;
  const entryDay = entry.dayKey;
  const maxHoldSec =
    input.maxHoldingMinutes !== null && input.maxHoldingMinutes > 0
      ? input.maxHoldingMinutes * 60
      : null;

  let minGap = entryGap;
  let minIdx = i;
  let runMax = entryGap;
  let adverseBeforeMin = entryGap;

  for (let j = i + 1; j < samples.length; j += 1) {
    const s = samples[j]!;
    if (input.sameDayOnly && s.dayKey !== entryDay) break;
    const tsec =
      entryTs !== null && s.timestampMs !== null
        ? (s.timestampMs - entryTs) / 1000
        : null;
    if (maxHoldSec !== null && tsec !== null && tsec > maxHoldSec) break;
    if (s.gap === null) continue;
    if (s.gap > runMax) runMax = s.gap;
    if (s.gap < minGap) {
      minGap = s.gap;
      minIdx = j;
      adverseBeforeMin = runMax;
    }
  }

  const exit = samples[minIdx]!;
  const holdingSec =
    entryTs !== null && exit.timestampMs !== null
      ? (exit.timestampMs - entryTs) / 1000
      : null;
  const compression = entryGap - minGap;
  const maxAdverseGap = adverseBeforeMin;
  const adverseExpansion = maxAdverseGap - entryGap;
  const reachedRecoveryTarget =
    recoveryTargetTo !== null ? minGap <= recoveryTargetTo + EPS : false;

  const success =
    compression >= input.minProfitGapPoints - EPS &&
    minIdx > i &&
    (input.minCompressionTarget === null ||
      minGap <= input.minCompressionTarget + EPS) &&
    (input.maxAdverseGap === null || maxAdverseGap <= input.maxAdverseGap + EPS);

  return {
    startIndex: i,
    exitIndex: minIdx,
    maxAdverseIndex: minIdx, // adverse peak occurs before exit; refined below
    date: entryDay,
    entryTime: entry.serverTime,
    entryGap,
    exitTime: exit.serverTime,
    exitGap: minGap,
    compression,
    maxAdverseGap,
    adverseExpansion,
    holdingSec,
    session: entry.currentSession,
    syncStatus: entry.syncStatus,
    reachedRecoveryTarget,
    bucket: Math.floor(entryGap / SETUP_BUCKET) * SETUP_BUCKET,
    success,
  };
}

/** Locates the index of the max-adverse peak within [entry, exit]. */
function adversePeakIndex(
  samples: GapSample[],
  startIndex: number,
  exitIndex: number,
): number {
  let peak = startIndex;
  let peakGap = samples[startIndex]?.gap ?? Number.NEGATIVE_INFINITY;
  for (let j = startIndex; j <= exitIndex; j += 1) {
    const g = samples[j]?.gap;
    if (g !== null && g !== undefined && g > peakGap) {
      peakGap = g;
      peak = j;
    }
  }
  return peak;
}

// Augment Candidate at ranking time with the applied setup recovery %.
type RankedCandidate = Candidate & { setupRecoveryPctApplied: number };

function scoreFor(c: RankedCandidate): ScoreBreakdown {
  const recoveryBonus =
    (c.setupRecoveryPctApplied / 100) * RECOVERY_BONUS_WEIGHT +
    (c.reachedRecoveryTarget ? RECOVERY_TARGET_BONUS : 0);
  const adversePenalty = Math.max(0, c.adverseExpansion) * ADVERSE_PENALTY_WEIGHT;
  const timePenalty =
    c.holdingSec !== null ? (c.holdingSec / 3600) * TIME_PENALTY_WEIGHT : 0;
  const syncPenalty = isSynced(c.syncStatus) ? 0 : SYNC_PENALTY;
  const final =
    c.compression + recoveryBonus - adversePenalty - timePenalty - syncPenalty;
  return {
    compression: c.compression,
    recoveryBonus,
    adversePenalty,
    timePenalty,
    syncPenalty,
    final,
  };
}

/** Finds and ranks the top historical compression opportunities. */
export function findTopTrades(
  samples: GapSample[],
  input: TopTradeInput,
  recoveryTargetTo: number | null,
): TopTradeResult {
  const sessionSet = input.sessions.length ? new Set(input.sessions) : null;
  const candidates: Candidate[] = [];

  let i = 1;
  const n = samples.length;
  while (i < n) {
    const prev = samples[i - 1]!;
    const cur = samples[i]!;
    const isEntry =
      prev.gap !== null &&
      cur.gap !== null &&
      prev.gap < input.minEntryGap &&
      cur.gap >= input.minEntryGap - EPS &&
      (input.maxEntryGap === null || cur.gap <= input.maxEntryGap + EPS);

    if (!isEntry) {
      i += 1;
      continue;
    }

    if (sessionSet && !sessionSet.has(cur.currentSession)) {
      i += 1;
      continue;
    }

    const c = evaluateEntry(samples, i, input, recoveryTargetTo);
    c.maxAdverseIndex = adversePeakIndex(samples, c.startIndex, c.exitIndex);
    candidates.push(c);
    // No overlap: continue scanning after the exit.
    i = c.exitIndex > i ? c.exitIndex + 1 : i + 1;
  }

  // Setup statistics: compression rate per entry-gap bucket.
  const bucketTotal = new Map<number, number>();
  const bucketSuccess = new Map<number, number>();
  for (const c of candidates) {
    bucketTotal.set(c.bucket, (bucketTotal.get(c.bucket) ?? 0) + 1);
    if (c.success) bucketSuccess.set(c.bucket, (bucketSuccess.get(c.bucket) ?? 0) + 1);
  }
  const setupRecoveryPct = (bucket: number): number => {
    const total = bucketTotal.get(bucket) ?? 0;
    if (total === 0) return 0;
    return ((bucketSuccess.get(bucket) ?? 0) / total) * 100;
  };

  // Valid opportunities: successful, from a sufficiently-sampled and reliable setup.
  const ranked: RankedCandidate[] = candidates
    .filter((c) => c.success)
    .map((c) => ({ ...c, setupRecoveryPctApplied: setupRecoveryPct(c.bucket) }))
    .filter(
      (c) =>
        (bucketTotal.get(c.bucket) ?? 0) >= input.minEventsPerSetup &&
        c.setupRecoveryPctApplied >= input.minRecoveryProbability - EPS,
    );

  const scored = ranked
    .map((c) => ({ candidate: c, breakdown: scoreFor(c) }))
    .sort((a, b) => b.breakdown.final - a.breakdown.final);

  const top = scored.slice(0, Math.max(0, input.count)).map((s, idx) => {
    const c = s.candidate;
    const opp: TopTradeOpportunity = {
      rank: idx + 1,
      id: `TT-${String(idx + 1).padStart(3, '0')}`,
      date: c.date,
      entryTime: c.entryTime,
      entryGap: c.entryGap,
      exitTime: c.exitTime,
      exitGap: c.exitGap,
      compression: c.compression,
      maxAdverseGap: c.maxAdverseGap,
      adverseExpansion: c.adverseExpansion,
      holdingSec: c.holdingSec,
      session: c.session,
      syncStatus: c.syncStatus,
      reachedRecoveryTarget: c.reachedRecoveryTarget,
      setupRecoveryPct: c.setupRecoveryPctApplied,
      startIndex: c.startIndex,
      exitIndex: c.exitIndex,
      maxAdverseIndex: c.maxAdverseIndex,
      score: s.breakdown.final,
      breakdown: s.breakdown,
    };
    return opp;
  });

  const avg = (arr: number[]): number | null =>
    arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

  const holdings = top
    .map((t) => t.holdingSec)
    .filter((v): v is number => v !== null);

  return {
    input,
    requested: input.count,
    totalValid: ranked.length,
    trades: top,
    avgCompression: avg(top.map((t) => t.compression)),
    avgHoldingSec: avg(holdings),
    worstAdverseExpansion: top.length
      ? Math.max(...top.map((t) => t.adverseExpansion))
      : null,
    best: top[0] ?? null,
    lowestRisk:
      top.length > 0
        ? [...top].sort((a, b) => a.adverseExpansion - b.adverseExpansion)[0]!
        : null,
  };
}

export interface TradePathPoint {
  i: number;
  gap: number;
  time: string;
  globalIndex: number;
}

export interface TradePath {
  points: TradePathPoint[];
  entryPos: number | null;
  exitPos: number | null;
  adversePos: number | null;
}

/** Builds the gap path for one opportunity: ~lookback before entry → exit. */
export function buildTradePath(
  samples: GapSample[],
  trade: TopTradeOpportunity,
  lookbackSec = 600,
): TradePath {
  const entryTs = samples[trade.startIndex]?.timestampMs ?? null;
  let start = trade.startIndex;
  if (entryTs !== null) {
    const cutoff = entryTs - lookbackSec * 1000;
    while (start > 0) {
      const prev = samples[start - 1]!;
      if (prev.timestampMs !== null && prev.timestampMs < cutoff) break;
      start -= 1;
    }
  } else {
    start = Math.max(0, trade.startIndex - 60);
  }
  const end = Math.min(samples.length - 1, trade.exitIndex);

  const points: TradePathPoint[] = [];
  const posByGlobal = new Map<number, number>();
  for (let g = start; g <= end; g += 1) {
    const s = samples[g]!;
    if (s.gap === null) continue;
    posByGlobal.set(g, points.length);
    points.push({ i: points.length, gap: s.gap, time: s.serverTime, globalIndex: g });
  }

  return {
    points,
    entryPos: posByGlobal.get(trade.startIndex) ?? null,
    exitPos: posByGlobal.get(trade.exitIndex) ?? null,
    adversePos: posByGlobal.get(trade.maxAdverseIndex) ?? null,
  };
}

// --- export -------------------------------------------------------------------

function csvCell(v: string | number | null): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const r3 = (n: number | null): number | null =>
  n === null ? null : Math.round(n * 1000) / 1000;
const rt = (s: number | null): number | null => (s === null ? null : Math.round(s));

export function topTradesCsv(result: TopTradeResult): {
  filename: string;
  content: string;
  mime: string;
} {
  const cols = [
    'Rank', 'Date', 'Entry Time', 'Entry Gap', 'Exit Time', 'Exit Gap',
    'Compression', 'Max Adverse Gap', 'Adverse Expansion', 'Holding Time (s)',
    'Session', 'SyncStatus', 'Setup Recovery %', 'Score',
  ];
  const lines = [cols.map(csvCell).join(',')];
  for (const t of result.trades) {
    lines.push(
      [
        t.rank, t.date, t.entryTime, r3(t.entryGap), t.exitTime, r3(t.exitGap),
        r3(t.compression), r3(t.maxAdverseGap), r3(t.adverseExpansion),
        rt(t.holdingSec), t.session, t.syncStatus,
        Math.round(t.setupRecoveryPct * 10) / 10, r3(t.score),
      ]
        .map(csvCell)
        .join(','),
    );
  }
  return {
    filename: 'ResearchLab_TopTrades.csv',
    content: lines.join('\n'),
    mime: 'text/csv',
  };
}
