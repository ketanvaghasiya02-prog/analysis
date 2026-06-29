/**
 * Strategy Comparison Engine (Phase 11G) — read-only side-by-side comparison.
 *
 * Compares 2–5 strategies that are ALREADY stored in the Research Repository.
 * It reuses the frozen dossier aggregation and the frozen ranking score; it
 * never reruns the Research Engine, never re-simulates and never recommends.
 * Every figure is historical evidence only.
 */

import type { RepositoryRecord } from '@/utils/researchRepository';
import { buildDossier, type Dossier } from '@/utils/strategyDossier';
import { rankStrategies, DEFAULT_RANKING_FILTERS } from '@/utils/strategyRanking';
import type { ConfidenceLevel } from '@/utils/scenario';
import type { SerializedExport } from '@/utils/reports';

const CONFIDENCE_ORDER: ConfidenceLevel[] = ['VERY_LOW', 'LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH'];

export const COMPARE_COLORS = ['#38bdf8', '#34d399', '#fbbf24', '#a78bfa', '#f87171'];
export const MAX_COMPARE = 5;
export const MIN_COMPARE = 2;

export type MetricFormat = 'num2' | 'num3' | 'int' | 'pct' | 'dur' | 'confidence' | 'score';
export type MetricDirection = 'higher' | 'lower' | 'none';

export interface CompStrategy {
  key: string;
  record: RepositoryRecord;
  dossier: Dossier;
  overallScore: number | null;
  color: string;
  letter: string;
  params: string;
}

export interface MetricRow {
  key: string;
  label: string;
  format: MetricFormat;
  direction: MetricDirection;
  values: Array<number | null>;
  best: number | null;
  worst: number | null;
}

export interface Comparison {
  strategies: CompStrategy[];
  metrics: MetricRow[];
  riskMetricKeys: string[];
  observations: string[];
}

interface MetricDef {
  key: string;
  label: string;
  format: MetricFormat;
  direction: MetricDirection;
  get: (s: CompStrategy) => number | null;
}

const METRIC_DEFS: MetricDef[] = [
  { key: 'entryGap', label: 'Entry Gap', format: 'num2', direction: 'none', get: (s) => s.record.entryGap },
  { key: 'recoveryGap', label: 'Recovery Gap', format: 'num2', direction: 'none', get: (s) => s.record.recoveryGap },
  { key: 'stopLoss', label: 'Stop Loss', format: 'num2', direction: 'none', get: (s) => s.record.stopLoss },
  { key: 'historicalTrades', label: 'Historical Trades', format: 'int', direction: 'higher', get: (s) => s.record.historicalTrades },
  { key: 'recoveryBeforeSlPct', label: 'Recovery Before SL %', format: 'pct', direction: 'higher', get: (s) => s.record.recoveryBeforeSlPct },
  { key: 'recoveryAfterSlPct', label: 'Recovery After SL %', format: 'pct', direction: 'none', get: (s) => s.record.recoveryAfterSlPct },
  { key: 'recoveryIgnoringSlPct', label: 'Recovery Ignoring %', format: 'pct', direction: 'higher', get: (s) => s.record.recoveryIgnoringSlPct },
  { key: 'slHitPct', label: 'SL Hit %', format: 'pct', direction: 'lower', get: (s) => s.record.slHitPct },
  { key: 'avgRecoverySec', label: 'Average Recovery Time', format: 'dur', direction: 'lower', get: (s) => s.record.avgRecoverySec },
  { key: 'medianRecoverySec', label: 'Median Recovery Time', format: 'dur', direction: 'lower', get: (s) => s.record.medianRecoverySec },
  { key: 'worstMaxGap', label: 'Worst Gap', format: 'num3', direction: 'lower', get: (s) => s.record.worstMaxGap },
  { key: 'avgMaxGap', label: 'Average Maximum Gap', format: 'num3', direction: 'lower', get: (s) => s.record.avgMaxGap },
  { key: 'p95MaxGap', label: 'P95 Gap', format: 'num3', direction: 'lower', get: (s) => s.record.p95MaxGap },
  { key: 'p99MaxGap', label: 'P99 Gap', format: 'num3', direction: 'lower', get: (s) => s.record.p99MaxGap },
  { key: 'confidence', label: 'Historical Confidence', format: 'confidence', direction: 'higher', get: (s) => CONFIDENCE_ORDER.indexOf(s.record.confidenceLevel) },
  { key: 'overallScore', label: 'Overall Score', format: 'score', direction: 'higher', get: (s) => s.overallScore },
];

