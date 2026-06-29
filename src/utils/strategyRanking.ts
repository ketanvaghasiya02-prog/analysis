/**
 * Strategy Ranking Engine (Phase 11D) — deterministic statistical ranking.
 *
 * Ranks COMPLETED strategies that are ALREADY stored in the Research
 * Repository. It never reruns the Research Engine, never duplicates research
 * calculations, and produces no recommendation — only a deterministic 0–100
 * score from normalized historical components.
 *
 * Higher rank means stronger historical statistics, not guaranteed future
 * performance. This is not a trading signal.
 */

import type { ConfidenceLevel } from '@/utils/scenario';
import type { RepositoryRecord } from '@/utils/researchRepository';
import type { SerializedExport } from '@/utils/reports';

const CONFIDENCE_ORDER: ConfidenceLevel[] = [
  'VERY_LOW',
  'LOW',
  'MEDIUM',
  'HIGH',
  'VERY_HIGH',
];

export type RankingMode =
  | 'BALANCED'
  | 'HIGHEST_RECOVERY'
  | 'LOWEST_RISK'
  | 'FASTEST_RECOVERY'
  | 'MOST_TRADES';

export const RANKING_MODES: Array<{ mode: RankingMode; label: string }> = [
  { mode: 'BALANCED', label: 'Balanced' },
  { mode: 'HIGHEST_RECOVERY', label: 'Highest Recovery' },
  { mode: 'LOWEST_RISK', label: 'Lowest Risk' },
  { mode: 'FASTEST_RECOVERY', label: 'Fastest Recovery' },
  { mode: 'MOST_TRADES', label: 'Most Trades' },
];

export interface RankingFilters {
  minRecoveryBefore: number; // %
  minRecoveryIgnoring: number; // %
  maxSlHit: number; // %
  minTrades: number;
  maxAvgRecoveryMin: number | null; // minutes, null = no cap
  maxWorstGap: number | null; // null = no cap
  minConfidence: ConfidenceLevel;
}

export const DEFAULT_RANKING_FILTERS: RankingFilters = {
  minRecoveryBefore: 0,
  minRecoveryIgnoring: 0,
  maxSlHit: 100,
  minTrades: 0,
  maxAvgRecoveryMin: null,
  maxWorstGap: null,
  minConfidence: 'VERY_LOW',
};

export interface ScoreBreakdown {
  recovery: number;
  slSafety: number;
  confidence: number;
  tradeCount: number;
  recoveryTime: number;
  worstGapRisk: number;
  overall: number;
}

export interface RankedStrategy {
  record: RepositoryRecord;
  rank: number;
  scores: ScoreBreakdown;
}

export interface RankingResult {
  ranked: RankedStrategy[];
  repositoryCount: number;
  filteredOut: number;
  eligibleCount: number;
  rankedCount: number;
  invalidCount: number;
  averageScore: number | null;
  highlights: {
    top: RankedStrategy | null;
    highestRecovery: RepositoryRecord | null;
    lowestRisk: RepositoryRecord | null;
    fastest: RepositoryRecord | null;
    mostTrades: RepositoryRecord | null;
  };
  filters: RankingFilters;
  mode: RankingMode;
}

type ComponentWeights = Omit<ScoreBreakdown, 'overall'>;

/** Per-mode component weights — each set sums to 100. */
const MODE_WEIGHTS: Record<RankingMode, ComponentWeights> = {
  BALANCED: { recovery: 30, slSafety: 20, confidence: 20, tradeCount: 15, recoveryTime: 10, worstGapRisk: 5 },
  HIGHEST_RECOVERY: { recovery: 60, slSafety: 10, confidence: 15, tradeCount: 8, recoveryTime: 5, worstGapRisk: 2 },
  LOWEST_RISK: { recovery: 10, slSafety: 35, confidence: 25, tradeCount: 0, recoveryTime: 5, worstGapRisk: 25 },
  FASTEST_RECOVERY: { recovery: 25, slSafety: 10, confidence: 15, tradeCount: 0, recoveryTime: 50, worstGapRisk: 0 },
  MOST_TRADES: { recovery: 25, slSafety: 10, confidence: 15, tradeCount: 50, recoveryTime: 0, worstGapRisk: 0 },
};

const EPS = 1e-9;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** Min-max normalize to 0–100. Neutral 50 when the cohort is flat. */
function norm(value: number, min: number, max: number): number {
  if (max - min < EPS) return 50;
  return clamp(((value - min) / (max - min)) * 100, 0, 100);
}

function confidenceIndex(level: ConfidenceLevel): number {
  return CONFIDENCE_ORDER.indexOf(level);
}

