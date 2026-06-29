/**
 * Strategy Dossier (Phase 11E) — read-only investigation of ONE stored
 * strategy.
 *
 * Every figure here is derived by AGGREGATING the per-occurrence evidence that
 * was already produced by the frozen Research Engine and stored in the Research
 * Repository. It never reruns the engine, never re-simulates positions and
 * never ranks — it only summarises stored historical evidence for display.
 */

import {
  OUTCOME_LABELS,
  OUTCOME_ORDER,
  type ScenarioOutcome,
} from '@/utils/scenario';
import type { OccurrenceRecord } from '@/utils/strategyExecution';
import type { RepositoryRecord } from '@/utils/researchRepository';
import type { SerializedExport } from '@/utils/reports';

const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export interface SessionStat {
  session: string;
  occurrences: number;
  recoveryPct: number;
  avgHoldingSec: number | null;
  slHitPct: number;
}

export interface MonthStat {
  month: number; // 1–12
  label: string;
  occurrences: number;
  recoveryPct: number;
  avgHoldingSec: number | null;
}

export interface OutcomeStat {
  outcome: ScenarioOutcome;
  label: string;
  count: number;
  pct: number;
}

export interface HistogramBin {
  label: string;
  from: number; // minutes
  to: number; // minutes
  count: number;
}

export interface GapStats {
  avg: number | null;
  median: number | null;
  p90: number | null;
  p95: number | null;
  p99: number | null;
  worst: number | null;
  avgCompression: number | null;
  maxCompression: number | null;
}

export interface RecoveryTimeStats {
  avgSec: number | null;
  medianSec: number | null;
  fastestSec: number | null;
  slowestSec: number | null;
}

export interface QuickStats {
  highestExpansion: number | null;
  lowestExpansion: number | null;
  fastestRecoverySec: number | null;
  longestHoldingSec: number | null;
  mostActiveMonth: string | null;
  mostActiveSession: string | null;
}

export interface OutcomeCounts {
  recoveredBefore: number;
  recoveredAfter: number;
  slNotRecovered: number;
}

export interface Dossier {
  counts: OutcomeCounts;
  sessions: SessionStat[];
  months: MonthStat[];
  outcomes: OutcomeStat[];
  histogram: HistogramBin[];
  recoveryTime: RecoveryTimeStats;
  gaps: GapStats;
  quick: QuickStats;
  observations: string[];
}

function mean(values: number[]): number | null {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  if (sorted.length === 1) return sorted[0]!;
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo]!;
  const w = idx - lo;
  return sorted[lo]! * (1 - w) + sorted[hi]! * w;
}

function isRecoveredBefore(o: OccurrenceRecord): boolean {
  return o.outcome === 'RECOVERED_BEFORE_SL';
}
function reachedSl(o: OccurrenceRecord): boolean {
  return o.outcome === 'RECOVERED_AFTER_SL' || o.outcome === 'SL_NOT_RECOVERED';
}

function sessionStats(occ: OccurrenceRecord[]): SessionStat[] {
  const groups = new Map<string, OccurrenceRecord[]>();
  for (const o of occ) {
    const key = o.session || 'Unknown';
    const list = groups.get(key);
    if (list) list.push(o);
    else groups.set(key, [o]);
  }
  const out: SessionStat[] = [];
  for (const [session, list] of groups) {
    const total = list.length;
    const recovered = list.filter(isRecoveredBefore).length;
    const slHit = list.filter(reachedSl).length;
    out.push({
      session,
      occurrences: total,
      recoveryPct: total ? (recovered / total) * 100 : 0,
      avgHoldingSec: mean(list.map((o) => o.holdingSec).filter((v): v is number => v !== null)),
      slHitPct: total ? (slHit / total) * 100 : 0,
    });
  }
  return out.sort((a, b) => b.occurrences - a.occurrences);
}

