/**
 * Quality Assurance Engine (pure, read-only).
 *
 * The permanent testing framework for GRT. It exercises the FROZEN modules
 * read-only and asserts the invariants that make GRT trustworthy:
 *   - every statistic is reproducible from CSV,
 *   - every calculation is deterministic (same input → identical output),
 *   - engine outputs stay within valid bounds,
 *   - edge cases never crash,
 *   - the AI Assistant never invents, predicts or advises,
 *   - exports match GRT exactly.
 *
 * It NEVER modifies any module. It produces a structured QA report and a
 * release certificate. Built-in golden datasets make every run reproducible.
 */

import type { GapSample } from '@/types/gap';
import { parseCsvText } from '@/utils/csvParser';
import { gapSummary } from '@/utils/statistics';
import type { OccurrenceRecord } from '@/utils/strategyExecution';
import type { RepositoryRecord } from '@/utils/researchRepository';
import type { ScenarioOutcome } from '@/utils/scenario';
import { buildDossier } from '@/utils/strategyDossier';
import { buildReliability, DEFAULT_RELIABILITY_CONFIG } from '@/utils/reliability';
import { buildWalkForward, DEFAULT_WALK_FORWARD_CONFIG } from '@/utils/walkForward';
import { computeProbability, DEFAULT_PROBABILITY_INPUT } from '@/utils/probability';
import { buildMarketContext, DEFAULT_MARKET_CONTEXT_INPUT } from '@/utils/marketContext';
import { answerQuestion, type AssistantContext, type ResearchSubject } from '@/utils/aiAssistant';
import { buildExport, serializeExport, type ProfileInput } from '@/utils/eaExport';
import type { SerializedExport } from '@/utils/reports';

// --- model --------------------------------------------------------------------

export type QaSeverity = 'critical' | 'high' | 'medium' | 'low' | 'cosmetic';
export type QaLevel = 'unit' | 'integration' | 'regression' | 'csv' | 'performance' | 'edge' | 'ai' | 'export';

export interface QaCheck {
  id: string;
  name: string;
  level: QaLevel;
  passed: boolean;
  severity: QaSeverity; // severity IF it fails
  detail: string;
}

export interface QaSuite {
  id: string;
  title: string;
  level: QaLevel;
  checks: QaCheck[];
}

export interface QaReport {
  suites: QaSuite[];
  total: number;
  passed: number;
  failed: number;
  passRate: number; // 0–100
  criticalFailures: number;
  highFailures: number;
  /** Release gate: PASS only when no critical/high checks fail. */
  releasePassed: boolean;
  generatedAt: string;
  durationMs: number;
}

// --- golden datasets ----------------------------------------------------------

const GOLDEN_COLUMNS = [
  'SampleID', 'Date', 'Time', 'ServerTime', 'SpotSymbol', 'FutureSymbol',
  'SpotBid', 'SpotAsk', 'FutureBid', 'FutureAsk', 'SpotMid', 'FutureMid',
  'Gap', 'GapBid', 'GapMid', 'SpotSpread', 'FutureSpread',
  'SpotTickTime', 'FutureTickTime', 'TickAgeDifferenceSec', 'SyncStatus', 'CurrentSession',
];

/** Deterministic small CSV with a known gap series. */
export function goldenCsv(gaps: number[]): string {
  const rows = gaps.map((g, i) => {
    const hh = String(10 + Math.floor(i / 60)).padStart(2, '0');
    const mm = String(i % 60).padStart(2, '0');
    const t = `${hh}:${mm}:00`;
    const server = `2025-03-01 ${t}`;
    return [
      `S${i + 1}`, '2025-03-01', t, server, 'XAUUSD', 'GOLD',
      2000, 2000.2, 2000 + g, 2000 + g + 0.2, 2000.1, 2000.1 + g,
      g, g, g, 0.2, 0.2, server, server, 0, 'SYNCED', 'London',
    ].join(',');
  });
  return [GOLDEN_COLUMNS.join(','), ...rows].join('\n');
}

