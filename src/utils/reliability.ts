/**
 * Reliability Engine (Phase 14) — the official trust layer of GRT.
 *
 * Probability tells WHAT happened; Reliability tells HOW MUCH WE SHOULD TRUST
 * IT. This engine NEVER reruns the Research Engine or the Probability Engine and
 * never scans CSV directly. It evaluates the QUALITY of an existing stored
 * research result (a Research Repository record and its captured occurrences)
 * and produces a deterministic 0–100 reliability score from independent,
 * explicitly-weighted components.
 *
 * Deterministic, fully documented, no AI, no hidden weighting, no randomness.
 */

import type { OccurrenceRecord } from '@/utils/strategyExecution';
import type { RepositoryRecord } from '@/utils/researchRepository';
import type { SerializedExport } from '@/utils/reports';

export interface ReliabilityConfig {
  /** Recent research window (days). Recent observations weigh more (Rule 7). */
  recentWindowDays: number;
}

export const DEFAULT_RELIABILITY_CONFIG: ReliabilityConfig = { recentWindowDays: 20 };

export type ComponentKey =
  | 'sampleSize'
  | 'probabilityStability'
  | 'holdingStability'
  | 'expansionStability'
  | 'historicalConsistency'
  | 'sessionConsistency'
  | 'recentConsistency';

export interface ComponentScore {
  key: ComponentKey;
  label: string;
  score: number; // 0–100
  weight: number; // points toward the final score (sum = 100)
  detail: string;
}

export interface ReliabilityTimelinePoint {
  weekStart: string;
  occurrences: number;
  recoveryPct: number;
}

export interface ReliabilityResult {
  record: RepositoryRecord;
  components: ComponentScore[];
  overall: number; // 0–100
  grade: ReliabilityGrade;
  stars: number; // 0–5 sample-quality stars
  sampleSize: number;
  recoveryRate: number; // recovered-before-SL % over occurrences
  timeline: ReliabilityTimelinePoint[];
  warnings: string[];
}

export type ReliabilityGrade = 'A+' | 'A' | 'B+' | 'B' | 'C' | 'Low Reliability';

/** Explicit, fixed component weights (sum to 100). No hidden weighting. */
const WEIGHTS: Record<ComponentKey, number> = {
  sampleSize: 20,
  probabilityStability: 20,
  holdingStability: 12,
  expansionStability: 12,
  historicalConsistency: 14,
  sessionConsistency: 12,
  recentConsistency: 10,
};

const LABELS: Record<ComponentKey, string> = {
  sampleSize: 'Sample Quality',
  probabilityStability: 'Probability Stability',
  holdingStability: 'Holding Stability',
  expansionStability: 'Expansion Stability',
  historicalConsistency: 'Historical Consistency',
  sessionConsistency: 'Session Consistency',
  recentConsistency: 'Recent Consistency',
};

// --- small deterministic helpers ---------------------------------------------

function clamp(v: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, v));
}
function mean(v: number[]): number | null {
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}
function stdDev(v: number[]): number | null {
  if (v.length < 2) return null;
  const m = v.reduce((a, b) => a + b, 0) / v.length;
  return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (v.length - 1));
}
/** Coefficient of variation (std / mean), or null. */
function cv(v: number[]): number | null {
  const m = mean(v);
  const s = stdDev(v);
  if (m === null || s === null || m <= 1e-9) return null;
  return s / m;
}
/** A bounded stability score from a CV: cv 0 → 100, cv 1 → 50, cv 2 → 33. */
function stabilityFromCv(c: number | null): number {
  if (c === null) return 50; // not enough data to judge → neutral
  return clamp(100 / (1 + c));
}
function isSuccess(o: OccurrenceRecord): boolean {
  return o.outcome === 'RECOVERED_BEFORE_SL';
}
function recoveryRateOf(list: OccurrenceRecord[]): number {
  return list.length ? (list.filter(isSuccess).length / list.length) * 100 : 0;
}
function dayNum(date: string): number {
  const ms = Date.parse(`${date}T00:00:00Z`);
  return Number.isFinite(ms) ? Math.floor(ms / 86_400_000) : NaN;
}
function sortedByTime(occ: OccurrenceRecord[]): OccurrenceRecord[] {
  return [...occ].sort((a, b) => {
    const d = `${a.date} ${a.time}`;
    const e = `${b.date} ${b.time}`;
    return d < e ? -1 : d > e ? 1 : 0;
  });
}