function monthStats(occ: OccurrenceRecord[]): MonthStat[] {
  const byMonth = new Map<number, OccurrenceRecord[]>();
  for (const o of occ) {
    const m = Number(o.date.slice(5, 7)); // YYYY-MM-DD
    if (!Number.isFinite(m) || m < 1 || m > 12) continue;
    const list = byMonth.get(m);
    if (list) list.push(o);
    else byMonth.set(m, [o]);
  }
  const out: MonthStat[] = [];
  for (let m = 1; m <= 12; m += 1) {
    const list = byMonth.get(m) ?? [];
    const total = list.length;
    const recovered = list.filter(isRecoveredBefore).length;
    out.push({
      month: m,
      label: MONTH_LABELS[m - 1]!,
      occurrences: total,
      recoveryPct: total ? (recovered / total) * 100 : 0,
      avgHoldingSec: mean(list.map((o) => o.holdingSec).filter((v): v is number => v !== null)),
    });
  }
  return out;
}

function outcomeStats(occ: OccurrenceRecord[]): OutcomeStat[] {
  const counts = new Map<ScenarioOutcome, number>();
  for (const o of occ) counts.set(o.outcome, (counts.get(o.outcome) ?? 0) + 1);
  const total = occ.length;
  return OUTCOME_ORDER.map((outcome) => {
    const count = counts.get(outcome) ?? 0;
    return { outcome, label: OUTCOME_LABELS[outcome], count, pct: total ? (count / total) * 100 : 0 };
  }).filter((s) => s.count > 0);
}

function recoveryHistogram(occ: OccurrenceRecord[]): HistogramBin[] {
  const mins = occ
    .map((o) => o.recoveryTimeSec)
    .filter((v): v is number => v !== null)
    .map((s) => s / 60);
  if (mins.length === 0) return [];
  const min = Math.min(...mins);
  const max = Math.max(...mins);
  const binCount = Math.min(10, Math.max(4, Math.ceil(Math.sqrt(mins.length))));
  const span = max - min;
  if (span < 1e-9) {
    return [{ label: `${min.toFixed(0)}m`, from: min, to: max, count: mins.length }];
  }
  const width = span / binCount;
  const bins: HistogramBin[] = Array.from({ length: binCount }, (_, i) => {
    const from = min + i * width;
    const to = i === binCount - 1 ? max : from + width;
    return { label: `${from.toFixed(0)}–${to.toFixed(0)}m`, from, to, count: 0 };
  });
  for (const v of mins) {
    let idx = Math.floor((v - min) / width);
    if (idx >= binCount) idx = binCount - 1;
    if (idx < 0) idx = 0;
    bins[idx]!.count += 1;
  }
  return bins;
}

function gapStats(occ: OccurrenceRecord[], record: RepositoryRecord): GapStats {
  const maxGaps = occ.map((o) => o.maxGap).filter((v) => Number.isFinite(v));
  const compressions = occ
    .map((o) => o.entryGap - o.minGap)
    .filter((v) => Number.isFinite(v));
  if (maxGaps.length === 0) {
    // Fall back to the stored aggregate fields.
    return {
      avg: record.avgMaxGap,
      median: null,
      p90: null,
      p95: record.p95MaxGap,
      p99: record.p99MaxGap,
      worst: record.worstMaxGap,
      avgCompression: null,
      maxCompression: null,
    };
  }
  const sorted = [...maxGaps].sort((a, b) => a - b);
  return {
    avg: mean(maxGaps),
    median: percentile(sorted, 50),
    p90: percentile(sorted, 90),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    worst: sorted[sorted.length - 1]!,
    avgCompression: mean(compressions),
    maxCompression: compressions.length ? Math.max(...compressions) : null,
  };
}

function recoveryTimeStats(occ: OccurrenceRecord[], record: RepositoryRecord): RecoveryTimeStats {
  const times = occ
    .map((o) => o.recoveryTimeSec)
    .filter((v): v is number => v !== null);
  if (times.length === 0) {
    return {
      avgSec: record.avgRecoverySec,
      medianSec: record.medianRecoverySec,
      fastestSec: null,
      slowestSec: null,
    };
  }
  const sorted = [...times].sort((a, b) => a - b);
  return {
    avgSec: mean(times),
    medianSec: percentile(sorted, 50),
    fastestSec: sorted[0]!,
    slowestSec: sorted[sorted.length - 1]!,
  };
}