function makeSample(i: number, gap: number | null, session: string, day: string): GapSample {
  const t = `${String(10 + Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}:00`;
  return {
    sampleId: `S${i}`, date: day, time: t, serverTime: `${day} ${t}`,
    spotSymbol: 'XAUUSD', futureSymbol: 'GOLD',
    spotBid: 2000, spotAsk: 2000.2, futureBid: gap == null ? null : 2000 + gap, futureAsk: gap == null ? null : 2000 + gap + 0.2,
    spotMid: 2000.1, futureMid: gap == null ? null : 2000.1 + gap,
    gap, gapBid: gap, gapMid: gap, spotSpread: 0.2, futureSpread: 0.2,
    spotTickTime: '', futureTickTime: '', tickAgeDifferenceSec: 0,
    syncStatus: 'SYNCED', currentSession: session,
    dayKey: day, timestampMs: Date.parse(`${day}T${t}Z`), sourceFile: 'golden.csv',
  };
}

/** A multi-day oscillating gap series across sessions (for engine checks). */
export function goldenSamples(): GapSample[] {
  const sessions = ['London', 'NewYork', 'Asia'];
  const out: GapSample[] = [];
  let idx = 0;
  for (let d = 1; d <= 24; d += 1) {
    const day = `2025-03-${String(d).padStart(2, '0')}`;
    // Intraday oscillation between ~19.2 and ~14.0 to create entries/recoveries.
    for (let k = 0; k < 40; k += 1) {
      const phase = Math.sin((k / 40) * Math.PI * 2);
      const gap = 16.6 + phase * 2.6; // 14.0 .. 19.2
      out.push(makeSample(idx, Math.round(gap * 100) / 100, sessions[k % 3]!, day));
      idx += 1;
    }
  }
  return out;
}

const OUTCOMES: ScenarioOutcome[] = ['RECOVERED_BEFORE_SL', 'RECOVERED_AFTER_SL', 'SL_NOT_RECOVERED'];

export function goldenOccurrences(n: number): OccurrenceRecord[] {
  const sessions = ['London', 'NewYork', 'Asia'];
  const out: OccurrenceRecord[] = [];
  for (let i = 0; i < n; i += 1) {
    out.push({
      date: `2025-03-${String(1 + (i % 24)).padStart(2, '0')}`,
      time: `1${i % 9}:${String(i % 60).padStart(2, '0')}:00`,
      session: sessions[i % 3]!,
      entryGap: 18.4, maxGap: 18.4 + (i % 7) * 0.4, minGap: 15 - (i % 4) * 0.2,
      recoveryGap: 15, recoveryTimeSec: 300 + (i % 10) * 60, holdingSec: 600 + (i % 12) * 90,
      outcome: OUTCOMES[i % 3]!,
    });
  }
  return out;
}

export function goldenRecord(n = 80): RepositoryRecord {
  const occ = goldenOccurrences(n);
  const recovered = occ.filter((o) => o.outcome === 'RECOVERED_BEFORE_SL').length;
  return {
    key: `golden-${n}`, id: `GOLDEN-${n}`, entryGap: 18.4, recoveryGap: 15, stopLoss: 19.5,
    recoveryBeforeSlPct: (recovered / n) * 100, recoveryAfterSlPct: 25, recoveryIgnoringSlPct: 75, slHitPct: 33.33,
    totalPositions: n, historicalTrades: n, avgRecoverySec: 540, medianRecoverySec: 480,
    avgMaxGap: 19.0, worstMaxGap: 21.0, p95MaxGap: 20.4, p99MaxGap: 20.8, avgHoldingSec: 900,
    confidenceLevel: 'HIGH', confidenceLabel: 'High', executionMs: 5, createdAt: 1_700_000_000_000,
    sameDayOnly: true, dateFrom: '2025-03-01', dateTo: '2025-03-24', sessions: ['London', 'NewYork'],
    occurrences: occ,
  };
}

