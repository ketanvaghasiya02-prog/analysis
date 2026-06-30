/**
 * Professional Reporting Engine (presentation only).
 *
 * Transforms ALREADY-COMPUTED historical research into professional, purely
 * descriptive reports. It never calculates statistics and never reruns any
 * engine — every value handed in was produced by the frozen Research /
 * Probability / Reliability / Walk Forward / Market Context engines and is the
 * same number shown on screen. This module only structures and formats it.
 *
 * Every report follows one identical section sequence:
 *   Cover → Executive Summary → Research Inputs → Methodology → Statistics →
 *   Charts → Tables → Observations → Limitations → Appendix.
 *
 * Output formats: PDF (themed print HTML), CSV, JSON. Themes: professional,
 * dark, light, institutional.
 */

import type { RepositoryRecord } from '@/utils/researchRepository';
import type { Dossier } from '@/utils/strategyDossier';
import type { ReliabilityResult } from '@/utils/reliability';
import type { WalkForwardResult } from '@/utils/walkForward';
import type { MarketContext } from '@/utils/marketContext';
import type { ProbabilityResult } from '@/utils/probability';
import type { ReplayTimeline } from '@/utils/replay';
import type { SerializedExport } from '@/utils/reports';
import { fmtDuration, fmtInt, fmtNumber } from '@/utils/format';

export const REPORT_ENGINE_VERSION = 'v1.0';
export const DOCUMENT_VERSION = '1.0';
const PLATFORM = 'Gap Research Terminal';
const TAGLINE = 'Professional CSV-Based Pair Spread Research Platform';

export type ReportType =
  | 'research'
  | 'probability'
  | 'reliability'
  | 'walk-forward'
  | 'market-context'
  | 'strategy'
  | 'replay';

export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  research: 'Research Report',
  probability: 'Probability Report',
  reliability: 'Reliability Report',
  'walk-forward': 'Walk Forward Report',
  'market-context': 'Market Context Report',
  strategy: 'Strategy Report',
  replay: 'Replay Report',
};

export type ReportTheme = 'professional' | 'dark' | 'light' | 'institutional';
export type ReportFormat = 'pdf' | 'csv' | 'json';

export interface ReportStat {
  label: string;
  value: string;
  hint?: string;
}
export interface ReportChartPoint {
  label: string;
  value: number;
  highlight?: boolean;
}
export interface ReportChart {
  title: string;
  kind: 'bar' | 'line';
  unit?: string;
  data: ReportChartPoint[];
  note?: string;
}
export interface ReportTable {
  name: string;
  columns: string[];
  rows: Array<Array<string | number | null>>;
}
export interface ReportDefinition {
  term: string;
  definition: string;
}

export type ReportSectionId =
  | 'cover'
  | 'executive-summary'
  | 'research-inputs'
  | 'methodology'
  | 'statistics'
  | 'charts'
  | 'tables'
  | 'observations'
  | 'limitations'
  | 'appendix';

export interface ReportSection {
  id: ReportSectionId;
  title: string;
  paragraphs?: string[];
  stats?: ReportStat[];
  charts?: ReportChart[];
  tables?: ReportTable[];
  definitions?: ReportDefinition[];
  /** Bullet observations. */
  bullets?: string[];
}

export interface ReportDocument {
  type: ReportType;
  title: string;
  subject: string;
  generatedAt: string;
  researchWindow: string;
  sections: ReportSection[];
}

// --- formatting helpers -------------------------------------------------------

const pct = (n: number | null | undefined, d = 1) =>
  n == null || Number.isNaN(n) ? '—' : `${fmtNumber(n, d)}%`;
const num = (n: number | null | undefined, d = 2) => fmtNumber(n, d);
const dur = (s: number | null | undefined) => fmtDuration(s);

function sessionLabel(sessions: string[]): string {
  return sessions.length ? sessions.join(', ') : 'All sessions';
}

const LIMITATIONS: string[] = [
  'This report is built entirely from historical data already present in the uploaded CSV exports.',
  'It is descriptive only — it contains no prediction and no forecast of future behaviour.',
  'Historical statistics are not a guarantee of future performance.',
  'Recent market behaviour may differ from the period studied; Gold Spot vs Gold Futures converge toward expiry, so older observations may be less representative.',
  'Every figure is reproducible from the source CSV; no value is estimated, smoothed or weighted by any hidden model.',
];

const COMMON_DEFINITIONS: ReportDefinition[] = [
  { term: 'Research Window', definition: 'The span of trading days from which the historical observations in this report were drawn.' },
  { term: 'Historical Event / Occurrence', definition: 'One simulated position entered on a first touch of the entry gap from below, in the uploaded history.' },
  { term: 'Recovery before SL', definition: 'Share of occurrences that reached the recovery gap before the maximum gap touched the stop-loss boundary.' },
  { term: 'Stop-Loss boundary', definition: 'A classification threshold (maximum gap ≥ SL) used to label outcomes. In the Research Engine it does not terminate the scan.' },
  { term: 'Expansion', definition: 'How far the gap widened against the position; worst expansion is the single largest adverse gap observed.' },
  { term: 'P95 Expansion', definition: 'The 95th percentile of maximum gap across occurrences — only 5% of cases expanded further.' },
];

const CALC_NOTES: string[] = [
  'All statistics originate from the frozen Research Engine v1.0 and the downstream Probability, Reliability, Walk Forward and Market Context engines.',
  'This reporting layer reuses those computed results verbatim; it performs no calculation of its own.',
  'One simulated position is open at a time; scanning resumes after each position closes.',
];

function methodologyParagraphs(type: ReportType): string[] {
  const base =
    'Figures in this report were produced by the frozen Gap Research Terminal engines and are reproduced here without modification. ' +
    'Positions are detected on a first touch of the entry gap from below; one position is evaluated at a time and the scan resumes after it closes.';
  switch (type) {
    case 'probability':
      return [base, 'Compression probabilities are produced by the Probability Engine, which closes each event when its stop-loss gap is reached and records the first time each lower target gap was touched.'];
    case 'reliability':
      return [base, 'The Reliability Engine combines seven explicitly weighted, deterministic components (sample quality, probability stability, holding stability, expansion stability, historical consistency, session consistency and recent consistency) into a single 0–100 score. No component is hidden or AI-weighted.'];
    case 'walk-forward':
      return [base, 'The Walk Forward Validation engine re-evaluates the stored occurrences over rolling training and validation windows and measures the drift between them. It optimises nothing.'];
    case 'market-context':
      return [base, 'The Market Context Engine describes where the current gap sits within a recent window (default 15 trading days) using percentiles, a deterministic regime classification and volatility statistics.'];
    case 'strategy':
      return [base, 'This strategy review composes the historical dossier with the Reliability Engine output. Each engine is read-only and deterministic.'];
    case 'replay':
      return [base, 'The replay reconstructs a single historical occurrence sample-by-sample from the uploaded data; it adds no new computation.'];
    default:
      return [base, 'Recovery, stop-loss and expansion statistics are taken from the Research Engine output stored in the Research Repository.'];
  }
}