export const RISK_METRIC_KEYS = ['worstMaxGap', 'p95MaxGap', 'p99MaxGap', 'avgRecoverySec'];

function bestWorst(values: Array<number | null>, direction: MetricDirection): { best: number | null; worst: number | null } {
  if (direction === 'none') return { best: null, worst: null };
  let best: number | null = null;
  let worst: number | null = null;
  let bestV = -Infinity;
  let worstV = Infinity;
  values.forEach((v, i) => {
    if (v === null || !Number.isFinite(v)) return;
    const score = direction === 'higher' ? v : -v;
    if (score > bestV) {
      bestV = score;
      best = i;
    }
    if (score < worstV) {
      worstV = score;
      worst = i;
    }
  });
  return { best, worst };
}

/** Builds the full read-only comparison for 2–5 repository records. */
export function buildComparison(records: RepositoryRecord[]): Comparison {
  // Overall score via the FROZEN ranking engine (Balanced) over the selection.
  const ranking = rankStrategies(records, DEFAULT_RANKING_FILTERS, 'BALANCED');
  const scoreByKey = new Map<string, number>();
  for (const r of ranking.ranked) scoreByKey.set(r.record.key, r.scores.overall);

  const strategies: CompStrategy[] = records.map((record, i) => ({
    key: record.key,
    record,
    dossier: buildDossier(record),
    overallScore: scoreByKey.get(record.key) ?? null,
    color: COMPARE_COLORS[i % COMPARE_COLORS.length]!,
    letter: String.fromCharCode(65 + i),
    params: `${round(record.entryGap)}/${round(record.recoveryGap)}/${round(record.stopLoss)}`,
  }));

  const metrics: MetricRow[] = METRIC_DEFS.map((def) => {
    const values = strategies.map((s) => def.get(s));
    const { best, worst } = bestWorst(values, def.direction);
    return { key: def.key, label: def.label, format: def.format, direction: def.direction, values, best, worst };
  });

  return {
    strategies,
    metrics,
    riskMetricKeys: RISK_METRIC_KEYS,
    observations: buildObservations(strategies, metrics),
  };
}

function round(n: number): string {
  return (Math.round(n * 100) / 100).toString();
}

function metric(metrics: MetricRow[], key: string): MetricRow | undefined {
  return metrics.find((m) => m.key === key);
}

function buildObservations(strategies: CompStrategy[], metrics: MetricRow[]): string[] {
  if (strategies.length < 2) return [];
  const out: string[] = [];
  const name = (i: number | null | undefined) =>
    i === null || i === undefined ? null : `Strategy ${strategies[i]!.letter} (${strategies[i]!.params})`;

  const say = (key: string, phrase: string) => {
    const m = metric(metrics, key);
    if (m && m.best !== null) {
      const n = name(m.best);
      if (n) out.push(`${n} ${phrase}.`);
    }
  };

  say('recoveryBeforeSlPct', 'showed the highest historical recovery before Stop Loss');
  say('recoveryIgnoringSlPct', 'had the highest historical recovery ignoring Stop Loss');
  say('historicalTrades', 'produced the most historical trades');
  say('avgRecoverySec', 'recovered fastest on average');
  say('slHitPct', 'had the lowest historical Stop Loss hit rate');
  say('worstMaxGap', 'had the smallest worst historical gap');
  say('overallScore', 'had the highest balanced score within this selection');

  out.push('All figures are historical statistics only — not a recommendation or prediction.');
  return out;
}

// --- export -------------------------------------------------------------------