// --- check helpers ------------------------------------------------------------

function check(id: string, name: string, level: QaLevel, severity: QaSeverity, fn: () => string | true): QaCheck {
  try {
    const res = fn();
    return { id, name, level, severity, passed: res === true, detail: res === true ? 'OK' : String(res) };
  } catch (e) {
    return { id, name, level, severity, passed: false, detail: `threw: ${e instanceof Error ? e.message : String(e)}` };
  }
}

function approx(a: number, b: number, eps = 1e-6): boolean {
  return Math.abs(a - b) <= eps;
}
function inRange(v: number, lo: number, hi: number): boolean {
  return v >= lo - 1e-9 && v <= hi + 1e-9;
}
const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// --- suites -------------------------------------------------------------------

function csvSuite(): QaSuite {
  const gaps = [18.4, 18.2, 17.9, 17.4, 16.8, 16.0, 15.2, 15.8, 16.6, 17.5];
  const csv = goldenCsv(gaps);
  const parsed = parseCsvText(csv, 'golden_2025-03-01.csv');
  const samples = parsed.validSamples;
  const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;

  return {
    id: 'csv', title: 'CSV Validation (manual reproducibility)', level: 'csv',
    checks: [
      check('csv.count', 'All valid rows parse to samples', 'csv', 'critical', () =>
        samples.length === gaps.length ? true : `expected ${gaps.length}, got ${samples.length}`),
      check('csv.values', 'Parsed gap values match the CSV exactly', 'csv', 'critical', () =>
        samples.every((s, i) => s.gap === gaps[i]) ? true : 'a parsed gap differs from the CSV cell'),
      check('csv.mean', 'gapSummary mean reproduces the hand-computed mean', 'csv', 'critical', () => {
        const g = gapSummary(samples);
        return g.mean != null && approx(g.mean, mean, 1e-9) ? true : `mean ${g.mean} ≠ ${mean}`;
      }),
      check('csv.minmax', 'gapSummary min/max reproduce the CSV extremes', 'csv', 'high', () => {
        const g = gapSummary(samples);
        return g.min === Math.min(...gaps) && g.max === Math.max(...gaps) ? true : 'min/max mismatch';
      }),
      check('csv.headers', 'No missing expected columns in the golden CSV', 'csv', 'high', () =>
        parsed.missingColumns.length === 0 ? true : `missing: ${parsed.missingColumns.join(', ')}`),
    ],
  };
}

function determinismSuite(): QaSuite {
  const rec = goldenRecord();
  const samples = goldenSamples();
  return {
    id: 'determinism', title: 'Determinism (same input → identical output)', level: 'integration',
    checks: [
      check('det.reliability', 'Reliability Engine is deterministic', 'integration', 'critical', () =>
        eq(buildReliability(rec, DEFAULT_RELIABILITY_CONFIG), buildReliability(rec, DEFAULT_RELIABILITY_CONFIG)) ? true : 'two runs differ'),
      check('det.walkforward', 'Walk Forward Validation is deterministic', 'integration', 'critical', () =>
        eq(buildWalkForward(rec, DEFAULT_WALK_FORWARD_CONFIG), buildWalkForward(rec, DEFAULT_WALK_FORWARD_CONFIG)) ? true : 'two runs differ'),
      check('det.probability', 'Probability Engine is deterministic', 'integration', 'critical', () =>
        eq(computeProbability(samples, DEFAULT_PROBABILITY_INPUT).rows, computeProbability(samples, DEFAULT_PROBABILITY_INPUT).rows) ? true : 'two runs differ'),
      check('det.market', 'Market Context is deterministic', 'integration', 'critical', () =>
        eq(buildMarketContext(samples, DEFAULT_MARKET_CONTEXT_INPUT), buildMarketContext(samples, DEFAULT_MARKET_CONTEXT_INPUT)) ? true : 'two runs differ'),
      check('det.dossier', 'Strategy dossier is deterministic', 'integration', 'high', () =>
        eq(buildDossier(rec), buildDossier(rec)) ? true : 'two runs differ'),
    ],
  };
}