function header(type: ReportType, subject: string, researchWindow: string): ReportSection {
  return {
    id: 'cover',
    title: 'Cover Page',
    paragraphs: [PLATFORM, TAGLINE, REPORT_TYPE_LABELS[type], subject],
    stats: [
      { label: 'Report', value: REPORT_TYPE_LABELS[type] },
      { label: 'Subject', value: subject },
      { label: 'Research Window', value: researchWindow },
      { label: 'Document Version', value: DOCUMENT_VERSION },
    ],
  };
}

function limitationsSection(): ReportSection {
  return { id: 'limitations', title: 'Limitations', bullets: LIMITATIONS };
}

function appendixSection(extra: ReportDefinition[] = []): ReportSection {
  return {
    id: 'appendix',
    title: 'Appendix',
    definitions: [...COMMON_DEFINITIONS, ...extra],
    paragraphs: ['Calculation notes:', ...CALC_NOTES],
  };
}

function assemble(
  type: ReportType,
  subject: string,
  researchWindow: string,
  generatedAt: string,
  middle: ReportSection[],
): ReportDocument {
  return {
    type,
    title: `${REPORT_TYPE_LABELS[type]} — ${subject}`,
    subject,
    generatedAt,
    researchWindow,
    sections: [
      header(type, subject, researchWindow),
      ...middle,
      limitationsSection(),
      appendixSection(),
    ],
  };
}

function recordSubject(rec: RepositoryRecord): string {
  return `Entry ${num(rec.entryGap)} → Recovery ${num(rec.recoveryGap)} · SL ${num(rec.stopLoss)}`;
}
function recordWindow(rec: RepositoryRecord): string {
  return `${rec.dateFrom} → ${rec.dateTo} · ${sessionLabel(rec.sessions)}`;
}

function recordInputs(rec: RepositoryRecord): ReportSection {
  return {
    id: 'research-inputs',
    title: 'Research Inputs',
    stats: [
      { label: 'Document', value: rec.id },
      { label: 'Date Range', value: `${rec.dateFrom} → ${rec.dateTo}` },
      { label: 'Research Window', value: rec.sameDayOnly ? 'Same-day only' : 'Multi-day' },
      { label: 'Entry Gap', value: num(rec.entryGap) },
      { label: 'Recovery Gap', value: num(rec.recoveryGap) },
      { label: 'Stop Loss', value: num(rec.stopLoss) },
      { label: 'Session Filter', value: sessionLabel(rec.sessions) },
      { label: 'Average Holding', value: dur(rec.avgHoldingSec) },
      { label: 'Historical Sample', value: fmtInt(rec.totalPositions) },
    ],
  };
}

// --- 1) Research Report -------------------------------------------------------

function researchStats(rec: RepositoryRecord, d: Dossier): ReportSection {
  return {
    id: 'statistics',
    title: 'Statistics',
    stats: [
      { label: 'Total Events', value: fmtInt(rec.historicalTrades) },
      { label: 'Recovery %', value: pct(rec.recoveryBeforeSlPct) },
      { label: 'Recovery Before SL', value: pct(rec.recoveryBeforeSlPct) },
      { label: 'Recovery After SL', value: pct(rec.recoveryAfterSlPct) },
      { label: 'Stop Loss %', value: pct(rec.slHitPct) },
      { label: 'Average Holding', value: dur(rec.avgHoldingSec) },
      { label: 'Median Holding', value: dur(d.recoveryTime.medianSec) },
      { label: 'Worst Expansion', value: num(rec.worstMaxGap) },
      { label: 'P95 Expansion', value: num(rec.p95MaxGap) },
      { label: 'Confidence', value: rec.confidenceLabel },
      { label: 'Historical Sample', value: fmtInt(rec.totalPositions) },
    ],
  };
}

function researchCharts(d: Dossier): ReportSection {
  return {
    id: 'charts',
    title: 'Charts',
    charts: [
      {
        title: 'Outcome Distribution',
        kind: 'bar',
        unit: 'events',
        data: d.outcomes.map((o) => ({ label: o.label, value: o.count })),
      },
      {
        title: 'Holding Distribution',
        kind: 'bar',
        unit: 'events',
        data: d.histogram.map((b) => ({ label: b.label, value: b.count })),
        note: 'Holding time grouped into minute buckets.',
      },
      {
        title: 'Session Distribution',
        kind: 'bar',
        unit: 'events',
        data: d.sessions.map((s) => ({ label: s.session, value: s.occurrences })),
      },
    ],
  };
}

function researchTables(d: Dossier): ReportSection {
  return {
    id: 'tables',
    title: 'Tables',
    tables: [
      {
        name: 'Session Breakdown',
        columns: ['Session', 'Occurrences', 'Recovery %', 'SL Hit %', 'Avg Holding'],
        rows: d.sessions.map((s) => [s.session, s.occurrences, num(s.recoveryPct, 1), num(s.slHitPct, 1), dur(s.avgHoldingSec)]),
      },
      {
        name: 'Monthly Breakdown',
        columns: ['Month', 'Occurrences', 'Recovery %', 'Avg Holding'],
        rows: d.months.map((m) => [m.label, m.occurrences, num(m.recoveryPct, 1), dur(m.avgHoldingSec)]),
      },
      {
        name: 'Outcome Counts',
        columns: ['Outcome', 'Count', 'Share %'],
        rows: d.outcomes.map((o) => [o.label, o.count, num(o.pct, 1)]),
      },
    ],
  };
}