function quickStats(occ: OccurrenceRecord[], months: MonthStat[], sessions: SessionStat[]): QuickStats {
  const maxGaps = occ.map((o) => o.maxGap).filter((v) => Number.isFinite(v));
  const recTimes = occ.map((o) => o.recoveryTimeSec).filter((v): v is number => v !== null);
  const holdings = occ.map((o) => o.holdingSec).filter((v): v is number => v !== null);
  const topMonth = months.filter((m) => m.occurrences > 0).sort((a, b) => b.occurrences - a.occurrences)[0];
  const topSession = sessions[0];
  return {
    highestExpansion: maxGaps.length ? Math.max(...maxGaps) : null,
    lowestExpansion: maxGaps.length ? Math.min(...maxGaps) : null,
    fastestRecoverySec: recTimes.length ? Math.min(...recTimes) : null,
    longestHoldingSec: holdings.length ? Math.max(...holdings) : null,
    mostActiveMonth: topMonth ? topMonth.label : null,
    mostActiveSession: topSession ? topSession.session : null,
  };
}

function outcomeCounts(occ: OccurrenceRecord[]): OutcomeCounts {
  let recoveredBefore = 0;
  let recoveredAfter = 0;
  let slNotRecovered = 0;
  for (const o of occ) {
    if (o.outcome === 'RECOVERED_BEFORE_SL') recoveredBefore += 1;
    else if (o.outcome === 'RECOVERED_AFTER_SL') recoveredAfter += 1;
    else if (o.outcome === 'SL_NOT_RECOVERED') slNotRecovered += 1;
  }
  return { recoveredBefore, recoveredAfter, slNotRecovered };
}

function observations(record: RepositoryRecord, counts: OutcomeCounts, quick: QuickStats, gaps: GapStats): string[] {
  const out: string[] = [];
  const n = record.totalPositions;
  out.push(`This parameter combination appeared ${n} time${n === 1 ? '' : 's'} during uploaded history.`);
  out.push(`Recovered before Stop Loss ${counts.recoveredBefore} time${counts.recoveredBefore === 1 ? '' : 's'}.`);
  out.push(`Historical recovery before Stop Loss: ${record.recoveryBeforeSlPct.toFixed(1)}%.`);
  if (record.avgRecoverySec !== null) {
    out.push(`Average historical recovery time: ${Math.round(record.avgRecoverySec / 60)} minutes.`);
  }
  if (gaps.worst !== null) {
    out.push(`Largest historical expansion (worst maximum gap): ${gaps.worst.toFixed(2)}.`);
  }
  if (quick.mostActiveSession) {
    out.push(`Most occurrences happened during the ${quick.mostActiveSession} session.`);
  }
  out.push('Historical evidence only — this is not a prediction of future performance.');
  return out;
}

/** Builds the full read-only dossier for one repository record. */
export function buildDossier(record: RepositoryRecord): Dossier {
  const occ = record.occurrences ?? [];
  const sessions = sessionStats(occ);
  const months = monthStats(occ);
  const gaps = gapStats(occ, record);
  const quick = quickStats(occ, months, sessions);
  const counts = outcomeCounts(occ);
  return {
    counts,
    sessions,
    months,
    outcomes: outcomeStats(occ),
    histogram: recoveryHistogram(occ),
    recoveryTime: recoveryTimeStats(occ, record),
    gaps,
    quick,
    observations: observations(record, counts, quick, gaps),
  };
}

// --- export -------------------------------------------------------------------

function csvCell(v: string | number | null): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const r3 = (n: number | null) => (n === null ? '' : Math.round(n * 1000) / 1000);
const rt = (n: number | null) => (n === null ? '' : Math.round(n));

const OCC_COLUMNS = [
  'Date', 'Time', 'Session', 'Entry Gap', 'Maximum Gap', 'Recovery Gap',
  'Recovery Time (s)', 'Holding Time (s)', 'Outcome',
];

function occToRow(o: OccurrenceRecord): Array<string | number> {
  return [
    o.date, o.time, o.session, r3(o.entryGap), r3(o.maxGap), r3(o.recoveryGap),
    rt(o.recoveryTimeSec), rt(o.holdingSec), OUTCOME_LABELS[o.outcome],
  ];
}