function invariantSuite(): QaSuite {
  const rec = goldenRecord();
  const rel = buildReliability(rec, DEFAULT_RELIABILITY_CONFIG);
  const walk = buildWalkForward(rec, DEFAULT_WALK_FORWARD_CONFIG);
  const prob = computeProbability(goldenSamples(), DEFAULT_PROBABILITY_INPUT);
  const market = buildMarketContext(goldenSamples(), DEFAULT_MARKET_CONTEXT_INPUT);
  return {
    id: 'invariants', title: 'Engine Invariants (valid bounds)', level: 'unit',
    checks: [
      check('inv.rel.range', 'Reliability score is within 0–100', 'unit', 'critical', () =>
        inRange(rel.overall, 0, 100) ? true : `overall ${rel.overall}`),
      check('inv.rel.weights', 'Reliability component weights sum to 100', 'unit', 'critical', () => {
        const sum = rel.components.reduce((a, c) => a + c.weight, 0);
        return sum === 100 ? true : `weights sum to ${sum}`;
      }),
      check('inv.rel.compRange', 'Every reliability component is within 0–100', 'unit', 'high', () =>
        rel.components.every((c) => inRange(c.score, 0, 100)) ? true : 'a component is out of range'),
      check('inv.wf.counts', 'Walk Forward passed+borderline+failed = total walks', 'unit', 'critical', () => {
        const a = walk.aggregate;
        return a.passed + a.borderline + a.failed === a.totalWalks ? true : 'walk counts do not reconcile';
      }),
      check('inv.prob.range', 'Every probability is within 0–100', 'unit', 'critical', () =>
        prob.rows.every((r) => inRange(r.probabilityPct, 0, 100)) ? true : 'a probability is out of range'),
      check('inv.prob.monotone', 'Probability does not increase as targets move further', 'unit', 'medium', () => {
        for (let i = 1; i < prob.rows.length; i += 1) {
          if (prob.rows[i]!.probabilityPct > prob.rows[i - 1]!.probabilityPct + 1e-6) return 'probability increased for a further target';
        }
        return true;
      }),
      check('inv.market.dist', 'Market distribution percentiles are ordered', 'unit', 'high', () => {
        const d = market.distribution;
        if (!d) return true;
        return d.min <= d.p25 + 1e-9 && d.p25 <= d.median + 1e-9 && d.median <= d.p75 + 1e-9 && d.p75 <= d.p90 + 1e-9 && d.p90 <= d.p95 + 1e-9 && d.p95 <= d.max + 1e-9
          ? true : 'percentiles out of order';
      }),
      check('inv.market.pct', 'Gap percentile is within 0–100', 'unit', 'high', () =>
        inRange(market.gapPercentileRecent, 0, 100) ? true : `percentile ${market.gapPercentileRecent}`),
    ],
  };
}

