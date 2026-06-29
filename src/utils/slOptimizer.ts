/**
 * Stop Loss Optimizer (additive, read-only).
 *
 * Sweeps stop-loss values and, for each, runs the Research Engine v1.0
 * (computeScenario) to record the historical statistical outcome. It does NOT
 * reimplement any scenario logic and does NOT recommend trades — every row is a
 * description of what historically happened at that SL.
 */

import type { GapSample } from '@/types/gap';
import {
  computeScenario,
  CONFIDENCE_LABELS,
  type ConfidenceLevel,
  type ScenarioInput,
} from '@/utils/scenario';
import type { SerializedExport } from '@/utils/reports';

const CONFIDENCE_ORDER: ConfidenceLevel[] = [
  'VERY_LOW',
  'LOW',
  'MEDIUM',
  'HIGH',
  'VERY_HIGH',
];

export interface SlOptimizerInput {
  entryGap: number;
  recoveryGap: number;
  minStopLoss: number;
  maxStopLoss: number;
  step: number;
  sameDayOnly: boolean;
  sessions: string[];
  syncStatuses: string[];
}

export const DEFAULT_SL_OPTIMIZER_INPUT: SlOptimizerInput = {
  entryGap: 18.0,
  recoveryGap: 15.5,
  minStopLoss: 18.5,
  maxStopLoss: 24.0,
  step: 0.1,
  sameDayOnly: true,
  sessions: [],
  syncStatuses: [],
};

export interface SlOptimizerRow {
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
  p90MaxGap: number | null;
  p95MaxGap: number | null;
  p99MaxGap: number | null;
  avgHoldingSec: number | null;
  worstHoldingSec: number | null;
  confidenceLevel: ConfidenceLevel;
  confidenceLabel: string;
  // Derived (relative to previous SL):
  recoveryGain: number; // % points vs previous SL
  riskIncrease: number; // gap points of SL added
  efficiency: number; // recovery gain per unit risk
  score: number; // 0–100 balanced score
}

export interface SlOptimizerMeta {
  totalTested: number;
  minStopLoss: number;
  maxStopLoss: number;
  step: number;
  /** Wall-clock time spent running the Research Engine sweep, in ms. */
  calcTimeMs: number;
  /** Number of Research Engine (computeScenario) calls made. */
  engineCalls: number;
}

export interface SlOptimizerResult {
  input: SlOptimizerInput;
  rows: SlOptimizerRow[];
  balanced: SlOptimizerRow | null;
  maxSuccess: SlOptimizerRow | null;
  fastest: SlOptimizerRow | null;
  lowestRisk: SlOptimizerRow | null;
  highestScore: SlOptimizerRow | null;
  /** Marginal recovery improvement available beyond the balanced SL. */
  marginalBeyondBalanced: number;
  truncated: boolean;
  meta: SlOptimizerMeta;
}

const MAX_STEPS = 400;
const EPS = 1e-9;