// --- component scores ---------------------------------------------------------

/** 1. Sample Size — sqrt scaling, saturating at 200 events. */
function sampleSizeScore(n: number): { score: number; detail: string } {
  const score = clamp(Math.sqrt(n / 200) * 100);
  return { score, detail: `${n} historical event${n === 1 ? '' : 's'}` };
}

/** 2. Probability Stability — dispersion of recovery rate across equal buckets. */
function probabilityStabilityScore(occ: OccurrenceRecord[]): { score: number; detail: string } {
  if (occ.length < 4) return { score: 50, detail: 'too few events to assess' };
  const ordered = sortedByTime(occ);
  const buckets = Math.min(5, Math.max(2, Math.floor(ordered.length / 4)));
  const size = Math.ceil(ordered.length / buckets);
  const rates: number[] = [];
  for (let i = 0; i < ordered.length; i += size) rates.push(recoveryRateOf(ordered.slice(i, i + size)));
  const s = stdDev(rates) ?? 0;
  const score = clamp(100 - 2 * s);
  return { score, detail: `${buckets} buckets · recovery σ ${s.toFixed(1)}%` };
}

/** 3. Holding Stability — CV of recovery time across recovered events. */
function holdingStabilityScore(occ: OccurrenceRecord[]): { score: number; detail: string } {
  const times = occ.map((o) => o.recoveryTimeSec).filter((v): v is number => v !== null);
  const c = cv(times);
  return { score: stabilityFromCv(c), detail: c === null ? 'insufficient recovery times' : `recovery-time CV ${c.toFixed(2)}` };
}

/** 4. Expansion Stability — CV of max adverse gap across occurrences. */
function expansionStabilityScore(occ: OccurrenceRecord[]): { score: number; detail: string } {
  const gaps = occ.map((o) => o.maxGap).filter((v) => Number.isFinite(v));
  const c = cv(gaps);
  return { score: stabilityFromCv(c), detail: c === null ? 'insufficient data' : `max-gap CV ${c.toFixed(2)}` };
}

/** 5. Historical Consistency — early-third vs late-third recovery rate drift. */
function historicalConsistencyScore(occ: OccurrenceRecord[]): { score: number; detail: string } {
  if (occ.length < 6) return { score: 50, detail: 'too few events to assess drift' };
  const ordered = sortedByTime(occ);
  const third = Math.floor(ordered.length / 3);
  const early = recoveryRateOf(ordered.slice(0, third));
  const late = recoveryRateOf(ordered.slice(ordered.length - third));
  const score = clamp(100 - Math.abs(early - late));
  return { score, detail: `early ${early.toFixed(0)}% vs late ${late.toFixed(0)}%` };
}

/** 6. Session Consistency — dispersion of recovery rate across sessions. */
function sessionConsistencyScore(occ: OccurrenceRecord[]): { score: number; detail: string; singleSession: boolean } {
  const bySession = new Map<string, OccurrenceRecord[]>();
  for (const o of occ) {
    const list = bySession.get(o.session);
    if (list) list.push(o);
    else bySession.set(o.session, [o]);
  }
  const sessions = [...bySession.entries()].filter(([, list]) => list.length >= 3);
  if (sessions.length <= 1) {
    return { score: 55, detail: `${bySession.size} session(s) — cannot assess cross-session`, singleSession: true };
  }
  const rates = sessions.map(([, list]) => recoveryRateOf(list));
  const s = stdDev(rates) ?? 0;
  const score = clamp(100 - 1.5 * s);
  return { score, detail: `${sessions.length} sessions · recovery σ ${s.toFixed(1)}%`, singleSession: false };
}