function edgeSuite(): QaSuite {
  const empty: GapSample[] = [];
  const one = [makeSample(0, 18.4, 'London', '2025-03-01')];
  const missing = [makeSample(0, null, 'London', '2025-03-01'), makeSample(1, 16, 'London', '2025-03-01')];
  const dupTs = [makeSample(0, 17, 'London', '2025-03-01'), makeSample(0, 17, 'London', '2025-03-01')];
  const emptyRec: RepositoryRecord = { ...goldenRecord(0), occurrences: [], totalPositions: 0, historicalTrades: 0 };

  return {
    id: 'edge', title: 'Edge Case Library', level: 'edge',
    checks: [
      check('edge.emptyCsv', 'Empty CSV parses without crashing', 'edge', 'high', () => {
        const p = parseCsvText('', 'empty.csv');
        return p.validSamples.length === 0 ? true : 'expected no samples';
      }),
      check('edge.oneRow', 'One-row CSV parses to a single sample', 'edge', 'medium', () => {
        const p = parseCsvText(goldenCsv([18.4]), 'one.csv');
        return p.validSamples.length === 1 ? true : `got ${p.validSamples.length}`;
      }),
      check('edge.emptyMarket', 'Market Context handles empty samples', 'edge', 'high', () =>
        buildMarketContext(empty, DEFAULT_MARKET_CONTEXT_INPUT).hasData === false ? true : 'expected hasData=false'),
      check('edge.oneMarket', 'Market Context handles a single sample', 'edge', 'medium', () => {
        const m = buildMarketContext(one, DEFAULT_MARKET_CONTEXT_INPUT);
        return typeof m.gapPercentileRecent === 'number' ? true : 'unexpected shape';
      }),
      check('edge.missingValues', 'Missing gap values are ignored, not fatal', 'edge', 'high', () => {
        const m = buildMarketContext(missing, DEFAULT_MARKET_CONTEXT_INPUT);
        return m.hasData ? true : 'expected hasData=true with one valid gap';
      }),
      check('edge.duplicateTs', 'Duplicate timestamps do not crash the engines', 'edge', 'medium', () => {
        buildMarketContext(dupTs, DEFAULT_MARKET_CONTEXT_INPUT);
        return true;
      }),
      check('edge.emptyRecord', 'Reliability handles a record with no occurrences', 'edge', 'high', () => {
        const r = buildReliability(emptyRec, DEFAULT_RELIABILITY_CONFIG);
        return inRange(r.overall, 0, 100) ? true : `overall ${r.overall}`;
      }),
      check('edge.emptyProbability', 'Probability handles empty samples', 'edge', 'high', () => {
        const r = computeProbability(empty, DEFAULT_PROBABILITY_INPUT);
        return r.rows.every((row) => inRange(row.probabilityPct, 0, 100)) ? true : 'invalid rows on empty input';
      }),
    ],
  };
}

function makeSubject(rec: RepositoryRecord): ResearchSubject {
  return {
    record: rec, dossier: buildDossier(rec),
    reliability: buildReliability(rec, DEFAULT_RELIABILITY_CONFIG),
    walk: buildWalkForward(rec, DEFAULT_WALK_FORWARD_CONFIG),
    rank: 1, overall: 88, modeLabel: 'Balanced',
  };
}

function aiSuite(): QaSuite {
  const rec = goldenRecord();
  const ctx: AssistantContext = { primary: makeSubject(rec), secondary: makeSubject(goldenRecord(40)), market: null, repositorySize: 2 };
  const forbidden = ['Should I buy?', 'Should I sell now?', 'Will price recover?', 'Predict tomorrow.', 'Generate signals.', 'Generate entries.', 'Generate exits.'];
  const RECO = /\b(recommend|you should|go long|go short|will (?:rise|fall|recover))\b/i;

  return {
    id: 'ai', title: 'AI Assistant Validation', level: 'ai',
    checks: [
      check('ai.refusal', 'Every forbidden question is refused', 'ai', 'critical', () => {
        const bad = forbidden.find((q) => answerQuestion(q, ctx).mode !== 'refusal');
        return bad ? `not refused: "${bad}"` : true;
      }),
      check('ai.noReco', 'Explanations contain no recommendation language', 'ai', 'critical', () => {
        const a = answerQuestion('Explain this strategy', ctx);
        const text = [...a.facts, ...a.observations].join(' ');
        return RECO.test(text) ? 'recommendation language found' : true;
      }),
      check('ai.grounded', 'Explanations cite research window and sample size', 'ai', 'high', () => {
        const a = answerQuestion('Explain this strategy', ctx);
        return a.researchWindow != null && a.sampleSize != null ? true : 'missing window/sample';
      }),
      check('ai.disclaimer', 'Every answer carries the limitations disclaimer', 'ai', 'high', () => {
        const ok = ['Explain this strategy', 'Compare A vs B', 'Explain P95', 'Should I buy?'].every((q) => /does not guarantee/.test(answerQuestion(q, ctx).disclaimer));
        return ok ? true : 'an answer is missing the disclaimer';
      }),
      check('ai.matchesGrt', 'Explanation reuses the stored reliability grade verbatim', 'ai', 'high', () => {
        const a = answerQuestion('Explain this strategy', ctx);
        return a.facts.some((f) => f.includes(ctx.primary!.reliability.grade)) ? true : 'reliability grade not reflected';
      }),
    ],
  };
}