function csvCell(v: string | number | null): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function fmtValue(v: number | null, format: MetricFormat): string {
  if (v === null || !Number.isFinite(v)) return '';
  switch (format) {
    case 'int':
      return String(Math.round(v));
    case 'pct':
      return `${(Math.round(v * 10) / 10).toFixed(1)}%`;
    case 'num2':
      return (Math.round(v * 100) / 100).toFixed(2);
    case 'num3':
      return (Math.round(v * 1000) / 1000).toFixed(3);
    case 'dur':
      return String(Math.round(v));
    case 'score':
      return (Math.round(v * 10) / 10).toFixed(1);
    case 'confidence':
      return CONFIDENCE_ORDER[v] ?? String(v);
  }
}

export function comparisonCsv(c: Comparison): SerializedExport {
  const header = ['Metric', ...c.strategies.map((s) => `${s.letter} (${s.params})`)];
  const lines = [header.map(csvCell).join(',')];
  for (const m of c.metrics) {
    lines.push([m.label, ...m.values.map((v) => fmtValue(v, m.format))].map(csvCell).join(','));
  }
  return { filename: 'StrategyComparison.csv', content: lines.join('\n'), mime: 'text/csv' };
}

export function comparisonJson(c: Comparison, generatedAt: string): SerializedExport {
  const payload = {
    note: 'Historical side-by-side comparison of stored strategies. Not a recommendation or prediction.',
    generatedAt,
    strategies: c.strategies.map((s) => ({
      letter: s.letter,
      params: s.params,
      id: s.record.id,
      entryGap: s.record.entryGap,
      recoveryGap: s.record.recoveryGap,
      stopLoss: s.record.stopLoss,
      overallScore: s.overallScore,
    })),
    metrics: c.metrics.map((m) => ({ key: m.key, label: m.label, values: m.values, best: m.best, worst: m.worst })),
    sessions: c.strategies.map((s) => ({ letter: s.letter, sessions: s.dossier.sessions })),
    months: c.strategies.map((s) => ({ letter: s.letter, months: s.dossier.months.filter((m) => m.occurrences > 0) })),
    outcomes: c.strategies.map((s) => ({ letter: s.letter, outcomes: s.dossier.outcomes })),
    observations: c.observations,
  };
  return { filename: 'StrategyComparison.json', content: JSON.stringify(payload, null, 2), mime: 'application/json' };
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function printComparisonPdf(c: Comparison, generatedAt: string): void {
  const head = `<tr><th>Metric</th>${c.strategies.map((s) => `<th>${esc(s.letter)} (${esc(s.params)})</th>`).join('')}</tr>`;
  const body = c.metrics
    .map(
      (m) =>
        `<tr><td>${esc(m.label)}</td>${m.values
          .map((v, i) => `<td${m.best === i ? ' class="best"' : m.worst === i ? ' class="worst"' : ''}>${esc(fmtValue(v, m.format))}</td>`)
          .join('')}</tr>`,
    )
    .join('');
  const obs = c.observations.map((o) => `<li>${esc(o)}</li>`).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"/>
<title>Strategy Comparison</title>
<style>
  body{font-family:Inter,system-ui,sans-serif;color:#0b1220;margin:24px;font-size:12px}
  h1{font-size:18px;margin:0 0 4px} h2{font-size:14px;margin:16px 0 6px}
  .note{color:#64748b;font-size:11px;margin-bottom:12px}
  ul{margin:6px 0 12px 18px} li{margin:2px 0}
  table{border-collapse:collapse;width:100%} th,td{border:1px solid #cbd5e1;padding:3px 6px;text-align:right;font-variant-numeric:tabular-nums}
  th{background:#f1f5f9} td:first-child,th:first-child{text-align:left}
  td.best{background:#dcfce7;font-weight:600} td.worst{background:#fee2e2}
  @media print{body{margin:0}}
</style></head><body>
<h1>Strategy Comparison — Historical Evidence</h1>
<div class="note">Generated ${esc(generatedAt)}. Historical statistics only — not a recommendation or prediction.</div>
<table><thead>${head}</thead><tbody>${body}</tbody></table>
<h2>Observations</h2><ul>${obs}</ul>
</body></html>`;
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 250);
}