export function buildResearchReport(rec: RepositoryRecord, d: Dossier, generatedAt: string): ReportDocument {
  const exec: ReportSection = {
    id: 'executive-summary',
    title: 'Executive Summary',
    stats: [
      { label: 'Research Window', value: rec.sameDayOnly ? 'Same-day only' : 'Multi-day' },
      { label: 'Research Period', value: `${rec.dateFrom} → ${rec.dateTo}` },
      { label: 'Historical Events', value: fmtInt(rec.historicalTrades) },
      { label: 'Recovery %', value: pct(rec.recoveryBeforeSlPct) },
      { label: 'Confidence', value: rec.confidenceLabel },
    ],
    paragraphs: [
      `Over ${fmtInt(rec.historicalTrades)} historical occurrences of entry gap ${num(rec.entryGap)} targeting recovery ${num(rec.recoveryGap)} with a stop-loss boundary of ${num(rec.stopLoss)}, ${pct(rec.recoveryBeforeSlPct)} recovered before the stop-loss boundary and ${pct(rec.slHitPct)} reached it.`,
    ],
    bullets: d.observations.slice(0, 3),
  };
  return assemble('research', recordSubject(rec), recordWindow(rec), generatedAt, [
    exec,
    recordInputs(rec),
    { id: 'methodology', title: 'Methodology', paragraphs: methodologyParagraphs('research') },
    researchStats(rec, d),
    researchCharts(d),
    researchTables(d),
    { id: 'observations', title: 'Observations', bullets: d.observations },
  ]);
}

// --- 2) Probability Report ----------------------------------------------------

export function buildProbabilityReport(result: ProbabilityResult, generatedAt: string): ReportDocument {
  const m = result.meta;
  const subject = `Current gap ${num(m.currentGap)}`;
  const range = result.input.dateRange;
  const rangeLabel = `${range.from || '—'} → ${range.to || '—'}`;
  const window = `${rangeLabel} · ${sessionLabel(result.input.sessions)}`;
  const top = result.rows[0] ?? null;

  const inputs: ReportSection = {
    id: 'research-inputs',
    title: 'Research Inputs',
    stats: [
      { label: 'Current Gap', value: num(m.currentGap) },
      { label: 'Date Range', value: rangeLabel },
      { label: 'Session Filter', value: sessionLabel(result.input.sessions) },
      { label: 'Targets Tested', value: fmtInt(m.targetsTested) },
      { label: 'Total Events', value: fmtInt(m.totalEvents) },
    ],
  };
  const exec: ReportSection = {
    id: 'executive-summary',
    title: 'Executive Summary',
    stats: [
      { label: 'Current Gap', value: num(m.currentGap) },
      { label: 'Historical Events', value: fmtInt(m.totalEvents) },
      { label: 'Targets Tested', value: fmtInt(m.targetsTested) },
      { label: 'Highest Target Probability', value: top ? pct(top.probabilityPct) : '—' },
    ],
    paragraphs: [
      `From a current gap of ${num(m.currentGap)}, ${fmtInt(m.totalEvents)} historical events were available across ${fmtInt(m.targetsTested)} lower target gaps.`,
      m.truncated ? `The target ladder was truncated; ${fmtInt(m.rejectedTargets)} targets were rejected.` : 'All requested targets were evaluated.',
    ],
  };
  const stats: ReportSection = {
    id: 'statistics',
    title: 'Statistics',
    stats: result.rows.slice(0, 8).map((r) => ({
      label: `Target ${num(r.targetGap)}`,
      value: pct(r.probabilityPct),
      hint: `${fmtInt(r.reachedCount)}/${fmtInt(r.totalEvents)} · ${r.confidenceLabel}`,
    })),
  };
  const charts: ReportSection = {
    id: 'charts',
    title: 'Charts',
    charts: [
      {
        title: 'Probability Distribution',
        kind: 'bar',
        unit: '%',
        data: result.rows.map((r) => ({ label: num(r.targetGap), value: Math.round(r.probabilityPct * 10) / 10 })),
        note: 'Historical probability the current gap compresses to each lower target gap.',
      },
    ],
  };
  const tables: ReportSection = {
    id: 'tables',
    title: 'Tables',
    tables: [
      {
        name: 'Probability Matrix',
        columns: ['Target Gap', 'Events', 'Reached', 'Probability %', 'SL Before %', 'Median Time', 'P95 Expansion', 'Confidence'],
        rows: result.rows.map((r) => [
          num(r.targetGap), r.totalEvents, r.reachedCount, num(r.probabilityPct, 1),
          r.slBeforeTargetPct == null ? '—' : num(r.slBeforeTargetPct, 1),
          dur(r.medianTimeSec), num(r.p95MaxGap), r.confidenceLabel,
        ]),
      },
    ],
  };
  const obs: string[] = [];
  if (top) obs.push(`The nearest target (${num(top.targetGap)}) was reached in ${pct(top.probabilityPct)} of ${fmtInt(top.totalEvents)} historical events.`);
  obs.push(`Probability declines monotonically as targets move further from the current gap — a structural property of nested compression, not a forecast.`);
  if (m.totalEvents < 25) obs.push('Historical sample size is limited; treat the probabilities as indicative of the studied period only.');

  return assemble('probability', subject, window, generatedAt, [
    exec,
    inputs,
    { id: 'methodology', title: 'Methodology', paragraphs: methodologyParagraphs('probability') },
    stats,
    charts,
    tables,
    { id: 'observations', title: 'Observations', bullets: obs },
  ]);
}

// --- 3) Reliability Report ----------------------------------------------------