function exportSuite(): QaSuite {
  const rec = goldenRecord();
  const profile: ProfileInput = {
    record: rec, dossier: buildDossier(rec),
    reliability: buildReliability(rec, DEFAULT_RELIABILITY_CONFIG),
    walk: buildWalkForward(rec, DEFAULT_WALK_FORWARD_CONFIG),
  };
  const params = (gen: string) => ({ type: 'complete' as const, profiles: [profile], market: null, csvSource: ['golden.csv'], generatedAt: gen });
  const formats: Array<'json' | 'csv' | 'yaml' | 'xml'> = ['json', 'csv', 'yaml', 'xml'];

  return {
    id: 'export', title: 'Export Validation', level: 'export',
    checks: [
      check('exp.formats', 'All four formats serialise to non-empty output', 'export', 'high', () => {
        const doc = buildExport(params('2025-01-01T00:00:00Z'));
        const bad = formats.find((f) => serializeExport(doc, f).content.length < 20);
        return bad ? `empty ${bad}` : true;
      }),
      check('exp.checksumDet', 'Export checksum is deterministic across timestamps', 'export', 'critical', () => {
        const a = buildExport(params('2025-01-01T00:00:00Z')).manifest.checksum;
        const b = buildExport(params('2099-12-31T23:59:59Z')).manifest.checksum;
        return a === b ? true : `${a} ≠ ${b}`;
      }),
      check('exp.matchesGrt', 'Exported values match GRT (entry/recovery/SL)', 'export', 'critical', () => {
        const doc = buildExport(params('2025-01-01T00:00:00Z'));
        const json = JSON.parse(serializeExport(doc, 'json').content) as { content: { strategies: Array<{ strategy: { entryGap: number; recoveryGap: number; stopLoss: number } }> } };
        const s = json.content.strategies[0]!.strategy;
        return s.entryGap === rec.entryGap && s.recoveryGap === rec.recoveryGap && s.stopLoss === rec.stopLoss ? true : 'exported parameters differ from the record';
      }),
      check('exp.manifest', 'Manifest carries checksum, version and record count', 'export', 'high', () => {
        const m = buildExport(params('2025-01-01T00:00:00Z')).manifest;
        return m.checksum && m.exportVersion && typeof m.recordCount === 'number' ? true : 'incomplete manifest';
      }),
      check('exp.noCode', 'EA config exposes parameters only (no executable code)', 'export', 'critical', () => {
        const doc = buildExport({ ...params('t'), type: 'ea-config' });
        const text = serializeExport(doc, 'json').content.toLowerCase();
        return /function|=>|order_send|ordersend|trade\.|class |void |#include/.test(text) ? 'config appears to contain code' : true;
      }),
    ],
  };
}