/** 7. Recent Consistency — recent-window recovery rate vs overall. */
function recentConsistencyScore(
  occ: OccurrenceRecord[],
  windowDays: number,
): { score: number; detail: string; recentCount: number } {
  const days = occ.map((o) => dayNum(o.date)).filter((d) => Number.isFinite(d));
  if (days.length === 0) return { score: 50, detail: 'no dated events', recentCount: 0 };
  const maxDay = Math.max(...days);
  const recent = occ.filter((o) => Number.isFinite(dayNum(o.date)) && dayNum(o.date) >= maxDay - windowDays);
  if (recent.length < 3) return { score: 55, detail: `only ${recent.length} events in the last ${windowDays}d`, recentCount: recent.length };
  const recentRate = recoveryRateOf(recent);
  const overallRate = recoveryRateOf(occ);
  const score = clamp(100 - Math.abs(recentRate - overallRate));
  return { score, detail: `recent ${recentRate.toFixed(0)}% vs overall ${overallRate.toFixed(0)}%`, recentCount: recent.length };
}

// --- timeline -----------------------------------------------------------------

function buildTimeline(occ: OccurrenceRecord[], windowDays: number): ReliabilityTimelinePoint[] {
  const dated = occ.filter((o) => Number.isFinite(dayNum(o.date)));
  if (dated.length === 0) return [];
  const maxDay = Math.max(...dated.map((o) => dayNum(o.date)));
  // Research window only — at most the recent windowDays, bucketed by 7-day weeks.
  const startDay = maxDay - windowDays;
  const weeks = new Map<number, OccurrenceRecord[]>();
  for (const o of dated) {
    const d = dayNum(o.date);
    if (d < startDay) continue;
    const week = Math.floor((d - startDay) / 7);
    const list = weeks.get(week);
    if (list) list.push(o);
    else weeks.set(week, [o]);
  }
  return [...weeks.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([week, list]) => {
      const ws = startDay + week * 7;
      const iso = new Date(ws * 86_400_000).toISOString().slice(0, 10);
      return { weekStart: iso, occurrences: list.length, recoveryPct: recoveryRateOf(list) };
    });
}

// --- grade --------------------------------------------------------------------

export function gradeFor(score: number): ReliabilityGrade {
  if (score >= 95) return 'A+';
  if (score >= 90) return 'A';
  if (score >= 85) return 'B+';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  return 'Low Reliability';
}

// --- main ---------------------------------------------------------------------

/** Evaluates the reliability of one stored research result. */
export function buildReliability(record: RepositoryRecord, config: ReliabilityConfig): ReliabilityResult {
  const occ = record.occurrences ?? [];
  const n = occ.length;
  const recoveryRate = recoveryRateOf(occ);

  const sample = sampleSizeScore(n);
  const probStab = probabilityStabilityScore(occ);
  const holdStab = holdingStabilityScore(occ);
  const expStab = expansionStabilityScore(occ);
  const histConsist = historicalConsistencyScore(occ);
  const sessConsist = sessionConsistencyScore(occ);
  const recentConsist = recentConsistencyScore(occ, config.recentWindowDays);

  const components: ComponentScore[] = [
    { key: 'sampleSize', label: LABELS.sampleSize, score: sample.score, weight: WEIGHTS.sampleSize, detail: sample.detail },
    { key: 'probabilityStability', label: LABELS.probabilityStability, score: probStab.score, weight: WEIGHTS.probabilityStability, detail: probStab.detail },
    { key: 'holdingStability', label: LABELS.holdingStability, score: holdStab.score, weight: WEIGHTS.holdingStability, detail: holdStab.detail },
    { key: 'expansionStability', label: LABELS.expansionStability, score: expStab.score, weight: WEIGHTS.expansionStability, detail: expStab.detail },
    { key: 'historicalConsistency', label: LABELS.historicalConsistency, score: histConsist.score, weight: WEIGHTS.historicalConsistency, detail: histConsist.detail },
    { key: 'sessionConsistency', label: LABELS.sessionConsistency, score: sessConsist.score, weight: WEIGHTS.sessionConsistency, detail: sessConsist.detail },
    { key: 'recentConsistency', label: LABELS.recentConsistency, score: recentConsist.score, weight: WEIGHTS.recentConsistency, detail: recentConsist.detail },
  ];

  const overall = clamp(components.reduce((a, c) => a + (c.weight * c.score) / 100, 0));
  const grade = gradeFor(overall);
  const stars = clamp(Math.round(sample.score / 20), 0, 5);

  return {
    record,
    components,
    overall,
    grade,
    stars,
    sampleSize: n,
    recoveryRate,
    timeline: buildTimeline(occ, config.recentWindowDays),
    warnings: buildWarnings({ n, components, sessConsist, recentConsist }),
  };
}

