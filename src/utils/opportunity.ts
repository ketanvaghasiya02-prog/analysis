/**
 * Historical Opportunity Scanner (Phase 12B) — intelligent presentation layer.
 *
 * Reads the EXISTING Probability Matrix (already computed by the Probability
 * Engine) and surfaces the statistically strongest historical opportunities. It
 * does NOT recompute probabilities, never reruns any engine, and never produces
 * a trading signal or recommendation — it only filters, scores and ranks rows
 * that already exist.
 */

import type { ConfidenceLevel } from '@/utils/scenario';
import type { ProbabilityResult, ProbabilityTargetRow } from '@/utils/probability';
import type { SerializedExport } from '@/utils/reports';

const CONFIDENCE_ORDER: ConfidenceLevel[] = ['VERY_LOW', 'LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH'];

export type MinConfidence = 'ANY' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';

export interface OpportunityFilters {
  minProbability: number; // %
  maxAvgRecoveryMin: number | null; // minutes, null = no cap
  maxWorstExpansion: number | null; // null = no cap
  minEvents: number;
  maxP95Expansion: number | null; // null = no cap
  minConfidence: MinConfidence;
}

export const DEFAULT_OPPORTUNITY_FILTERS: OpportunityFilters = {
  minProbability: 90,
  maxAvgRecoveryMin: null,
  maxWorstExpansion: null,
  minEvents: 20,
  maxP95Expansion: null,
  minConfidence: 'ANY',
};

export interface ScoreComponents {
  probability: number;
  time: number;
  expansion: number;
  events: number;
  confidence: number;
}

export interface OpportunityRow {
  rank: number;
  row: ProbabilityTargetRow;
  score: number;
  components: ScoreComponents;
}

export interface OpportunityResult {
  ranked: OpportunityRow[];
  totalRows: number;
  eligibleCount: number;
  best: OpportunityRow | null;
  highlights: {
    highestProbability: ProbabilityTargetRow | null;
    highestConfidence: ProbabilityTargetRow | null;
    fastestRecovery: ProbabilityTargetRow | null;
    safestExpansion: ProbabilityTargetRow | null;
    largestSample: ProbabilityTargetRow | null;
  };
  filters: OpportunityFilters;
}

/** Fixed, deterministic component weights (sum to 1). */
const WEIGHTS: ScoreComponents = {
  probability: 0.45,
  time: 0.15,
  expansion: 0.15,
  events: 0.1,
  confidence: 0.15,
};

const EPS = 1e-9;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function norm(value: number, min: number, max: number): number {
  if (max - min < EPS) return 50;
  return clamp(((value - min) / (max - min)) * 100, 0, 100);
}

function confidenceIndex(level: ConfidenceLevel): number {
  return CONFIDENCE_ORDER.indexOf(level);
}

function minConfidenceIndex(min: MinConfidence): number {
  switch (min) {
    case 'MEDIUM':
      return 2;
    case 'HIGH':
      return 3;
    case 'VERY_HIGH':
      return 4;
    default:
      return -1; // ANY
  }
}

function passesFilters(r: ProbabilityTargetRow, f: OpportunityFilters): boolean {
  if (r.probabilityPct < f.minProbability) return false;
  if (r.totalEvents < f.minEvents) return false;
  if (f.maxAvgRecoveryMin !== null) {
    if (r.avgTimeSec === null) return false;
    if (r.avgTimeSec / 60 > f.maxAvgRecoveryMin) return false;
  }
  if (f.maxWorstExpansion !== null && r.worstMaxGap !== null && r.worstMaxGap > f.maxWorstExpansion) {
    return false;
  }
  if (f.maxP95Expansion !== null && r.p95MaxGap !== null && r.p95MaxGap > f.maxP95Expansion) {
    return false;
  }
  if (confidenceIndex(r.confidenceLevel) < minConfidenceIndex(f.minConfidence)) return false;
  return true;
}

/**
 * Scans the probability matrix: scores every row deterministically (cohort =
 * the full matrix, so scores are stable), then filters and ranks.
 */