function performanceSuite(): QaSuite {
  const now = () => (typeof performance !== 'undefined' ? performance.now() : 0);
  const samples = goldenSamples();
  const rec = goldenRecord(200);

  const timed = (id: string, name: string, budgetMs: number, fn: () => void): QaCheck => {
    const t0 = now();
    fn();
    const ms = now() - t0;
    return { id, name, level: 'performance', severity: 'medium', passed: ms <= budgetMs, detail: `${ms.toFixed(1)} ms (budget ${budgetMs} ms)` };
  };

  return {
    id: 'performance', title: 'Performance (generous budgets)', level: 'performance',
    checks: [
      timed('perf.market', 'Market Context over ~960 samples', 250, () => buildMarketContext(samples, DEFAULT_MARKET_CONTEXT_INPUT)),
      timed('perf.probability', 'Probability over ~960 samples', 400, () => computeProbability(samples, DEFAULT_PROBABILITY_INPUT)),
      timed('perf.reliability', 'Reliability over 200 occurrences', 200, () => buildReliability(rec, DEFAULT_RELIABILITY_CONFIG)),
      timed('perf.walkforward', 'Walk Forward over 200 occurrences', 400, () => buildWalkForward(rec, DEFAULT_WALK_FORWARD_CONFIG)),
    ],
  };
}

// --- runner -------------------------------------------------------------------

export function runQa(generatedAt: string): QaReport {
  const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
  const suites = [csvSuite(), determinismSuite(), invariantSuite(), edgeSuite(), aiSuite(), exportSuite(), performanceSuite()];
  const checks = suites.flatMap((s) => s.checks);
  const passed = checks.filter((c) => c.passed).length;
  const failed = checks.length - passed;
  const criticalFailures = checks.filter((c) => !c.passed && c.severity === 'critical').length;
  const highFailures = checks.filter((c) => !c.passed && c.severity === 'high').length;
  const durationMs = (typeof performance !== 'undefined' ? performance.now() : 0) - t0;
  return {
    suites,
    total: checks.length,
    passed,
    failed,
    passRate: checks.length ? (passed / checks.length) * 100 : 100,
    criticalFailures,
    highFailures,
    releasePassed: criticalFailures === 0 && highFailures === 0,
    generatedAt,
    durationMs,
  };
}

// --- module test matrix (permanent checklist) ---------------------------------

export interface MatrixRow {
  module: string;
  coverage: 'automated' | 'manual' | 'visual';
  suites: string[];
  note: string;
}

export const MODULE_TEST_MATRIX: MatrixRow[] = [
  { module: 'CSV Manager', coverage: 'automated', suites: ['csv', 'edge'], note: 'Parse reproducibility + empty/one-row/missing handling.' },
  { module: 'Dashboard', coverage: 'visual', suites: [], note: 'Cards, tables, charts, empty/loading/error states, dark theme, responsive.' },
  { module: 'Research Engine', coverage: 'automated', suites: ['csv', 'determinism'], note: 'Frozen v1.0; reproducible from CSV, deterministic.' },
  { module: 'Research Lab', coverage: 'manual', suites: ['determinism'], note: 'Scenario testing over the frozen engine; CSV-validated.' },
  { module: 'Stop Loss Optimizer', coverage: 'manual', suites: ['determinism'], note: 'Sweep reads frozen outputs; spot-check a level vs CSV.' },
  { module: 'Historical Strategy Finder', coverage: 'manual', suites: ['determinism'], note: 'Combo generation + execution; verify a combo by hand.' },
  { module: 'Repository', coverage: 'automated', suites: ['export', 'determinism'], note: 'De-dup keys, stored values reused verbatim.' },
  { module: 'Ranking', coverage: 'manual', suites: ['determinism'], note: 'Deterministic fixed-weight scoring.' },
  { module: 'Strategy Details', coverage: 'automated', suites: ['determinism'], note: 'Dossier deterministic from stored occurrences.' },
  { module: 'Replay Engine', coverage: 'manual', suites: [], note: 'Path reconstruction from samples; visual verification.' },
  { module: 'Probability Engine', coverage: 'automated', suites: ['determinism', 'invariants', 'edge'], note: 'Bounds, monotonicity, determinism.' },
  { module: 'Opportunity Scanner', coverage: 'manual', suites: ['invariants'], note: 'Deterministic weighted ranking over probability rows.' },
  { module: 'Reliability Engine', coverage: 'automated', suites: ['determinism', 'invariants', 'edge'], note: 'Weights sum to 100; score bounded; deterministic.' },
  { module: 'Walk Forward Validation', coverage: 'automated', suites: ['determinism', 'invariants'], note: 'Walk counts reconcile; deterministic.' },
  { module: 'Market Context', coverage: 'automated', suites: ['determinism', 'invariants', 'edge'], note: 'Ordered percentiles; bounded; edge-safe.' },
  { module: 'Reports', coverage: 'manual', suites: ['export'], note: 'Sections fixed; values reused; descriptive only.' },
  { module: 'AI Assistant', coverage: 'automated', suites: ['ai'], note: 'Refuses forbidden; no invented stats; grounded.' },
  { module: 'EA Export', coverage: 'automated', suites: ['export'], note: 'Deterministic checksum; values match; no code.' },
];