function buildWarnings(x: {
  n: number;
  components: ComponentScore[];
  sessConsist: { singleSession: boolean };
  recentConsist: { recentCount: number };
}): string[] {
  const out: string[] = [];
  const get = (k: ComponentKey) => x.components.find((c) => c.key === k)?.score ?? 100;

  if (x.n < 20) out.push(`Historical sample is small (${x.n} events) — reliability is limited.`);
  if (get('probabilityStability') < 60) out.push('Probability is unstable across the research window.');
  if (get('holdingStability') < 50) out.push('Holding time is unstable.');
  if (get('expansionStability') < 50) out.push('Large expansion variability detected.');
  if (get('historicalConsistency') < 70) out.push('Historical behaviour drifts across the window.');
  if (x.sessConsist.singleSession) out.push('Behaviour observed in a single session — session dependency cannot be ruled out.');
  else if (get('sessionConsistency') < 60) out.push('Session dependency detected — performance varies by session.');
  if (get('recentConsistency') < 70) out.push('Recent behaviour differs from earlier observations.');

  out.push('Reliability describes the trustworthiness of historical evidence only — not a prediction or recommendation.');
  return out;
}

// --- export -------------------------------------------------------------------

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const r1 = (n: number) => Math.round(n * 10) / 10;

const CSV_COLUMNS = [
  'Strategy', 'Entry', 'Recovery', 'Stop Loss', 'Sample', 'Recovery %',
  'Sample Quality', 'Probability Stability', 'Holding Stability', 'Expansion Stability',
  'Historical Consistency', 'Session Consistency', 'Recent Consistency',
  'Overall Reliability', 'Grade', 'Confidence',
];

function rowOf(res: ReliabilityResult): Array<string | number> {
  const c = (k: ComponentKey) => r1(res.components.find((x) => x.key === k)?.score ?? 0);
  const r = res.record;
  return [
    r.id, r.entryGap, r.recoveryGap, r.stopLoss, res.sampleSize, r1(res.recoveryRate),
    c('sampleSize'), c('probabilityStability'), c('holdingStability'), c('expansionStability'),
    c('historicalConsistency'), c('sessionConsistency'), c('recentConsistency'),
    r1(res.overall), res.grade, r.confidenceLabel,
  ];
}

export function reliabilityCsv(results: ReliabilityResult[]): SerializedExport {
  const lines = [CSV_COLUMNS.map(csvCell).join(',')];
  for (const res of results) lines.push(rowOf(res).map(csvCell).join(','));
  return { filename: 'ReliabilityReport.csv', content: lines.join('\n'), mime: 'text/csv' };
}

export function reliabilityJson(result: ReliabilityResult, generatedAt: string): SerializedExport {
  const payload = {
    note: 'Reliability evaluates the trustworthiness of stored historical research. It never reruns research and is never a prediction or recommendation.',
    generatedAt,
    strategy: { id: result.record.id, entryGap: result.record.entryGap, recoveryGap: result.record.recoveryGap, stopLoss: result.record.stopLoss },
    sampleSize: result.sampleSize,
    recoveryRate: result.recoveryRate,
    overall: result.overall,
    grade: result.grade,
    stars: result.stars,
    components: result.components,
    timeline: result.timeline,
    warnings: result.warnings,
  };
  return { filename: 'ReliabilityReport.json', content: JSON.stringify(payload, null, 2), mime: 'application/json' };
}
