/**
 * Walk Forward Validation (Phase 15) — the official historical validation layer.
 *
 * Determines whether a historically strong strategy remains robust on UNSEEN
 * historical data. It splits a stored strategy's already-computed occurrences
 * into a Training window and a following (unseen) Validation window and compares
 * their statistics.
 *
 * It validates — it never optimizes, never creates strategies, never regenerates
 * parameters, and never reruns the Research / Probability engines. It reuses the
 * Research Repository (stored occurrences) and the frozen Reliability Engine.
 * Deterministic; no AI; no hidden weighting.
 */

import type { OccurrenceRecord } from '@/utils/strategyExecution';
import type { RepositoryRecord } from '@/utils/researchRepository';
import { buildReliability } from '@/utils/reliability';
import type { SerializedExport } from '@/utils/reports';

export interface WalkForwardConfig {
  trainingDays: number;
  validationDays: number;
  walkSize: number; // days to slide each walk
  minEvents: number;
  recentWindowDays: number; // passed to the Reliability Engine
}

export const DEFAULT_WALK_FORWARD_CONFIG: WalkForwardConfig = {
  trainingDays: 20,
  validationDays: 10,
  walkSize: 5,
  minEvents: 15,
  recentWindowDays: 20,
};

export interface WindowMetrics {
  events: number;
  recoveryPct: number; // recovered before SL
  probabilityPct: number; // recovered before or after SL
  holdingAvgSec: number | null;
  expansionAvg: number | null;
  expansionWorst: number | null;
  reliability: number; // 0–100 from the frozen Reliability Engine
}

export type DriftLevel = 'Minor' | 'Moderate' | 'Major';

export interface MetricDrift {
  key: string;
  label: string;
  train: number | null;
  validation: number | null;
  diff: number | null;
  level: DriftLevel;
}

export type ValidationStatus = 'Passed' | 'Borderline' | 'Failed';
export type RobustnessGrade = 'A+' | 'A' | 'B+' | 'B' | 'C' | 'Low';

export interface WalkResult {
  index: number;
  trainStart: string;
  trainEnd: string;
  valStart: string;
  valEnd: string;
  training: WindowMetrics;
  validation: WindowMetrics;
  robustness: number; // 0–100
  grade: RobustnessGrade;
  status: ValidationStatus;
  drifts: MetricDrift[];
}

export interface WalkForwardAggregate {
  totalWalks: number;
  passed: number;
  borderline: number;
  failed: number;
  avgRobustness: number | null;
  avgDrift: number | null; // mean |recovery drift| points
  avgRecoveryDiff: number | null;
}

export interface WalkForwardResult {
  record: RepositoryRecord;
  walks: WalkResult[];
  aggregate: WalkForwardAggregate;
  config: WalkForwardConfig;
  spanDays: number;
  warnings: string[];
}

// --- helpers ------------------------------------------------------------------

const MAX_WALKS = 200;

function mean(v: number[]): number | null {
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}
function clamp(v: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, v));
}
function dayNum(date: string): number {
  const ms = Date.parse(`${date}T00:00:00Z`);
  return Number.isFinite(ms) ? Math.floor(ms / 86_400_000) : NaN;
}
function dayLabel(day: number): string {
  return new Date(day * 86_400_000).toISOString().slice(0, 10);
}
function inRange(o: OccurrenceRecord, lo: number, hi: number): boolean {
  const d = dayNum(o.date);
  return Number.isFinite(d) && d >= lo && d <= hi;
}

function windowMetrics(
  subset: OccurrenceRecord[],
  record: RepositoryRecord,
  recentWindowDays: number,
): WindowMetrics {
  const events = subset.length;
  const before = subset.filter((o) => o.outcome === 'RECOVERED_BEFORE_SL').length;
  const any = subset.filter(
    (o) => o.outcome === 'RECOVERED_BEFORE_SL' || o.outcome === 'RECOVERED_AFTER_SL',
  ).length;
  const holdings = subset.map((o) => o.holdingSec).filter((v): v is number => v !== null);
  const gaps = subset.map((o) => o.maxGap).filter((v) => Number.isFinite(v));
  const reliability =
    events > 0
      ? buildReliability({ ...record, occurrences: subset, totalPositions: events }, { recentWindowDays }).overall
      : 0;
  return {
    events,
    recoveryPct: events ? (before / events) * 100 : 0,
    probabilityPct: events ? (any / events) * 100 : 0,
    holdingAvgSec: mean(holdings),
    expansionAvg: mean(gaps),
    expansionWorst: gaps.length ? Math.max(...gaps) : null,
    reliability,
  };
}