export function scanOpportunities(
  result: ProbabilityResult,
  filters: OpportunityFilters,
): OpportunityResult {
  const rows = result.rows;

  // Normalisation cohort = the full matrix (stable, filter-independent).
  const times = rows.map((r) => r.avgTimeSec).filter((v): v is number => v !== null);
  const expansions = rows.map((r) => r.worstMaxGap).filter((v): v is number => v !== null);
  const reached = rows.map((r) => r.reachedCount);
  const range = (vals: number[]): [number, number] =>
    vals.length ? [Math.min(...vals), Math.max(...vals)] : [0, 0];
  const [timeMin, timeMax] = range(times);
  const [expMin, expMax] = range(expansions);
  const [reachMin, reachMax] = range(reached);

  const scoreOf = (r: ProbabilityTargetRow): { score: number; components: ScoreComponents } => {
    const components: ScoreComponents = {
      probability: clamp(r.probabilityPct, 0, 100),
      time: r.avgTimeSec === null ? 0 : 100 - norm(r.avgTimeSec, timeMin, timeMax),
      expansion: r.worstMaxGap === null ? 50 : 100 - norm(r.worstMaxGap, expMin, expMax),
      events: norm(r.reachedCount, reachMin, reachMax),
      confidence: (confidenceIndex(r.confidenceLevel) / 4) * 100,
    };
    const score =
      WEIGHTS.probability * components.probability +
      WEIGHTS.time * components.time +
      WEIGHTS.expansion * components.expansion +
      WEIGHTS.events * components.events +
      WEIGHTS.confidence * components.confidence;
    return { score, components };
  };

  const eligible = rows.filter((r) => passesFilters(r, filters));
  const ranked: OpportunityRow[] = eligible
    .map((row) => ({ row, ...scoreOf(row), rank: 0 }))
    .sort((a, b) => {
      if (Math.abs(b.score - a.score) > EPS) return b.score - a.score;
      // Deterministic tie-breaks: probability, then deeper target.
      if (b.row.probabilityPct !== a.row.probabilityPct) return b.row.probabilityPct - a.row.probabilityPct;
      return a.row.targetGap - b.row.targetGap;
    });
  ranked.forEach((o, i) => (o.rank = i + 1));

  const pick = (
    pool: ProbabilityTargetRow[],
    cmp: (a: ProbabilityTargetRow, b: ProbabilityTargetRow) => ProbabilityTargetRow,
    eligibleFor?: (r: ProbabilityTargetRow) => boolean,
  ): ProbabilityTargetRow | null => {
    const list = eligibleFor ? pool.filter(eligibleFor) : pool;
    return list.length ? list.reduce(cmp) : null;
  };

  return {
    ranked,
    totalRows: rows.length,
    eligibleCount: eligible.length,
    best: ranked[0] ?? null,
    highlights: {
      highestProbability: pick(eligible, (a, b) => (b.probabilityPct > a.probabilityPct ? b : a)),
      highestConfidence: pick(eligible, (a, b) => {
        const d = confidenceIndex(b.confidenceLevel) - confidenceIndex(a.confidenceLevel);
        if (d > 0) return b;
        if (d < 0) return a;
        return b.probabilityPct > a.probabilityPct ? b : a;
      }),
      fastestRecovery: pick(
        eligible,
        (a, b) => ((b.avgTimeSec as number) < (a.avgTimeSec as number) ? b : a),
        (r) => r.avgTimeSec !== null,
      ),
      safestExpansion: pick(
        eligible,
        (a, b) => ((b.worstMaxGap as number) < (a.worstMaxGap as number) ? b : a),
        (r) => r.worstMaxGap !== null,
      ),
      largestSample: pick(eligible, (a, b) => (b.reachedCount > a.reachedCount ? b : a)),
    },
    filters,
  };
}

/** Probability colour band (per spec). Returns Tailwind-friendly classes. */
export function probabilityBand(p: number): { label: string; text: string; bg: string; border: string; dot: string } {
  if (p >= 95) return { label: '95%+', text: 'text-positive', bg: 'bg-positive/15', border: 'border-positive/40', dot: 'bg-positive' };
  if (p >= 90) return { label: '90–95%', text: 'text-positive', bg: 'bg-positive/10', border: 'border-positive/30', dot: 'bg-positive/70' };
  if (p >= 80) return { label: '80–90%', text: 'text-warning', bg: 'bg-warning/10', border: 'border-warning/30', dot: 'bg-warning' };
  if (p >= 60) return { label: '60–80%', text: 'text-orange-300', bg: 'bg-orange-500/10', border: 'border-orange-500/30', dot: 'bg-orange-400' };
  return { label: '<60%', text: 'text-negative', bg: 'bg-negative/10', border: 'border-negative/30', dot: 'bg-negative' };
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
  'Rank', 'Target Gap', 'Historical Probability %', 'Avg Recovery (s)',
  'Historical Events', 'Worst Expansion', 'P95 Expansion', 'Confidence', 'Opportunity Score',
];

function rowToCsv(o: OpportunityRow): Array<string | number> {
  const r = o.row;
  return [
    o.rank, r3(r.targetGap), r1(r.probabilityPct), rt(r.avgTimeSec),
    r.totalEvents, r3(r.worstMaxGap), r3(r.p95MaxGap), r.confidenceLabel, r1(o.score),
  ];
}

export function opportunityCsv(result: OpportunityResult): SerializedExport {
  const lines = [CSV_COLUMNS.map(csvCell).join(',')];
  for (const o of result.ranked) lines.push(rowToCsv(o).map(csvCell).join(','));
  return { filename: 'HistoricalOpportunities.csv', content: lines.join('\n'), mime: 'text/csv' };
}

export function opportunityJson(result: OpportunityResult, currentGap: number, generatedAt: string): SerializedExport {
  const payload = {
    note: 'Historical opportunities surfaced from the existing Probability Matrix. Historical evidence only — not a trading signal or recommendation.',
    generatedAt,
    currentGap,
    filters: result.filters,
    eligibleCount: result.eligibleCount,
    opportunities: result.ranked.map((o) => ({
      rank: o.rank,
      targetGap: o.row.targetGap,
      probabilityPct: o.row.probabilityPct,
      avgRecoverySec: o.row.avgTimeSec,
      historicalEvents: o.row.totalEvents,
      worstExpansion: o.row.worstMaxGap,
      p95Expansion: o.row.p95MaxGap,
      confidence: o.row.confidenceLabel,
      opportunityScore: o.score,
      components: o.components,
    })),
  };
  return { filename: 'HistoricalOpportunities.json', content: JSON.stringify(payload, null, 2), mime: 'application/json' };
}