function passesFilters(r: RepositoryRecord, f: RankingFilters): boolean {
  if (r.recoveryBeforeSlPct < f.minRecoveryBefore) return false;
  if (r.recoveryIgnoringSlPct < f.minRecoveryIgnoring) return false;
  if (r.slHitPct > f.maxSlHit) return false;
  if (r.historicalTrades < f.minTrades) return false;
  if (f.maxAvgRecoveryMin !== null) {
    if (r.avgRecoverySec === null) return false; // no measurable recovery time
    if (r.avgRecoverySec / 60 > f.maxAvgRecoveryMin) return false;
  }
  if (f.maxWorstGap !== null && r.worstMaxGap !== null && r.worstMaxGap > f.maxWorstGap) {
    return false;
  }
  if (confidenceIndex(r.confidenceLevel) < confidenceIndex(f.minConfidence)) return false;
  return true;
}

interface Cohort {
  recBeforeMin: number; recBeforeMax: number;
  recIgnMin: number; recIgnMax: number;
  slHitMin: number; slHitMax: number;
  tradesMin: number; tradesMax: number;
  recTimeMin: number; recTimeMax: number;
  worstMin: number; worstMax: number;
}

function buildCohort(records: RepositoryRecord[]): Cohort {
  const recTimes = records.map((r) => r.avgRecoverySec).filter((v): v is number => v !== null);
  const worsts = records.map((r) => r.worstMaxGap).filter((v): v is number => v !== null);
  const range = (vals: number[]): [number, number] =>
    vals.length ? [Math.min(...vals), Math.max(...vals)] : [0, 0];
  const [recBeforeMin, recBeforeMax] = range(records.map((r) => r.recoveryBeforeSlPct));
  const [recIgnMin, recIgnMax] = range(records.map((r) => r.recoveryIgnoringSlPct));
  const [slHitMin, slHitMax] = range(records.map((r) => r.slHitPct));
  const [tradesMin, tradesMax] = range(records.map((r) => r.historicalTrades));
  const [recTimeMin, recTimeMax] = range(recTimes);
  const [worstMin, worstMax] = range(worsts);
  return {
    recBeforeMin, recBeforeMax, recIgnMin, recIgnMax, slHitMin, slHitMax,
    tradesMin, tradesMax, recTimeMin, recTimeMax, worstMin, worstMax,
  };
}

/** Computes the six normalized components for one record (cohort-relative). */
function computeComponents(r: RepositoryRecord, c: Cohort): ComponentWeights {
  const recovery =
    0.6 * norm(r.recoveryBeforeSlPct, c.recBeforeMin, c.recBeforeMax) +
    0.4 * norm(r.recoveryIgnoringSlPct, c.recIgnMin, c.recIgnMax);
  const slSafety = 100 - norm(r.slHitPct, c.slHitMin, c.slHitMax); // lower hit = safer
  const confidence = (confidenceIndex(r.confidenceLevel) / 4) * 100;
  const tradeCount = norm(r.historicalTrades, c.tradesMin, c.tradesMax);
  const recoveryTime =
    r.avgRecoverySec === null
      ? 0 // no measurable recovery time ranks worst on speed
      : 100 - norm(r.avgRecoverySec, c.recTimeMin, c.recTimeMax);
  const worstGapRisk =
    r.worstMaxGap === null
      ? 50 // unknown adverse gap is neutral
      : 100 - norm(r.worstMaxGap, c.worstMin, c.worstMax);
  return { recovery, slSafety, confidence, tradeCount, recoveryTime, worstGapRisk };
}

function overallScore(comp: ComponentWeights, mode: RankingMode): number {
  const w = MODE_WEIGHTS[mode];
  return (
    (w.recovery * comp.recovery +
      w.slSafety * comp.slSafety +
      w.confidence * comp.confidence +
      w.tradeCount * comp.tradeCount +
      w.recoveryTime * comp.recoveryTime +
      w.worstGapRisk * comp.worstGapRisk) /
    100
  );
}

function isFiniteScore(s: ScoreBreakdown): boolean {
  return (
    Number.isFinite(s.recovery) &&
    Number.isFinite(s.slSafety) &&
    Number.isFinite(s.confidence) &&
    Number.isFinite(s.tradeCount) &&
    Number.isFinite(s.recoveryTime) &&
    Number.isFinite(s.worstGapRisk) &&
    Number.isFinite(s.overall)
  );
}