/** Similarity (0–100) for percentage/points metrics: identical → 100. */
function simPoints(a: number, b: number): number {
  return clamp(100 - Math.abs(a - b));
}
/** Similarity (0–100) for ratio metrics: relative deviation, capped. */
function simRelative(a: number | null, b: number | null): number {
  if (a === null || b === null) return 50;
  const base = Math.max(Math.abs(a), 1e-9);
  return clamp(100 * (1 - Math.min(1, Math.abs(a - b) / base)));
}

/** Robustness — explicit fixed weights (sum 100). No hidden weighting. */
function robustnessOf(t: WindowMetrics, v: WindowMetrics): number {
  const simRecovery = simPoints(t.recoveryPct, v.recoveryPct);
  const simProb = simPoints(t.probabilityPct, v.probabilityPct);
  const simHold = simRelative(t.holdingAvgSec, v.holdingAvgSec);
  const simExp = simRelative(t.expansionAvg, v.expansionAvg);
  const simRel = simPoints(t.reliability, v.reliability);
  return clamp((30 * simRecovery + 20 * simProb + 15 * simHold + 15 * simExp + 20 * simRel) / 100);
}

function driftLevelPoints(diff: number, minor: number, moderate: number): DriftLevel {
  const d = Math.abs(diff);
  return d < minor ? 'Minor' : d < moderate ? 'Moderate' : 'Major';
}
function driftLevelRel(a: number | null, b: number | null, minor: number, moderate: number): DriftLevel {
  if (a === null || b === null) return 'Moderate';
  const rel = Math.abs(a - b) / Math.max(Math.abs(a), 1e-9);
  return rel < minor ? 'Minor' : rel < moderate ? 'Moderate' : 'Major';
}

function buildDrifts(t: WindowMetrics, v: WindowMetrics): MetricDrift[] {
  const pts = (key: string, label: string, a: number, b: number, minor: number, moderate: number): MetricDrift => ({
    key, label, train: a, validation: b, diff: b - a, level: driftLevelPoints(b - a, minor, moderate),
  });
  const rel = (key: string, label: string, a: number | null, b: number | null, minor: number, moderate: number): MetricDrift => ({
    key, label, train: a, validation: b, diff: a !== null && b !== null ? b - a : null, level: driftLevelRel(a, b, minor, moderate),
  });
  return [
    pts('recovery', 'Recovery Drift', t.recoveryPct, v.recoveryPct, 5, 15),
    pts('probability', 'Probability Drift', t.probabilityPct, v.probabilityPct, 5, 15),
    rel('holding', 'Holding Drift', t.holdingAvgSec, v.holdingAvgSec, 0.15, 0.35),
    rel('expansion', 'Expansion Drift', t.expansionAvg, v.expansionAvg, 0.15, 0.35),
    pts('reliability', 'Reliability Drift', t.reliability, v.reliability, 8, 20),
  ];
}

export function robustnessGrade(score: number): RobustnessGrade {
  if (score >= 95) return 'A+';
  if (score >= 90) return 'A';
  if (score >= 85) return 'B+';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  return 'Low';
}

function statusOf(robustness: number, t: WindowMetrics, v: WindowMetrics, minEvents: number): ValidationStatus {
  if (t.events < minEvents || v.events < minEvents) return 'Failed';
  if (robustness >= 80) return 'Passed';
  if (robustness >= 65) return 'Borderline';
  return 'Failed';
}

function buildWalk(
  index: number,
  trainLo: number, trainHi: number, valLo: number, valHi: number,
  occ: OccurrenceRecord[], record: RepositoryRecord, config: WalkForwardConfig,
): WalkResult {
  const train = windowMetrics(occ.filter((o) => inRange(o, trainLo, trainHi)), record, config.recentWindowDays);
  const validation = windowMetrics(occ.filter((o) => inRange(o, valLo, valHi)), record, config.recentWindowDays);
  const robustness = robustnessOf(train, validation);
  return {
    index,
    trainStart: dayLabel(trainLo), trainEnd: dayLabel(trainHi),
    valStart: dayLabel(valLo), valEnd: dayLabel(valHi),
    training: train, validation,
    robustness,
    grade: robustnessGrade(robustness),
    status: statusOf(robustness, train, validation, config.minEvents),
    drifts: buildDrifts(train, validation),
  };
}