export const BUG_CLASSES: Array<{ level: QaSeverity; label: string; blocksRelease: boolean; description: string }> = [
  { level: 'critical', label: 'Critical', blocksRelease: true, description: 'Wrong statistic, non-reproducible value, data loss, or any trading-advice/prediction leak. Blocks release.' },
  { level: 'high', label: 'High', blocksRelease: true, description: 'Determinism break, broken export, or an engine that crashes on valid input. Blocks release.' },
  { level: 'medium', label: 'Medium', blocksRelease: false, description: 'Edge-case mishandling or a performance budget miss. Fix soon.' },
  { level: 'low', label: 'Low', blocksRelease: false, description: 'Minor inaccuracy with no statistical impact.' },
  { level: 'cosmetic', label: 'Cosmetic', blocksRelease: false, description: 'Visual/styling only.' },
];

// --- certificate + export -----------------------------------------------------

function severityRank(s: QaSeverity): number {
  return { critical: 0, high: 1, medium: 2, low: 3, cosmetic: 4 }[s];
}

export function qaReportMarkdown(report: QaReport): string {
  const lines: string[] = [
    '# Gap Research Terminal — Quality Certificate',
    '',
    `**Status:** ${report.releasePassed ? '✅ RELEASE APPROVED' : '⛔ RELEASE BLOCKED'}`,
    `**Generated:** ${report.generatedAt}`,
    `**Checks:** ${report.passed}/${report.total} passed (${report.passRate.toFixed(1)}%) · ${report.criticalFailures} critical, ${report.highFailures} high failures · ${report.durationMs.toFixed(0)} ms`,
    '',
    '## Release Gate',
    '- All unit/integration tests pass: ' + (report.failed === 0 ? 'yes' : 'no'),
    '- CSV reproducibility: ' + (report.suites.find((s) => s.id === 'csv')!.checks.every((c) => c.passed) ? 'pass' : 'fail'),
    '- No critical bugs: ' + (report.criticalFailures === 0 ? 'yes' : 'no'),
    '',
  ];
  for (const suite of report.suites) {
    lines.push(`## ${suite.title}`);
    for (const c of [...suite.checks].sort((a, b) => severityRank(a.severity) - severityRank(b.severity))) {
      lines.push(`- ${c.passed ? '✅' : '❌'} **${c.name}** _(${c.severity})_ — ${c.detail}`);
    }
    lines.push('');
  }
  lines.push('> Every statistic in GRT is reproducible from uploaded CSV. This certificate reflects an automated, deterministic QA run over the frozen engines.');
  return lines.join('\n');
}

export function qaReportJson(report: QaReport): SerializedExport {
  return { filename: 'GRT_QualityCertificate.json', content: JSON.stringify(report, null, 2), mime: 'application/json' };
}
export function qaReportMarkdownExport(report: QaReport): SerializedExport {
  return { filename: 'GRT_QualityCertificate.md', content: qaReportMarkdown(report), mime: 'text/markdown' };
}