/** Filters, scores and ranks repository records. Deterministic. */
export function rankStrategies(
  records: RepositoryRecord[],
  filters: RankingFilters,
  mode: RankingMode,
): RankingResult {
  const eligible = records.filter((r) => passesFilters(r, filters));
  const cohort = buildCohort(eligible);

  const scored: RankedStrategy[] = [];
  let invalidCount = 0;
  for (const record of eligible) {
    const comp = computeComponents(record, cohort);
    const overall = overallScore(comp, mode);
    const scores: ScoreBreakdown = { ...comp, overall };
    if (!isFiniteScore(scores)) {
      invalidCount += 1; // NaN guard — exclude this strategy
      continue;
    }
    scored.push({ record, rank: 0, scores });
  }

  scored.sort((a, b) => {
    if (Math.abs(b.scores.overall - a.scores.overall) > EPS) {
      return b.scores.overall - a.scores.overall;
    }
    // Deterministic tie-breaks: recovery, then lower SL hit, then key.
    if (b.record.recoveryBeforeSlPct !== a.record.recoveryBeforeSlPct) {
      return b.record.recoveryBeforeSlPct - a.record.recoveryBeforeSlPct;
    }
    if (a.record.slHitPct !== b.record.slHitPct) {
      return a.record.slHitPct - b.record.slHitPct;
    }
    return a.record.key < b.record.key ? -1 : a.record.key > b.record.key ? 1 : 0;
  });
  scored.forEach((s, i) => (s.rank = i + 1));

  const averageScore =
    scored.length > 0
      ? scored.reduce((a, s) => a + s.scores.overall, 0) / scored.length
      : null;

  const pick = (
    cmp: (a: RepositoryRecord, b: RepositoryRecord) => RepositoryRecord,
    eligibleFor?: (r: RepositoryRecord) => boolean,
  ): RepositoryRecord | null => {
    const pool = eligibleFor ? scored.map((s) => s.record).filter(eligibleFor) : scored.map((s) => s.record);
    return pool.length ? pool.reduce(cmp) : null;
  };

  return {
    ranked: scored,
    repositoryCount: records.length,
    filteredOut: records.length - eligible.length,
    eligibleCount: eligible.length,
    rankedCount: scored.length,
    invalidCount,
    averageScore,
    highlights: {
      top: scored[0] ?? null,
      highestRecovery: pick((a, b) => (b.recoveryBeforeSlPct > a.recoveryBeforeSlPct ? b : a)),
      lowestRisk: pick((a, b) => {
        if (b.slHitPct < a.slHitPct) return b;
        if (b.slHitPct > a.slHitPct) return a;
        return (b.worstMaxGap ?? Infinity) < (a.worstMaxGap ?? Infinity) ? b : a;
      }),
      fastest: pick(
        (a, b) => ((b.avgRecoverySec as number) < (a.avgRecoverySec as number) ? b : a),
        (r) => r.avgRecoverySec !== null,
      ),
      mostTrades: pick((a, b) => (b.historicalTrades > a.historicalTrades ? b : a)),
    },
    filters,
    mode,
  };
}

// --- export -------------------------------------------------------------------

function csvCell(v: string | number | null): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const r1 = (n: number | null) => (n === null ? '' : Math.round(n * 10) / 10);
const r3 = (n: number | null) => (n === null ? '' : Math.round(n * 1000) / 1000);
const rt = (n: number | null) => (n === null ? '' : Math.round(n));

const CSV_COLUMNS = [
  'Rank', 'Strategy ID', 'Entry Gap', 'Recovery Gap', 'Stop Loss',
  'Recovery Before %', 'Recovery Ignoring %', 'SL Hit %', 'Historical Trades',
  'Avg Recovery (s)', 'Worst Gap', 'Confidence',
  'Recovery Score', 'SL Safety Score', 'Confidence Score', 'Trade Count Score',
  'Recovery Time Score', 'Worst Gap Risk Score', 'Overall Score',
];

function rowToCsv(s: RankedStrategy): Array<string | number> {
  const r = s.record;
  const c = s.scores;
  return [
    s.rank, r.id, r3(r.entryGap), r3(r.recoveryGap), r3(r.stopLoss),
    r1(r.recoveryBeforeSlPct), r1(r.recoveryIgnoringSlPct), r1(r.slHitPct), r.historicalTrades,
    rt(r.avgRecoverySec), r3(r.worstMaxGap), r.confidenceLabel,
    r1(c.recovery), r1(c.slSafety), r1(c.confidence), r1(c.tradeCount),
    r1(c.recoveryTime), r1(c.worstGapRisk), r1(c.overall),
  ];
}

export function rankingCsv(result: RankingResult): SerializedExport {
  const lines = [CSV_COLUMNS.map(csvCell).join(',')];
  for (const s of result.ranked) lines.push(rowToCsv(s).map(csvCell).join(','));
  return { filename: 'StrategyRanking.csv', content: lines.join('\n'), mime: 'text/csv' };
}

export function rankingJson(result: RankingResult, generatedAt: string): SerializedExport {
  const payload = {
    note: 'Ranking is based only on uploaded historical CSV results. This is not a trading signal. Higher rank means stronger historical statistics, not guaranteed future performance.',
    generatedAt,
    rankingMode: result.mode,
    filters: result.filters,
    counts: {
      repository: result.repositoryCount,
      filteredOut: result.filteredOut,
      eligible: result.eligibleCount,
      ranked: result.rankedCount,
      invalid: result.invalidCount,
    },
    averageScore: result.averageScore,
    ranked: result.ranked.map((s) => ({ rank: s.rank, ...s.record, scores: s.scores })),
  };
  return {
    filename: 'StrategyRanking.json',
    content: JSON.stringify(payload, null, 2),
    mime: 'application/json',
  };
}