export function buildReliabilityReport(result: ReliabilityResult, generatedAt: string): ReportDocument {
  const rec = result.record;
  const exec: ReportSection = {
    id: 'executive-summary',
    title: 'Executive Summary',
    stats: [
      { label: 'Reliability', value: `${num(result.overall, 0)} / 100` },
      { label: 'Grade', value: result.grade },
      { label: 'Sample Quality', value: `${result.stars}/5 stars` },
      { label: 'Historical Events', value: fmtInt(result.sampleSize) },
      { label: 'Recovery Rate', value: pct(result.recoveryRate) },
    ],
    paragraphs: [
      `The stored result scores ${num(result.overall, 0)} / 100 (${result.grade}) for reliability, based on ${fmtInt(result.sampleSize)} historical occurrences. Reliability describes how much to trust the historical evidence — it is distinct from probability.`,
    ],
    bullets: result.warnings.length ? result.warnings : ['No reliability warnings were raised for this result.'],
  };
  const stats: ReportSection = {
    id: 'statistics',
    title: 'Statistics',
    stats: [
      { label: 'Overall Reliability', value: `${num(result.overall, 0)} / 100` },
      { label: 'Grade', value: result.grade },
      { label: 'Sample Size', value: fmtInt(result.sampleSize) },
      { label: 'Recovery Rate', value: pct(result.recoveryRate) },
      ...result.components.map((c) => ({ label: c.label, value: `${num(c.score, 0)} / 100`, hint: `${c.weight} pts` })),
    ],
  };
  const charts: ReportSection = {
    id: 'charts',
    title: 'Charts',
    charts: [
      {
        title: 'Reliability Breakdown',
        kind: 'bar',
        unit: 'score',
        data: result.components.map((c) => ({ label: c.label, value: Math.round(c.score) })),
        note: 'Each component scored 0–100; the final score is their weighted sum.',
      },
      {
        title: 'Validation Timeline',
        kind: 'line',
        unit: '%',
        data: result.timeline.map((t) => ({ label: t.weekStart, value: Math.round(t.recoveryPct * 10) / 10 })),
        note: 'Recovery rate per week across the studied history.',
      },
    ],
  };
  const tables: ReportSection = {
    id: 'tables',
    title: 'Tables',
    tables: [
      {
        name: 'Reliability Breakdown',
        columns: ['Component', 'Score', 'Weight', 'Detail'],
        rows: result.components.map((c) => [c.label, num(c.score, 0), c.weight, c.detail]),
      },
      {
        name: 'Weekly Timeline',
        columns: ['Week', 'Occurrences', 'Recovery %'],
        rows: result.timeline.map((t) => [t.weekStart, t.occurrences, num(t.recoveryPct, 1)]),
      },
    ],
  };
  const obs: string[] = [];
  obs.push(`Reliability grade ${result.grade} reflects ${fmtInt(result.sampleSize)} historical occurrences and the stability of the studied period.`);
  const weakest = [...result.components].sort((a, b) => a.score - b.score)[0];
  if (weakest) obs.push(`The lowest-scoring component is ${weakest.label} (${num(weakest.score, 0)}/100): ${weakest.detail}`);
  obs.push('Reliability measures trust in historical evidence, not the likelihood of any future outcome.');

  return assemble('reliability', recordSubject(rec), recordWindow(rec), generatedAt, [
    exec,
    recordInputs(rec),
    { id: 'methodology', title: 'Methodology', paragraphs: methodologyParagraphs('reliability') },
    stats,
    charts,
    tables,
    { id: 'observations', title: 'Observations', bullets: obs },
  ]);
}

// --- 4) Walk Forward Report ---------------------------------------------------

export function buildWalkForwardReport(result: WalkForwardResult, generatedAt: string): ReportDocument {
  const rec = result.record;
  const a = result.aggregate;
  const verdict = a.totalWalks === 0 ? 'Insufficient data' : a.failed > a.passed ? 'Failed more often than passed' : a.passed >= a.totalWalks * 0.6 ? 'Passed' : 'Borderline';
  const exec: ReportSection = {
    id: 'executive-summary',
    title: 'Executive Summary',
    stats: [
      { label: 'Total Walks', value: fmtInt(a.totalWalks) },
      { label: 'Passed', value: fmtInt(a.passed) },
      { label: 'Borderline', value: fmtInt(a.borderline) },
      { label: 'Failed', value: fmtInt(a.failed) },
      { label: 'Avg Robustness', value: a.avgRobustness == null ? '—' : `${num(a.avgRobustness, 0)} / 100` },
      { label: 'Validation', value: verdict },
    ],
    paragraphs: [
      `Across ${fmtInt(a.totalWalks)} rolling walks, the stored strategy passed ${fmtInt(a.passed)}, was borderline in ${fmtInt(a.borderline)} and failed ${fmtInt(a.failed)}. Average robustness was ${a.avgRobustness == null ? '—' : num(a.avgRobustness, 0)} / 100 with a mean recovery drift of ${a.avgDrift == null ? '—' : num(a.avgDrift, 1)} points between training and validation windows.`,
    ],
    bullets: result.warnings.length ? result.warnings : ['No walk-forward warnings were raised.'],
  };
  const stats: ReportSection = {
    id: 'statistics',
    title: 'Statistics',
    stats: [
      { label: 'Total Walks', value: fmtInt(a.totalWalks) },
      { label: 'Passed', value: fmtInt(a.passed) },
      { label: 'Borderline', value: fmtInt(a.borderline) },
      { label: 'Failed', value: fmtInt(a.failed) },
      { label: 'Avg Robustness', value: a.avgRobustness == null ? '—' : num(a.avgRobustness, 0) },
      { label: 'Avg Recovery Drift', value: a.avgDrift == null ? '—' : `${num(a.avgDrift, 1)} pts` },
      { label: 'History Span', value: `${fmtInt(result.spanDays)} days` },
    ],
  };
  const charts: ReportSection = {
    id: 'charts',
    title: 'Charts',
    charts: [
      {
        title: 'Validation Timeline',
        kind: 'line',
        unit: 'robustness',
        data: result.walks.map((w) => ({ label: `#${w.index + 1}`, value: Math.round(w.robustness) })),
        note: 'Robustness score per walk (training vs validation agreement).',
      },
      {
        title: 'Outcome Distribution',
        kind: 'bar',
        unit: 'walks',
        data: [
          { label: 'Passed', value: a.passed },
          { label: 'Borderline', value: a.borderline },
          { label: 'Failed', value: a.failed },
        ],
      },
    ],
  };
  const tables: ReportSection = {
    id: 'tables',
    title: 'Tables',
    tables: [
      {
        name: 'Walk Forward Results',
        columns: ['Walk', 'Train Window', 'Val Window', 'Train Rec %', 'Val Rec %', 'Robustness', 'Status'],
        rows: result.walks.map((w) => [
          `#${w.index + 1}`,
          `${w.trainStart}→${w.trainEnd}`,
          `${w.valStart}→${w.valEnd}`,
          num(w.training.recoveryPct, 1),
          num(w.validation.recoveryPct, 1),
          num(w.robustness, 0),
          w.status,
        ]),
      },
    ],
  };
  const obs: string[] = [];
  obs.push(`The strategy was validated across ${fmtInt(a.totalWalks)} walks spanning ${fmtInt(result.spanDays)} days of history.`);
  if (a.avgDrift != null) obs.push(`Mean recovery drift between training and validation windows was ${num(a.avgDrift, 1)} points${a.avgDrift < 10 ? ' — recovery remained consistent across unseen windows.' : '.'}`);
  obs.push('Walk-forward validation evaluates robustness on unseen historical windows; it does not optimise or predict.');

  return assemble('walk-forward', recordSubject(rec), recordWindow(rec), generatedAt, [
    exec,
    recordInputs(rec),
    { id: 'methodology', title: 'Methodology', paragraphs: methodologyParagraphs('walk-forward') },
    stats,
    charts,
    tables,
    { id: 'observations', title: 'Observations', bullets: obs },
  ]);
}

// --- 5) Market Context Report -------------------------------------------------