/** Runs walk-forward validation over one stored strategy's occurrences. */
export function buildWalkForward(record: RepositoryRecord, config: WalkForwardConfig): WalkForwardResult {
  const occ = (record.occurrences ?? []).filter((o) => Number.isFinite(dayNum(o.date)));
  const warnings: string[] = [];

  if (occ.length === 0) {
    return { record, walks: [], aggregate: emptyAggregate(), config, spanDays: 0, warnings: ['This strategy has no dated occurrences to validate.'] };
  }

  const days = occ.map((o) => dayNum(o.date));
  const minDay = Math.min(...days);
  const maxDay = Math.max(...days);
  const spanDays = maxDay - minDay + 1;
  const block = config.trainingDays + config.validationDays;

  const walks: WalkResult[] = [];

  if (spanDays < block) {
    // Short dataset — a single proportional split across the available span.
    warnings.push(`Dataset span (${spanDays}d) is shorter than the training+validation block (${block}d). A single proportional split was used.`);
    const trainLen = Math.max(1, Math.round((spanDays * config.trainingDays) / block));
    const trainHi = minDay + trainLen - 1;
    walks.push(buildWalk(0, minDay, trainHi, trainHi + 1, maxDay, occ, record, config));
  } else {
    let start = minDay;
    let i = 0;
    while (start + block - 1 <= maxDay && i < MAX_WALKS) {
      const trainHi = start + config.trainingDays - 1;
      const valLo = start + config.trainingDays;
      const valHi = valLo + config.validationDays - 1;
      walks.push(buildWalk(i, start, trainHi, valLo, valHi, occ, record, config));
      start += Math.max(1, config.walkSize);
      i += 1;
    }
    if (i >= MAX_WALKS) warnings.push(`Walk count capped at ${MAX_WALKS} — increase the walk size to cover the full span.`);
  }

  const thin = walks.filter((w) => w.training.events < config.minEvents || w.validation.events < config.minEvents).length;
  if (thin > 0) warnings.push(`${thin} walk(s) had a window below the minimum of ${config.minEvents} events — marked Failed for insufficient data.`);
  warnings.push('Validation only — this never optimizes parameters, modifies ranking, or recommends a strategy.');

  return { record, walks, aggregate: aggregate(walks), config, spanDays, warnings };
}

function emptyAggregate(): WalkForwardAggregate {
  return { totalWalks: 0, passed: 0, borderline: 0, failed: 0, avgRobustness: null, avgDrift: null, avgRecoveryDiff: null };
}

function aggregate(walks: WalkResult[]): WalkForwardAggregate {
  if (walks.length === 0) return emptyAggregate();
  const recoveryDiffs = walks.map((w) => Math.abs(w.validation.recoveryPct - w.training.recoveryPct));
  return {
    totalWalks: walks.length,
    passed: walks.filter((w) => w.status === 'Passed').length,
    borderline: walks.filter((w) => w.status === 'Borderline').length,
    failed: walks.filter((w) => w.status === 'Failed').length,
    avgRobustness: mean(walks.map((w) => w.robustness)),
    avgDrift: mean(recoveryDiffs),
    avgRecoveryDiff: mean(recoveryDiffs),
  };
}

// --- export -------------------------------------------------------------------

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const r1 = (n: number | null) => (n === null ? '' : Math.round(n * 10) / 10);
const rt = (n: number | null) => (n === null ? '' : Math.round(n));

const CSV_COLUMNS = [
  'Walk', 'Train Start', 'Train End', 'Val Start', 'Val End',
  'Train Events', 'Val Events',
  'Train Recovery %', 'Val Recovery %', 'Train Probability %', 'Val Probability %',
  'Train Holding (s)', 'Val Holding (s)', 'Train Expansion', 'Val Expansion',
  'Train Reliability', 'Val Reliability', 'Robustness', 'Grade', 'Status',
];

function rowOf(w: WalkResult): Array<string | number> {
  const t = w.training, v = w.validation;
  return [
    w.index + 1, w.trainStart, w.trainEnd, w.valStart, w.valEnd,
    t.events, v.events,
    r1(t.recoveryPct), r1(v.recoveryPct), r1(t.probabilityPct), r1(v.probabilityPct),
    rt(t.holdingAvgSec), rt(v.holdingAvgSec), r1(t.expansionAvg), r1(v.expansionAvg),
    r1(t.reliability), r1(v.reliability), r1(w.robustness), w.grade, w.status,
  ];
}

export function walkForwardCsv(result: WalkForwardResult): SerializedExport {
  const lines = [CSV_COLUMNS.map(csvCell).join(',')];
  for (const w of result.walks) lines.push(rowOf(w).map(csvCell).join(','));
  return { filename: 'WalkForwardValidation.csv', content: lines.join('\n'), mime: 'text/csv' };
}

export function walkForwardJson(result: WalkForwardResult, generatedAt: string): SerializedExport {
  const payload = {
    note: 'Walk-forward validation of stored historical research on unseen historical windows. Validation only — never optimization, recommendation or prediction.',
    generatedAt,
    strategy: { id: result.record.id, entryGap: result.record.entryGap, recoveryGap: result.record.recoveryGap, stopLoss: result.record.stopLoss },
    config: result.config,
    aggregate: result.aggregate,
    walks: result.walks,
    warnings: result.warnings,
  };
  return { filename: 'WalkForwardValidation.json', content: JSON.stringify(payload, null, 2), mime: 'application/json' };
}