export function dossierCsv(record: RepositoryRecord): SerializedExport {
  const lines = [OCC_COLUMNS.map(csvCell).join(',')];
  for (const o of record.occurrences ?? []) lines.push(occToRow(o).map(csvCell).join(','));
  return {
    filename: `StrategyDossier_${record.id}.csv`,
    content: lines.join('\n'),
    mime: 'text/csv',
  };
}

export function dossierJson(
  record: RepositoryRecord,
  dossier: Dossier,
  generatedAt: string,
): SerializedExport {
  const payload = {
    note: 'Read-only historical evidence for one strategy. Derived from stored Research Engine results — not a trading signal or recommendation.',
    generatedAt,
    strategy: {
      id: record.id,
      entryGap: record.entryGap,
      recoveryGap: record.recoveryGap,
      stopLoss: record.stopLoss,
    },
    summary: record,
    analytics: {
      sessions: dossier.sessions,
      months: dossier.months.filter((m) => m.occurrences > 0),
      outcomes: dossier.outcomes,
      recoveryTime: dossier.recoveryTime,
      gaps: dossier.gaps,
      quick: dossier.quick,
      observations: dossier.observations,
    },
    occurrences: record.occurrences ?? [],
  };
  return {
    filename: `StrategyDossier_${record.id}.json`,
    content: JSON.stringify(payload, null, 2),
    mime: 'application/json',
  };
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Opens a printable dossier report (save as PDF from the print dialog). */
export function printDossierPdf(
  record: RepositoryRecord,
  dossier: Dossier,
  generatedAt: string,
): void {
  const obs = dossier.observations.map((o) => `<li>${esc(o)}</li>`).join('');
  const sessRows = dossier.sessions
    .map(
      (s) =>
        `<tr><td>${esc(s.session)}</td><td>${s.occurrences}</td><td>${s.recoveryPct.toFixed(1)}%</td><td>${s.slHitPct.toFixed(1)}%</td></tr>`,
    )
    .join('');
  const occHead = `<tr>${OCC_COLUMNS.map((c) => `<th>${esc(c)}</th>`).join('')}</tr>`;
  const occBody = (record.occurrences ?? [])
    .map((o) => `<tr>${occToRow(o).map((c) => `<td>${esc(String(c))}</td>`).join('')}</tr>`)
    .join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"/>
<title>Strategy Dossier ${esc(record.id)}</title>
<style>
  body{font-family:Inter,system-ui,sans-serif;color:#0b1220;margin:24px;font-size:12px}
  h1{font-size:18px;margin:0 0 4px} h2{font-size:14px;margin:16px 0 6px}
  .note{color:#64748b;font-size:11px;margin-bottom:12px}
  ul{margin:6px 0 12px 18px} li{margin:2px 0}
  table{border-collapse:collapse;width:100%;margin-bottom:12px} th,td{border:1px solid #cbd5e1;padding:3px 6px;text-align:right;font-variant-numeric:tabular-nums}
  th{background:#f1f5f9} td:first-child,th:first-child{text-align:left}
  @media print{body{margin:0}}
</style></head><body>
<h1>Strategy Dossier — ${esc(record.id)}</h1>
<div class="note">Generated ${esc(generatedAt)}. Read-only historical evidence — not a trading signal, no recommendation.</div>
<div>Entry ${record.entryGap} · Recovery ${record.recoveryGap} · Stop Loss ${record.stopLoss}</div>
<div>Historical trades ${record.totalPositions} · Recovery before SL ${record.recoveryBeforeSlPct.toFixed(1)}% · SL hit ${record.slHitPct.toFixed(1)}% · Confidence ${esc(record.confidenceLabel)}</div>
<h2>Historical Evidence</h2><ul>${obs}</ul>
<h2>Session Distribution</h2>
<table><thead><tr><th>Session</th><th>Occurrences</th><th>Recovery %</th><th>SL Hit %</th></tr></thead><tbody>${sessRows}</tbody></table>
<h2>Occurrence Explorer</h2>
<table><thead>${occHead}</thead><tbody>${occBody}</tbody></table>
</body></html>`;

  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 250);
}