export function buildMarketContextReport(ctx: MarketContext, generatedAt: string): ReportDocument {
  const cur = ctx.current;
  const subject = cur ? `Current gap ${num(cur.gap)}` : 'Market context';
  const window = `${ctx.windowStartDay ?? '—'} → ${ctx.windowEndDay ?? '—'} · ${fmtInt(ctx.windowDayCount)} trading days`;
  const d = ctx.distribution;
  const exec: ReportSection = {
    id: 'executive-summary',
    title: 'Executive Summary',
    stats: [
      { label: 'Research Window', value: `${fmtInt(ctx.windowDays)} days` },
      { label: 'Research Period', value: window },
      { label: 'Current Gap', value: cur ? num(cur.gap) : '—' },
      { label: 'Gap Percentile', value: pct(ctx.gapPercentileRecent, 0) },
      { label: 'Market Regime', value: ctx.marketRegime.kind },
    ],
    paragraphs: [
      cur
        ? `The current gap of ${num(cur.gap)} sits at the ${pct(ctx.gapPercentileRecent, 0)} percentile of the last ${fmtInt(ctx.windowDayCount)} trading days. The market regime is classified as ${ctx.marketRegime.kind}: ${ctx.marketRegime.reason}`
        : 'No current market sample is available in the uploaded data.',
    ],
    bullets: ctx.observations.slice(0, 3),
  };
  const inputs: ReportSection = {
    id: 'research-inputs',
    title: 'Research Inputs',
    stats: [
      { label: 'Recent Window', value: `${fmtInt(ctx.windowDays)} days` },
      { label: 'Maximum Window', value: `${fmtInt(ctx.maxWindowDays)} days` },
      { label: 'Current Gap', value: cur ? num(cur.gap) : '—', hint: ctx.currentGapIsOverride ? 'manual override' : 'latest sample' },
      { label: 'Days Covered', value: fmtInt(ctx.windowDayCount) },
      { label: 'Samples', value: fmtInt(ctx.windowSampleCount) },
    ],
  };
  const stats: ReportSection = {
    id: 'statistics',
    title: 'Statistics',
    stats: [
      { label: 'Gap Percentile (recent)', value: pct(ctx.gapPercentileRecent, 0) },
      { label: 'Recent Average Gap', value: num(ctx.recentAvgGap) },
      { label: 'Recent Median Gap', value: num(ctx.recentMedianGap) },
      { label: 'Recent Volatility', value: num(ctx.recentVolatility, 3) },
      { label: 'Average Daily Volatility', value: num(ctx.averageDailyVolatility, 3) },
      { label: 'Relative Volatility', value: ctx.relativeVolatility == null ? '—' : `${num(ctx.relativeVolatility, 2)}×` },
      { label: 'Market Regime', value: ctx.marketRegime.kind },
      { label: 'Expansion Frequency', value: pct(ctx.expansionPct, 0) },
      { label: 'Compression Frequency', value: pct(ctx.compressionPct, 0) },
    ],
  };
  const charts: ReportSection = {
    id: 'charts',
    title: 'Charts',
    charts: [
      {
        title: 'Gap Distribution',
        kind: 'bar',
        unit: 'samples',
        data: ctx.histogram.map((b) => ({ label: b.label, value: b.count, highlight: b.containsCurrent })),
      },
      {
        title: 'Volatility Distribution',
        kind: 'line',
        unit: 'volatility',
        data: ctx.volatilityDistribution.map((v) => ({ label: v.day.slice(5), value: Math.round(v.volatility * 1000) / 1000 })),
      },
      {
        title: 'Session Distribution',
        kind: 'bar',
        unit: 'volatility',
        data: ctx.sessions.map((s) => ({ label: s.session, value: Math.round((s.volatility ?? 0) * 1000) / 1000 })),
      },
    ],
  };
  const tables: ReportSection = {
    id: 'tables',
    title: 'Tables',
    tables: [
      {
        name: 'Recent Gap Distribution',
        columns: ['Percentile', 'Gap'],
        rows: d
          ? [['Min', num(d.min)], ['P25', num(d.p25)], ['Median', num(d.median)], ['P75', num(d.p75)], ['P90', num(d.p90)], ['P95', num(d.p95)], ['Max', num(d.max)]]
          : [['—', '—']],
      },
      {
        name: 'Session Context',
        columns: ['Session', 'Avg Gap', 'Volatility', 'Samples'],
        rows: ctx.sessions.map((s) => [s.session, num(s.avgGap), num(s.volatility, 3), s.samples]),
      },
    ],
  };
  return assemble('market-context', subject, window, generatedAt, [
    exec,
    inputs,
    { id: 'methodology', title: 'Methodology', paragraphs: methodologyParagraphs('market-context') },
    stats,
    charts,
    tables,
    { id: 'observations', title: 'Observations', bullets: ctx.observations },
  ]);
}

// --- 6) Strategy Report (composite) ------------------------------------------