function round(value: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

/** Decimal places implied by the step size, for clean SL labels. */
function decimalsFor(step: number): number {
  const s = String(step);
  const dot = s.indexOf('.');
  return dot === -1 ? 0 : Math.min(6, s.length - dot - 1);
}

function mean(values: number[]): number | null {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

function normalize(value: number, min: number, max: number): number {
  if (max - min < EPS) return 0.5;
  return (value - min) / (max - min);
}

/** Runs the SL sweep, calling the Research Engine once per SL value. */
function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : 0;
}

export function runSlOptimizer(
  samples: GapSample[],
  input: SlOptimizerInput,
): SlOptimizerResult {
  const t0 = now();
  const step = input.step > 0 ? input.step : 0.1;
  const decimals = decimalsFor(step);

  // Build the SL ladder.
  const levels: number[] = [];
  let sl = input.minStopLoss;
  let guard = 0;
  let truncated = false;
  while (sl <= input.maxStopLoss + EPS) {
    levels.push(round(sl, decimals));
    sl = round(sl + step, decimals);
    guard += 1;
    if (guard >= MAX_STEPS) {
      truncated = true;
      break;
    }
  }

  // Pass 1: run the engine per SL.
  const base = levels.map((stopLoss): Omit<SlOptimizerRow, 'recoveryGain' | 'riskIncrease' | 'efficiency' | 'score'> => {
    const scenario: ScenarioInput = {
      entryGap: input.entryGap,
      recoveryGap: input.recoveryGap,
      stopLoss,
      maxHoldingMinutes: null,
      sameDayOnly: input.sameDayOnly,
      sessions: input.sessions,
      syncStatuses: input.syncStatuses,
      minEvents: 10,
    };
    const r = computeScenario(samples, scenario);
    const holdings = r.events
      .map((e) => e.durationSec)
      .filter((v): v is number => v !== null);
    return {
      stopLoss,
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
      p90MaxGap: r.adverse.p90,
      p95MaxGap: r.adverse.p95,
      p99MaxGap: r.adverse.p99,
      avgHoldingSec: mean(holdings),
      worstHoldingSec: holdings.length ? Math.max(...holdings) : null,
      confidenceLevel: r.confidence.level,
      confidenceLabel: CONFIDENCE_LABELS[r.confidence.level],
    };
  });

  // Normalisation bounds for the score.
  const gapVals = base.map((b) => b.avgMaxGap ?? 0);
  const holdVals = base.map((b) => b.avgHoldingSec ?? 0);
  const slVals = base.map((b) => b.stopLoss);
  const gapMin = Math.min(...gapVals, 0);
  const gapMax = Math.max(...gapVals, 0);
  const holdMin = Math.min(...holdVals, 0);
  const holdMax = Math.max(...holdVals, 0);
  const slMin = Math.min(...slVals);
  const slMax = Math.max(...slVals);

  // Pass 2: derived metrics + balanced 0–100 score.
  // The SL-dependent recovery metric is Recovery BEFORE SL (practical success at
  // that stop): it rises with SL toward the Recovery-Ignoring-SL ceiling. (In the
  // position model, Recovery Ignoring SL is constant because the scan continues
  // past SL, so it cannot drive SL selection.)
  const rows: SlOptimizerRow[] = base.map((b, i) => {
    const prev = i > 0 ? base[i - 1]! : null;
    const recoveryGain = prev
      ? b.recoveryBeforeSlPct - prev.recoveryBeforeSlPct
      : 0;
    const riskIncrease = prev ? round(b.stopLoss - prev.stopLoss, decimals) : 0;
    const efficiency = riskIncrease > EPS ? recoveryGain / riskIncrease : 0;

    const recNorm = b.recoveryBeforeSlPct / 100; // higher better
    const gapNorm = 1 - normalize(b.avgMaxGap ?? gapMin, gapMin, gapMax); // lower better
    const holdNorm = 1 - normalize(b.avgHoldingSec ?? holdMin, holdMin, holdMax); // lower better
    const confNorm = CONFIDENCE_ORDER.indexOf(b.confidenceLevel) / 4;
    const slPenalty = normalize(b.stopLoss, slMin, slMax); // larger SL penalised
    // Penalise rows whose marginal improvement is tiny (diminishing returns).
    const tinyImprovementPenalty = prev && recoveryGain < 0.1 ? 0.05 : 0;

    const raw =
      0.45 * recNorm +
      0.2 * gapNorm +
      0.15 * holdNorm +
      0.2 * confNorm -
      0.2 * slPenalty -
      tinyImprovementPenalty;
    const score = Math.max(0, Math.min(100, raw * 100));

    return { ...b, recoveryGain, riskIncrease, efficiency, score };
  });

  const meta: SlOptimizerMeta = {
    totalTested: levels.length,
    minStopLoss: levels.length ? levels[0]! : input.minStopLoss,
    maxStopLoss: levels.length ? levels[levels.length - 1]! : input.maxStopLoss,
    step,
    engineCalls: levels.length, // exactly one Research Engine call per SL
    calcTimeMs: now() - t0,
  };

  return summarise(input, rows, truncated, meta);
}

const BALANCED_GAIN_EPS = 0.1; // % recovery
const BALANCED_LOOKAHEAD = 3;

function summarise(
  input: SlOptimizerInput,
  rows: SlOptimizerRow[],
  truncated: boolean,
  meta: SlOptimizerMeta,
): SlOptimizerResult {
  const withPositions = rows.filter((r) => r.totalPositions > 0);

  // Balanced SL: first SL where the next few steps add almost no recovery.
  let balanced: SlOptimizerRow | null = null;
  for (let i = 0; i < rows.length; i += 1) {
    const ahead = rows.slice(i + 1, i + 1 + BALANCED_LOOKAHEAD);
    if (ahead.length === 0) continue;
    if (ahead.every((r) => r.recoveryGain < BALANCED_GAIN_EPS)) {
      balanced = rows[i]!;
      break;
    }
  }

  const maxSuccess =
    withPositions.length > 0
      ? withPositions.reduce((best, r) =>
          r.recoveryBeforeSlPct > best.recoveryBeforeSlPct ||
          (r.recoveryBeforeSlPct === best.recoveryBeforeSlPct &&
            r.stopLoss < best.stopLoss)
            ? r
            : best,
        )
      : null;

  const fastest =
    withPositions.filter((r) => r.avgRecoverySec !== null).length > 0
      ? withPositions
          .filter((r) => r.avgRecoverySec !== null)
          .reduce((best, r) =>
            (r.avgRecoverySec as number) < (best.avgRecoverySec as number) ? r : best,
          )
      : null;

  const lowestRisk =
    withPositions.filter((r) => r.avgMaxGap !== null).length > 0
      ? withPositions
          .filter((r) => r.avgMaxGap !== null)
          .reduce((best, r) =>
            (r.avgMaxGap as number) < (best.avgMaxGap as number) ? r : best,
          )
      : null;

  const highestScore =
    rows.length > 0 ? rows.reduce((best, r) => (r.score > best.score ? r : best)) : null;

  if (!balanced) balanced = highestScore;

  const marginalBeyondBalanced =
    balanced && maxSuccess
      ? Math.max(0, maxSuccess.recoveryBeforeSlPct - balanced.recoveryBeforeSlPct)
      : 0;

  return {
    input,
    rows,
    balanced,
    maxSuccess,
    fastest,
    lowestRisk,
    highestScore,
    marginalBeyondBalanced,
    truncated,
    meta,
  };
}

// --- exports ------------------------------------------------------------------

function csvCell(v: string | number | null): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const r1 = (n: number | null) => (n === null ? null : Math.round(n * 10) / 10);
const r3 = (n: number | null) => (n === null ? null : Math.round(n * 1000) / 1000);
const rt = (n: number | null) => (n === null ? null : Math.round(n));

const CSV_COLUMNS = [
  'Stop Loss', 'Total Positions', 'Recovery Before SL %', 'Recovery After SL %',
  'Recovery Ignoring SL %', 'SL Hit %', 'Avg Recovery (s)', 'Median Recovery (s)',
  'Avg Max Gap', 'Worst Max Gap', 'P90 Max Gap', 'P95 Max Gap', 'P99 Max Gap',
  'Avg Holding (s)', 'Worst Holding (s)', 'Recovery Gain', 'Risk Increase',
  'Efficiency', 'Score', 'Confidence',
];

function rowToCsv(r: SlOptimizerRow): Array<string | number | null> {
  return [
    r3(r.stopLoss), r.totalPositions, r1(r.recoveryBeforeSlPct), r1(r.recoveryAfterSlPct),
    r1(r.recoveryIgnoringSlPct), r1(r.slHitPct), rt(r.avgRecoverySec), rt(r.medianRecoverySec),
    r3(r.avgMaxGap), r3(r.worstMaxGap), r3(r.p90MaxGap), r3(r.p95MaxGap), r3(r.p99MaxGap),
    rt(r.avgHoldingSec), rt(r.worstHoldingSec), r1(r.recoveryGain), r3(r.riskIncrease),
    r3(r.efficiency), r1(r.score), r.confidenceLabel,
  ];
}

export function optimizerCsv(result: SlOptimizerResult): SerializedExport {
  const lines = [CSV_COLUMNS.map(csvCell).join(',')];
  for (const r of result.rows) lines.push(rowToCsv(r).map(csvCell).join(','));
  return {
    filename: 'StopLossOptimizer.csv',
    content: lines.join('\n'),
    mime: 'text/csv',
  };
}

export function optimizerJson(
  result: SlOptimizerResult,
  generatedAt: string,
): SerializedExport {
  const payload = {
    note:
      'Historical statistical research only. Each row describes what historically happened at that stop-loss. Not a trading signal.',
    generatedAt,
    input: result.input,
    highlights: {
      balanced: result.balanced?.stopLoss ?? null,
      maxSuccess: result.maxSuccess?.stopLoss ?? null,
      fastest: result.fastest?.stopLoss ?? null,
      lowestRisk: result.lowestRisk?.stopLoss ?? null,
      highestScore: result.highestScore?.stopLoss ?? null,
      marginalBeyondBalanced: result.marginalBeyondBalanced,
    },
    rows: result.rows,
  };
  return {
    filename: 'StopLossOptimizer.json',
    content: JSON.stringify(payload, null, 2),
    mime: 'application/json',
  };
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Opens a printable report window (user saves as PDF via the print dialog). */
export function printOptimizerPdf(
  result: SlOptimizerResult,
  generatedAt: string,
): void {
  const i = result.input;
  const head =
    `<tr>${CSV_COLUMNS.map((c) => `<th>${esc(c)}</th>`).join('')}</tr>`;
  const body = result.rows
    .map(
      (r) =>
        `<tr>${rowToCsv(r)
          .map((c) => `<td>${c === null ? '' : esc(String(c))}</td>`)
          .join('')}</tr>`,
    )
    .join('');
  const bal = result.balanced;
  const html = `<!doctype html><html><head><meta charset="utf-8"/>
<title>Stop Loss Optimizer</title>
<style>
  body{font-family:Inter,system-ui,sans-serif;color:#0b1220;margin:24px;font-size:12px}
  h1{font-size:18px;margin:0 0 4px} h2{font-size:14px;margin:16px 0 6px}
  .note{color:#64748b;font-size:11px;margin-bottom:12px}
  table{border-collapse:collapse;width:100%} th,td{border:1px solid #cbd5e1;padding:3px 6px;text-align:right;font-variant-numeric:tabular-nums}
  th{background:#f1f5f9} td:last-child,th:last-child{text-align:left}
  @media print{body{margin:0}}
</style></head><body>
<h1>Stop Loss Optimizer — Historical Statistical Report</h1>
<div class="note">Generated ${esc(generatedAt)}. Historical statistical research only — not a trading signal, no buy/sell recommendation.</div>
<div>Entry Gap ${i.entryGap} · Recovery Gap ${i.recoveryGap} · SL ${i.minStopLoss}–${i.maxStopLoss} step ${i.step}${i.sameDayOnly ? ' · same day only' : ''}</div>
${
    bal
      ? `<h2>Balanced Stop Loss: ${bal.stopLoss} (historical recovery ${bal.recoveryIgnoringSlPct.toFixed(1)}%)</h2>`
      : ''
  }
<table><thead>${head}</thead><tbody>${body}</tbody></table>
</body></html>`;

  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 250);
}