export function buildStrategyReport(
  rec: RepositoryRecord,
  d: Dossier,
  reliability: ReliabilityResult,
  walk: WalkForwardResult | null,
  generatedAt: string,
): ReportDocument {
  const exec: ReportSection = {
    id: 'executive-summary',
    title: 'Executive Summary',
    stats: [
      { label: 'Historical Events', value: fmtInt(rec.historicalTrades) },
      { label: 'Recovery %', value: pct(rec.recoveryBeforeSlPct) },
      { label: 'Stop Loss %', value: pct(rec.slHitPct) },
      { label: 'Reliability', value: `${num(reliability.overall, 0)} (${reliability.grade})` },
      { label: 'Validation', value: walk ? `${fmtInt(walk.aggregate.passed)}/${fmtInt(walk.aggregate.totalWalks)} passed` : 'Not run' },
      { label: 'Confidence', value: rec.confidenceLabel },
    ],
    paragraphs: [
      `This strategy review consolidates ${fmtInt(rec.historicalTrades)} historical occurrences. ${pct(rec.recoveryBeforeSlPct)} recovered before the stop-loss boundary; the result carries a reliability score of ${num(reliability.overall, 0)} / 100 (${reliability.grade})${walk ? ` and passed ${fmtInt(walk.aggregate.passed)} of ${fmtInt(walk.aggregate.totalWalks)} walk-forward windows` : ''}.`,
    ],
    bullets: d.observations.slice(0, 3),
  };
  const stats: ReportSection = {
    id: 'statistics',
    title: 'Statistics',
    stats: [
      { label: 'Total Events', value: fmtInt(rec.historicalTrades) },
      { label: 'Recovery Before SL', value: pct(rec.recoveryBeforeSlPct) },
      { label: 'Recovery After SL', value: pct(rec.recoveryAfterSlPct) },
      { label: 'Stop Loss %', value: pct(rec.slHitPct) },
      { label: 'Average Holding', value: dur(rec.avgHoldingSec) },
      { label: 'Median Holding', value: dur(d.recoveryTime.medianSec) },
      { label: 'Worst Expansion', value: num(rec.worstMaxGap) },
      { label: 'P95 Expansion', value: num(rec.p95MaxGap) },
      { label: 'Reliability', value: `${num(reliability.overall, 0)} / 100` },
      { label: 'Reliability Grade', value: reliability.grade },
      { label: 'Validation', value: walk ? `${fmtInt(walk.aggregate.passed)}/${fmtInt(walk.aggregate.totalWalks)} passed` : 'Not run' },
    ],
  };
  const charts: ReportSection = {
    id: 'charts',
    title: 'Charts',
    charts: [
      { title: 'Outcome Distribution', kind: 'bar', unit: 'events', data: d.outcomes.map((o) => ({ label: o.label, value: o.count })) },
      { title: 'Reliability Breakdown', kind: 'bar', unit: 'score', data: reliability.components.map((c) => ({ label: c.label, value: Math.round(c.score) })) },
      { title: 'Session Distribution', kind: 'bar', unit: 'events', data: d.sessions.map((s) => ({ label: s.session, value: s.occurrences })) },
    ],
  };
  const tables: ReportSection = {
    id: 'tables',
    title: 'Tables',
    tables: [
      {
        name: 'Session Breakdown',
        columns: ['Session', 'Occurrences', 'Recovery %', 'SL Hit %'],
        rows: d.sessions.map((s) => [s.session, s.occurrences, num(s.recoveryPct, 1), num(s.slHitPct, 1)]),
      },
      {
        name: 'Reliability Breakdown',
        columns: ['Component', 'Score', 'Weight'],
        rows: reliability.components.map((c) => [c.label, num(c.score, 0), c.weight]),
      },
      ...(walk
        ? [{
            name: 'Walk Forward Summary',
            columns: ['Walk', 'Train Rec %', 'Val Rec %', 'Robustness', 'Status'],
            rows: walk.walks.map((w) => [`#${w.index + 1}`, num(w.training.recoveryPct, 1), num(w.validation.recoveryPct, 1), num(w.robustness, 0), w.status]),
          } as ReportTable]
        : []),
    ],
  };
  const obs = [...d.observations];
  obs.push(`Reliability scored ${num(reliability.overall, 0)} / 100 (${reliability.grade}) over ${fmtInt(reliability.sampleSize)} occurrences.`);
  if (walk && walk.aggregate.totalWalks > 0) {
    obs.push(`Walk-forward validation passed ${fmtInt(walk.aggregate.passed)} of ${fmtInt(walk.aggregate.totalWalks)} windows.`);
  }

  return assemble('strategy', recordSubject(rec), recordWindow(rec), generatedAt, [
    exec,
    recordInputs(rec),
    { id: 'methodology', title: 'Methodology', paragraphs: methodologyParagraphs('strategy') },
    stats,
    charts,
    tables,
    { id: 'observations', title: 'Observations', bullets: obs },
  ]);
}

// --- 7) Replay Report ---------------------------------------------------------

export function buildReplayReport(t: ReplayTimeline, rec: RepositoryRecord, generatedAt: string): ReportDocument {
  const occ = t.occurrence;
  const subject = `${recordSubject(rec)} · ${occ.date} ${occ.time}`;
  const window = recordWindow(rec);
  const sampleCount = t.samples.length;
  const exec: ReportSection = {
    id: 'executive-summary',
    title: 'Executive Summary',
    stats: [
      { label: 'Date', value: occ.date },
      { label: 'Outcome', value: t.outcomeLabel },
      { label: 'Entry Gap', value: num(t.levels.entry) },
      { label: 'Samples', value: fmtInt(sampleCount) },
      { label: 'Holding', value: dur(t.durationSec) },
    ],
    paragraphs: [
      `This report replays a single historical occurrence on ${occ.date} at ${occ.time}. The position entered at gap ${num(t.levels.entry)} and resolved as "${t.outcomeLabel}" over ${fmtInt(sampleCount)} samples.`,
    ],
  };
  const inputs: ReportSection = {
    id: 'research-inputs',
    title: 'Research Inputs',
    stats: [
      { label: 'Document', value: rec.id },
      { label: 'Date', value: occ.date },
      { label: 'Entry Gap', value: num(t.levels.entry) },
      { label: 'Recovery Gap', value: num(t.levels.recovery) },
      { label: 'Stop Loss', value: num(t.levels.stopLoss) },
      { label: 'Session', value: occ.session },
    ],
  };
  const stats: ReportSection = {
    id: 'statistics',
    title: 'Statistics',
    stats: [
      { label: 'Outcome', value: t.outcomeLabel },
      { label: 'Entry Gap', value: num(t.levels.entry) },
      { label: 'Worst Gap', value: num(occ.maxGap) },
      { label: 'Best Compression', value: num(occ.minGap) },
      { label: 'Holding', value: dur(t.durationSec) },
      { label: 'Samples', value: fmtInt(sampleCount) },
    ],
  };
  // Sub-sample the path so charts/tables stay compact for very long occurrences.
  const stride = Math.max(1, Math.ceil(sampleCount / 60));
  const sampled = t.samples.filter((_, i) => i % stride === 0);
  const charts: ReportSection = {
    id: 'charts',
    title: 'Charts',
    charts: [
      {
        title: 'Gap Path',
        kind: 'line',
        unit: 'gap',
        data: sampled.map((s) => ({ label: s.time, value: Math.round(s.gap * 1000) / 1000 })),
        note: `Sampled every ${stride} step${stride === 1 ? '' : 's'} for readability.`,
      },
    ],
  };
  const tableStride = Math.max(1, Math.ceil(sampleCount / 200));
  const tables: ReportSection = {
    id: 'tables',
    title: 'Tables',
    tables: [
      {
        name: 'Replay Timeline (sampled)',
        columns: ['Time', 'Elapsed (s)', 'Gap', 'Expansion', 'Compression'],
        rows: t.samples
          .filter((_, i) => i % tableStride === 0)
          .map((s) => [s.time, Math.round(s.elapsedSec), num(s.gap, 3), num(s.expansion, 3), num(s.compression, 3)]),
      },
    ],
  };
  const obs = [
    `The occurrence resolved as "${t.outcomeLabel}" with a worst gap of ${num(occ.maxGap)} and best compression of ${num(occ.minGap)}.`,
    'A replay is a faithful reconstruction of one historical path; it adds no calculation and forecasts nothing.',
  ];
  return assemble('replay', subject, window, generatedAt, [
    exec,
    inputs,
    { id: 'methodology', title: 'Methodology', paragraphs: methodologyParagraphs('replay') },
    stats,
    charts,
    tables,
    { id: 'observations', title: 'Observations', bullets: obs },
  ]);
}

// --- themed HTML rendering ----------------------------------------------------

interface Palette {
  bg: string;
  panel: string;
  panelAlt: string;
  border: string;
  ink: string;
  muted: string;
  faint: string;
  accent: string;
  bar: string;
  barAlt: string;
}

const THEMES: Record<ReportTheme, Palette> = {
  professional: { bg: '#ffffff', panel: '#f8fafc', panelAlt: '#f1f5f9', border: '#cbd5e1', ink: '#0b1220', muted: '#475569', faint: '#64748b', accent: '#0369a1', bar: '#0ea5e9', barAlt: '#94a3b8' },
  light: { bg: '#ffffff', panel: '#fafafa', panelAlt: '#f4f4f5', border: '#e4e4e7', ink: '#18181b', muted: '#52525b', faint: '#71717a', accent: '#2563eb', bar: '#3b82f6', barAlt: '#cbd5e1' },
  dark: { bg: '#0b1220', panel: '#111a2c', panelAlt: '#0f1729', border: '#1e293b', ink: '#e2e8f0', muted: '#94a3b8', faint: '#64748b', accent: '#38bdf8', bar: '#38bdf8', barAlt: '#334155' },
  institutional: { bg: '#ffffff', panel: '#f7f6f3', panelAlt: '#efece6', border: '#d6d0c4', ink: '#1a1a1a', muted: '#4a4a4a', faint: '#6b6b6b', accent: '#7c2d12', bar: '#9a3412', barAlt: '#a8a29e' },
};

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function svgChart(chart: ReportChart, p: Palette): string {
  const data = chart.data;
  if (data.length === 0) return `<div class="chart-empty">No data available for this chart.</div>`;
  const W = 720;
  const H = 200;
  const pad = 28;
  const max = Math.max(1, ...data.map((d) => Math.abs(d.value)));
  const innerW = W - pad * 2;
  const innerH = H - pad * 2;

  let body = '';
  if (chart.kind === 'line') {
    const stepX = data.length > 1 ? innerW / (data.length - 1) : 0;
    const pts = data.map((d, i) => {
      const x = pad + i * stepX;
      const y = pad + innerH - (Math.abs(d.value) / max) * innerH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    body += `<polyline fill="none" stroke="${p.bar}" stroke-width="2" points="${pts.join(' ')}"/>`;
    body += data
      .map((d, i) => {
        const x = pad + i * stepX;
        const y = pad + innerH - (Math.abs(d.value) / max) * innerH;
        return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.2" fill="${p.bar}"/>`;
      })
      .join('');
  } else {
    const n = data.length;
    const slot = innerW / n;
    const bw = Math.max(2, Math.min(40, slot * 0.7));
    body += data
      .map((d, i) => {
        const h = (Math.abs(d.value) / max) * innerH;
        const x = pad + i * slot + (slot - bw) / 2;
        const y = pad + innerH - h;
        const fill = d.highlight ? p.accent : p.bar;
        return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(0, h).toFixed(1)}" fill="${fill}" rx="1.5"/>`;
      })
      .join('');
  }
  // X labels (thinned to avoid overlap).
  const every = Math.ceil(data.length / 12);
  const labels = data
    .map((d, i) => {
      if (i % every !== 0) return '';
      const x = chart.kind === 'line'
        ? pad + (data.length > 1 ? (innerW / (data.length - 1)) * i : 0)
        : pad + (innerW / data.length) * i + innerW / data.length / 2;
      return `<text x="${x.toFixed(1)}" y="${H - 6}" font-size="8" fill="${p.faint}" text-anchor="middle">${esc(String(d.label))}</text>`;
    })
    .join('');
  const axis = `<line x1="${pad}" y1="${H - pad}" x2="${W - pad}" y2="${H - pad}" stroke="${p.border}" stroke-width="1"/>`;
  return `<div class="chart"><div class="chart-title">${esc(chart.title)}${chart.unit ? ` <span class="chart-unit">(${esc(chart.unit)})</span>` : ''}</div>
<svg viewBox="0 0 ${W} ${H}" width="100%" preserveAspectRatio="xMidYMid meet">${axis}${body}${labels}</svg>
${chart.note ? `<div class="chart-note">${esc(chart.note)}</div>` : ''}</div>`;
}

function statsHtml(stats: ReportStat[]): string {
  return `<div class="stat-grid">${stats
    .map(
      (s) => `<div class="stat"><div class="stat-label">${esc(s.label)}</div><div class="stat-value">${esc(s.value)}</div>${s.hint ? `<div class="stat-hint">${esc(s.hint)}</div>` : ''}</div>`,
    )
    .join('')}</div>`;
}

function tableHtml(t: ReportTable): string {
  const head = t.columns.map((c) => `<th>${esc(c)}</th>`).join('');
  const body = t.rows
    .map((r) => `<tr>${r.map((c) => `<td>${c == null ? '' : esc(String(c))}</td>`).join('')}</tr>`)
    .join('');
  return `<div class="table-name">${esc(t.name)}</div><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function sectionHtml(s: ReportSection, p: Palette, isCover: boolean): string {
  if (isCover) {
    const lines = (s.paragraphs ?? []).map((line, i) =>
      i === 0 ? `<div class="cover-brand">${esc(line)}</div>` : i === 1 ? `<div class="cover-tag">${esc(line)}</div>` : i === 2 ? `<div class="cover-type">${esc(line)}</div>` : `<div class="cover-subject">${esc(line)}</div>`,
    ).join('');
    return `<section class="cover">${lines}${s.stats ? statsHtml(s.stats) : ''}</section>`;
  }
  const parts: string[] = [`<h2>${esc(s.title)}</h2>`];
  if (s.paragraphs) for (const para of s.paragraphs) parts.push(`<p>${esc(para)}</p>`);
  if (s.stats && s.stats.length) parts.push(statsHtml(s.stats));
  if (s.charts) for (const c of s.charts) parts.push(svgChart(c, p));
  if (s.tables) for (const t of s.tables) parts.push(tableHtml(t));
  if (s.bullets && s.bullets.length) parts.push(`<ul>${s.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>`);
  if (s.definitions && s.definitions.length) {
    parts.push(`<dl>${s.definitions.map((d) => `<dt>${esc(d.term)}</dt><dd>${esc(d.definition)}</dd>`).join('')}</dl>`);
  }
  return `<section>${parts.join('')}</section>`;
}

export function reportHtml(doc: ReportDocument, theme: ReportTheme): string {
  const p = THEMES[theme];
  const sections = doc.sections
    .map((s) => sectionHtml(s, p, s.id === 'cover'))
    .join('');
  const footer = `Generated by ${PLATFORM} ${REPORT_ENGINE_VERSION} · Research Window ${esc(doc.researchWindow)} · Document Version ${DOCUMENT_VERSION}`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<title>${esc(doc.title)}</title>
<style>
  :root{color-scheme:${theme === 'dark' ? 'dark' : 'light'}}
  *{box-sizing:border-box}
  body{font-family:Inter,system-ui,-apple-system,sans-serif;background:${p.bg};color:${p.ink};margin:0;font-size:12.5px;line-height:1.5}
  .page{max-width:840px;margin:0 auto;padding:32px}
  .topbar{display:flex;justify-content:space-between;align-items:baseline;border-bottom:1px solid ${p.border};padding-bottom:8px;margin-bottom:20px;font-size:11px;color:${p.faint}}
  h2{font-size:14px;margin:26px 0 8px;padding-bottom:4px;border-bottom:1px solid ${p.border};color:${p.ink}}
  p{margin:6px 0;color:${p.muted}}
  ul{margin:8px 0 8px 18px;color:${p.muted}} li{margin:3px 0}
  dl{margin:8px 0} dt{font-weight:600;color:${p.ink};margin-top:8px} dd{margin:2px 0 0;color:${p.muted}}
  .cover{text-align:center;padding:60px 0 36px;border-bottom:2px solid ${p.border};margin-bottom:8px}
  .cover-brand{font-size:24px;font-weight:700;letter-spacing:.02em;color:${p.ink}}
  .cover-tag{font-size:12px;color:${p.faint};margin-top:4px}
  .cover-type{display:inline-block;margin-top:24px;padding:6px 14px;border:1px solid ${p.accent};border-radius:999px;color:${p.accent};font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.05em}
  .cover-subject{font-size:16px;margin-top:14px;color:${p.muted}}
  .stat-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;margin:10px 0}
  .stat{border:1px solid ${p.border};border-radius:6px;background:${p.panel};padding:8px 10px}
  .stat-label{font-size:9.5px;text-transform:uppercase;letter-spacing:.05em;color:${p.faint}}
  .stat-value{font-size:15px;font-weight:600;color:${p.ink};font-variant-numeric:tabular-nums;margin-top:2px}
  .stat-hint{font-size:10px;color:${p.faint};margin-top:1px}
  .chart{margin:14px 0;border:1px solid ${p.border};border-radius:6px;background:${p.panel};padding:10px 12px}
  .chart-title{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;color:${p.muted};margin-bottom:4px}
  .chart-unit{color:${p.faint};font-weight:400;text-transform:none}
  .chart-note{font-size:10px;color:${p.faint};margin-top:4px}
  .chart-empty{font-size:11px;color:${p.faint};padding:8px 0}
  .table-name{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;color:${p.muted};margin:14px 0 4px}
  table{border-collapse:collapse;width:100%;margin-bottom:6px;font-size:11px}
  th,td{border:1px solid ${p.border};padding:4px 7px;text-align:right;font-variant-numeric:tabular-nums;color:${p.ink}}
  th{background:${p.panelAlt};font-weight:600;color:${p.muted}}
  td:first-child,th:first-child{text-align:left}
  tbody tr:nth-child(even) td{background:${p.panel}}
  .footer{margin-top:28px;padding-top:10px;border-top:1px solid ${p.border};font-size:10px;color:${p.faint};text-align:center}
  @media print{.page{padding:0 12px}section{break-inside:avoid}}
</style></head><body><div class="page">
<div class="topbar"><span>${esc(PLATFORM)}</span><span>${esc(REPORT_TYPE_LABELS[doc.type])}</span><span>${esc(doc.generatedAt)}</span></div>
${sections}
<div class="footer">${footer}</div>
</div></body></html>`;
}

// --- serialisers --------------------------------------------------------------

function sanitize(s: string): string {
  return s.replace(/[^a-z0-9_-]+/gi, '_').replace(/^_+|_+$/g, '').slice(0, 80);
}

function csvCell(v: string | number | null): string {
  if (v == null) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function reportCsv(doc: ReportDocument): SerializedExport {
  const out: string[] = [];
  out.push(`# ${doc.title}`);
  out.push(`# Generated ${doc.generatedAt}`);
  out.push(`# Research Window: ${doc.researchWindow}`);
  out.push('');
  for (const s of doc.sections) {
    out.push(`## ${s.title}`);
    if (s.paragraphs) for (const para of s.paragraphs) out.push(csvCell(para));
    if (s.stats && s.stats.length) {
      out.push('Metric,Value');
      for (const st of s.stats) out.push([st.label, st.value].map(csvCell).join(','));
    }
    if (s.charts) {
      for (const c of s.charts) {
        out.push(`${csvCell(c.title)} (${c.unit ?? ''})`);
        out.push('Label,Value');
        for (const d of c.data) out.push([d.label, d.value].map(csvCell).join(','));
      }
    }
    if (s.tables) {
      for (const t of s.tables) {
        out.push(csvCell(t.name));
        out.push(t.columns.map(csvCell).join(','));
        for (const r of t.rows) out.push(r.map(csvCell).join(','));
      }
    }
    if (s.bullets) for (const b of s.bullets) out.push(csvCell(`- ${b}`));
    if (s.definitions) for (const d of s.definitions) out.push([d.term, d.definition].map(csvCell).join(','));
    out.push('');
  }
  return { filename: `${sanitize(doc.title)}.csv`, content: out.join('\n'), mime: 'text/csv' };
}

export function reportJson(doc: ReportDocument): SerializedExport {
  const payload = {
    note: 'Professional report generated by Gap Research Terminal. Descriptive only — reuses existing research, performs no calculation, contains no prediction or recommendation.',
    platform: PLATFORM,
    engineVersion: REPORT_ENGINE_VERSION,
    documentVersion: DOCUMENT_VERSION,
    ...doc,
  };
  return { filename: `${sanitize(doc.title)}.json`, content: JSON.stringify(payload, null, 2), mime: 'application/json' };
}

export function serializeReport(doc: ReportDocument, format: 'csv' | 'json'): SerializedExport {
  return format === 'json' ? reportJson(doc) : reportCsv(doc);
}

/** Opens a themed, print-ready report window (browser "Save as PDF"). */
export function printReportPdf(doc: ReportDocument, theme: ReportTheme): void {
  const html = reportHtml(doc, theme);
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 300);
}
