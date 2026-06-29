/**
 * Exportable reports (Phase R11).
 *
 * Aggregates the analysis engines into structured reports and serialises them
 * to CSV, JSON or printable HTML. Every report is built from the already
 * filtered sample set / zones / events, so it inherently respects the active
 * analysis mode (combined / day-wise / single day / custom range) and the
 * global session, sync, date and gap filters.
 *
 * Pure data assembly + serialisation; the browser download helper is the only
 * side-effecting function.
 */

import type { GapSample } from '@/types/gap';
import type { GapZone } from '@/utils/histogram';
import type { ZoneEvent } from '@/utils/events';
import type { FilterState } from '@/types/gap';
import { buildRecoveryAnalysis, type RecoverySettings } from '@/utils/recovery';
import { buildMaeAnalysis } from '@/utils/mae';
import {
  buildSurvivalCurve,
  suggestedStopLosses,
  type StopLossSettings,
} from '@/utils/stoploss';
import { buildFailedAnalysis, POST_RECOVERY_LABELS } from '@/utils/failed';
import { computeDayStats } from '@/utils/dayAnalysis';
import { buildSessionAnalysis } from '@/utils/sessions';
import { gapSummary, syncQualityPct } from '@/utils/statistics';

export type ReportId =
  | 'gap-zone-recovery'
  | 'stop-loss-survival'
  | 'failed-events'
  | 'day-wise'
  | 'session'
  | 'full-summary';

export const REPORT_TITLES: Record<ReportId, string> = {
  'gap-zone-recovery': 'Gap Zone Recovery Report',
  'stop-loss-survival': 'Stop-Loss Survival Report',
  'failed-events': 'Failed Events Report',
  'day-wise': 'Day-wise Analysis Report',
  session: 'Session Analysis Report',
  'full-summary': 'Full Research Summary',
};

export const ALL_REPORT_IDS: ReportId[] = [
  'gap-zone-recovery',
  'stop-loss-survival',
  'failed-events',
  'day-wise',
  'session',
  'full-summary',
];

export type ExportFormat = 'csv' | 'json' | 'html';

export interface ReportMeta {
  title: string;
  generatedAt: string;
  analysisMode: string;
  dateRange: { start: string | null; end: string | null };
  files: string[];
  sampleCount: number;
  filters: {
    sessions: string[];
    syncStatuses: string[];
    symbolPairs: string[];
    gapMin: number | null;
    gapMax: number | null;
    dateStart: string | null;
    dateEnd: string | null;
  };
}

export interface ReportTable {
  name: string;
  columns: string[];
  rows: Array<Array<string | number | null>>;
}

export interface Report {
  id: ReportId;
  title: string;
  meta: ReportMeta;
  tables: ReportTable[];
}

export interface ReportInput {
  samples: GapSample[];
  zones: GapZone[];
  events: ZoneEvent[];
  recoverySettings: RecoverySettings;
  slSettings: StopLossSettings;
  fileNames: string[];
  dateRange: { start: string | null; end: string | null };
  analysisMode: string;
  filters: FilterState;
  generatedAt: string;
}

// --- rounding helpers ---------------------------------------------------------

const r1 = (n: number | null): number | null =>
  n === null || Number.isNaN(n) ? null : Math.round(n * 10) / 10;
const r3 = (n: number | null): number | null =>
  n === null || Number.isNaN(n) ? null : Math.round(n * 1000) / 1000;
const rt = (sec: number | null): number | null =>
  sec === null || Number.isNaN(sec) ? null : Math.round(sec);

function zoneRefLabel(
  z: { label: string; recoveryPct: number } | null,
): string {
  return z ? `${z.label} (${r1(z.recoveryPct)}%)` : '—';
}

// --- per-report table builders -----------------------------------------------

function overviewTable(samples: GapSample[], zones: GapZone[], events: ZoneEvent[]): ReportTable {
  const g = gapSummary(samples);
  const sync = syncQualityPct(samples);
  return {
    name: 'Dataset Overview',
    columns: ['Metric', 'Value'],
    rows: [
      ['Samples in view', samples.length],
      ['Gap zones', zones.length],
      ['Zone events', events.length],
      ['Average gap', r3(g.mean)],
      ['Median gap', r3(g.median)],
      ['Max gap', r3(g.max)],
      ['Min gap', r3(g.min)],
      ['Gap std dev', r3(g.stdDev)],
      ['Sync quality %', r1(sync)],
    ],
  };
}

function zoneRecoveryTables(
  samples: GapSample[],
  zones: GapZone[],
  events: ZoneEvent[],
  settings: RecoverySettings,
): ReportTable[] {
  const analysis = buildRecoveryAnalysis(samples, zones, events, settings);
  const summary: ReportTable = {
    name: 'Zone Recovery Summary',
    columns: [
      'Zone', 'Total Events', 'Recovered to Low', 'Recovery %',
      'Avg Distance', 'Median Distance', 'Max Distance',
      'Avg Time (s)', 'Median Time (s)', 'Max Time (s)', 'Meets Min Events',
    ],
    rows: analysis.zones.map((z) => [
      z.label, z.totalEvents, z.recoveredToLow, r1(z.recoveryProbabilityPct),
      r3(z.avgDistance), r3(z.medianDistance), r3(z.maxDistance),
      rt(z.avgTimeSec), rt(z.medianTimeSec), rt(z.maxTimeSec),
      z.meetsMinEvents ? 'yes' : 'no',
    ]),
  };
  const matrix: ReportTable = {
    name: 'Recovery Target Matrix',
    columns: ['Zone', 'Target Gap', 'Recovered', 'Recovery %', 'Avg Time (s)', 'Median Time (s)', 'Max Time (s)'],
    rows: analysis.zones.flatMap((z) =>
      z.targets.map((t) => [
        z.label, r3(t.target), t.recovered, r1(t.recoveryPct),
        rt(t.avgTimeSec), rt(t.medianTimeSec), rt(t.maxTimeSec),
      ]),
    ),
  };
  return [summary, matrix];
}

function stopLossTables(
  samples: GapSample[],
  zones: GapZone[],
  events: ZoneEvent[],
  slSettings: StopLossSettings,
): ReportTable[] {
  const mae = buildMaeAnalysis(samples, zones, events);
  const suggested: ReportTable = {
    name: 'Suggested SL Levels',
    columns: ['Zone', 'Style', 'Basis', 'SL Level', 'Recovered Survived %', 'Recovered Stopped %', 'Failed Cut %', 'Overall Recovery %', 'Stop Efficiency'],
    rows: mae.zones.flatMap((z) =>
      suggestedStopLosses(z).map((s) => [
        z.label, s.label, s.basis, r3(s.slLevel),
        s.row ? r1(s.row.recoveredSurvivedPct) : null,
        s.row ? r1(s.row.recoveredStoppedPct) : null,
        s.row ? r1(s.row.failedCutPct) : null,
        s.row ? r1(s.row.overallRecoveryPct) : null,
        s.row ? r1(s.row.stopEfficiency) : null,
      ]),
    ),
  };
  const sweep: ReportTable = {
    name: 'Survival Sweep',
    columns: ['Zone', 'SL Level', 'Rec Survived %', 'Rec Stopped %', 'Failed Cut %', 'Failed Not Cut %', 'Overall Recovery %', 'Expected Failure %', 'Stop Efficiency'],
    rows: mae.zones.flatMap((z) =>
      buildSurvivalCurve(z, slSettings).rows.map((row) => [
        z.label, r3(row.slLevel), r1(row.recoveredSurvivedPct), r1(row.recoveredStoppedPct),
        r1(row.failedCutPct), r1(row.failedNotCutPct), r1(row.overallRecoveryPct),
        r1(row.expectedFailurePct), r1(row.stopEfficiency),
      ]),
    ),
  };
  return [suggested, sweep];
}

function failedTables(
  samples: GapSample[],
  zones: GapZone[],
  events: ZoneEvent[],
): ReportTable[] {
  const analysis = buildFailedAnalysis(samples, zones, events);
  const summary: ReportTable = {
    name: 'Failed Zone Summary',
    columns: ['Zone', 'Total Events', 'Failed', 'Failed %', 'Avg Max Gap', 'Median', 'P90', 'P95', 'P99', 'Worst'],
    rows: analysis.zones.map((z) => [
      z.label, z.totalEvents, z.failedCount, r1(z.failedPct),
      r3(z.maxGapStats.avg), r3(z.maxGapStats.median), r3(z.maxGapStats.p90),
      r3(z.maxGapStats.p95), r3(z.maxGapStats.p99), r3(z.maxGapStats.worst),
    ]),
  };
  const postRec: ReportTable = {
    name: 'Recovery After Failure',
    columns: ['Zone', POST_RECOVERY_LABELS['same-day'], POST_RECOVERY_LABELS['next-day'], POST_RECOVERY_LABELS['within-2-days'], POST_RECOVERY_LABELS.later, POST_RECOVERY_LABELS.never],
    rows: analysis.zones.map((z) => [
      z.label, z.postRecoveryCounts['same-day'], z.postRecoveryCounts['next-day'],
      z.postRecoveryCounts['within-2-days'], z.postRecoveryCounts.later, z.postRecoveryCounts.never,
    ]),
  };
  const list: ReportTable = {
    name: 'Failed Events',
    columns: ['Event ID', 'Zone', 'Date', 'Entry Time', 'Entry Gap', 'Max Gap', 'Adverse Exp', 'Session', 'Sync', 'Recovered After', 'Recovery Date', 'Days To Recovery'],
    rows: analysis.zones.flatMap((z) =>
      z.events.map((e) => [
        e.eventId, z.label, e.date, e.entryTime, r3(e.entryGap), r3(e.maxGap),
        r3(e.adverseExpansion), e.session, e.syncStatus,
        POST_RECOVERY_LABELS[e.postRecovery], e.recoveryDate, e.daysToRecovery,
      ]),
    ),
  };
  return [summary, postRec, list];
}

function dayWiseTables(samples: GapSample[]): ReportTable[] {
  const stats = computeDayStats(samples);
  return [
    {
      name: 'Day-wise Analysis',
      columns: ['Date', 'Samples', 'Avg Gap', 'Median', 'Max', 'Min', 'Range', 'Std Dev', 'Sync %', 'Most Common Session'],
      rows: stats.map((d) => [
        d.day, d.samples, r3(d.avgGap), r3(d.medianGap), r3(d.maxGap), r3(d.minGap),
        r3(d.range), r3(d.stdDev), r1(d.syncQualityPct), d.mostCommonSession,
      ]),
    },
  ];
}

function sessionTables(
  samples: GapSample[],
  zones: GapZone[],
  events: ZoneEvent[],
): ReportTable[] {
  const analysis = buildSessionAnalysis(samples, zones, events);
  const summary: ReportTable = {
    name: 'Session Summary',
    columns: ['Session', 'Samples', 'Events', 'Recovery %', 'Avg Rec Time (s)', 'Median Rec Time (s)', 'Worst Max Gap', 'Avg MAE', 'Failed', 'Sync %', 'Best Zone', 'Worst Zone'],
    rows: analysis.sessions.map((s) => [
      s.session, s.samples, s.events, r1(s.recoveryPct), rt(s.avgRecoveryTimeSec),
      rt(s.medianRecoveryTimeSec), r3(s.worstMaxGap), r3(s.avgMae), s.failed,
      r1(s.syncQualityPct), zoneRefLabel(s.bestZone), zoneRefLabel(s.worstZone),
    ]),
  };
  const zoneBy: ReportTable = {
    name: 'Zone by Session',
    columns: ['Session', 'Zone', 'Events', 'Recovered', 'Recovery %', 'Worst Max Gap'],
    rows: analysis.sessions.flatMap((s) =>
      s.zones.map((z) => [
        s.session, z.label, z.events, z.recovered, r1(z.recoveryPct), r3(z.worstMaxGap),
      ]),
    ),
  };
  return [summary, zoneBy];
}

// --- report assembly ----------------------------------------------------------

function makeMeta(input: ReportInput, title: string): ReportMeta {
  return {
    title,
    generatedAt: input.generatedAt,
    analysisMode: input.analysisMode,
    dateRange: input.dateRange,
    files: input.fileNames,
    sampleCount: input.samples.length,
    filters: {
      sessions: input.filters.sessions,
      syncStatuses: input.filters.syncStatuses,
      symbolPairs: input.filters.symbolPairs,
      gapMin: input.filters.gapMin,
      gapMax: input.filters.gapMax,
      dateStart: input.filters.dateRange.start,
      dateEnd: input.filters.dateRange.end,
    },
  };
}

/** Builds a single report by id. */
export function buildReport(id: ReportId, input: ReportInput): Report {
  const { samples, zones, events, recoverySettings, slSettings } = input;
  const meta = makeMeta(input, REPORT_TITLES[id]);

  let tables: ReportTable[];
  switch (id) {
    case 'gap-zone-recovery':
      tables = zoneRecoveryTables(samples, zones, events, recoverySettings);
      break;
    case 'stop-loss-survival':
      tables = stopLossTables(samples, zones, events, slSettings);
      break;
    case 'failed-events':
      tables = failedTables(samples, zones, events);
      break;
    case 'day-wise':
      tables = dayWiseTables(samples);
      break;
    case 'session':
      tables = sessionTables(samples, zones, events);
      break;
    case 'full-summary':
      tables = [
        overviewTable(samples, zones, events),
        ...dayWiseTables(samples),
        zoneRecoveryTables(samples, zones, events, recoverySettings)[0]!,
        ...sessionTables(samples, zones, events),
        failedTables(samples, zones, events)[0]!,
        stopLossTables(samples, zones, events, slSettings)[0]!,
      ];
      break;
    default:
      tables = [];
  }
  return { id, title: REPORT_TITLES[id], meta, tables };
}

/** Builds every report. */
export function buildAllReports(input: ReportInput): Report[] {
  return ALL_REPORT_IDS.filter((id) => id !== 'full-summary')
    .map((id) => buildReport(id, input))
    .concat(buildReport('full-summary', input));
}

// --- serialisers --------------------------------------------------------------

function csvCell(v: string | number | null): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function metaLines(meta: ReportMeta, prefix = '# '): string[] {
  const f = meta.filters;
  const filterParts: string[] = [];
  if (f.sessions.length) filterParts.push(`sessions=${f.sessions.join('|')}`);
  if (f.syncStatuses.length) filterParts.push(`sync=${f.syncStatuses.join('|')}`);
  if (f.symbolPairs.length) filterParts.push(`pairs=${f.symbolPairs.join('|')}`);
  if (f.gapMin !== null) filterParts.push(`gapMin=${f.gapMin}`);
  if (f.gapMax !== null) filterParts.push(`gapMax=${f.gapMax}`);
  if (f.dateStart) filterParts.push(`from=${f.dateStart}`);
  if (f.dateEnd) filterParts.push(`to=${f.dateEnd}`);
  return [
    `${prefix}${meta.title}`,
    `${prefix}Generated: ${meta.generatedAt}`,
    `${prefix}Analysis mode: ${meta.analysisMode}`,
    `${prefix}Date range: ${meta.dateRange.start ?? '—'} .. ${meta.dateRange.end ?? '—'}`,
    `${prefix}Files: ${meta.files.join('; ') || '—'}`,
    `${prefix}Samples in view: ${meta.sampleCount}`,
    `${prefix}Active filters: ${filterParts.join(', ') || 'none'}`,
  ];
}

function serializeCSV(reports: Report[]): string {
  const out: string[] = [];
  for (const report of reports) {
    out.push(...metaLines(report.meta));
    out.push('');
    for (const table of report.tables) {
      out.push(csvCell(table.name));
      out.push(table.columns.map(csvCell).join(','));
      for (const row of table.rows) out.push(row.map(csvCell).join(','));
      out.push('');
    }
    out.push('');
  }
  return out.join('\n');
}

function serializeJSON(reports: Report[]): string {
  return JSON.stringify(reports.length === 1 ? reports[0] : reports, null, 2);
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function tableHTML(table: ReportTable): string {
  const head = table.columns.map((c) => `<th>${esc(c)}</th>`).join('');
  const body = table.rows
    .map(
      (row) =>
        `<tr>${row
          .map((c) => `<td>${c === null || c === undefined ? '' : esc(String(c))}</td>`)
          .join('')}</tr>`,
    )
    .join('');
  return `<h3>${esc(table.name)}</h3><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function reportHTML(report: Report): string {
  const m = report.meta;
  const meta = metaLines(m, '')
    .map((line) => `<div>${esc(line)}</div>`)
    .join('');
  const tables = report.tables.map(tableHTML).join('');
  return `<section class="report"><h2>${esc(report.title)}</h2><div class="meta">${meta}</div>${tables}</section>`;
}

function serializeHTML(reports: Report[], bundleTitle: string): string {
  const body = reports.map(reportHTML).join('<hr/>');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<title>${esc(bundleTitle)}</title>
<style>
  body{font-family:Inter,system-ui,sans-serif;background:#fff;color:#0b1220;margin:24px;font-size:13px}
  h1{font-size:20px;margin:0 0 4px} h2{font-size:16px;margin:18px 0 6px}
  h3{font-size:13px;text-transform:uppercase;letter-spacing:.04em;color:#475569;margin:16px 0 6px}
  .note{color:#64748b;font-size:12px;margin-bottom:16px}
  .meta{color:#475569;font-size:11px;margin:6px 0 10px;line-height:1.5}
  table{border-collapse:collapse;width:100%;margin-bottom:8px}
  th,td{border:1px solid #cbd5e1;padding:4px 8px;text-align:left;font-variant-numeric:tabular-nums}
  th{background:#f1f5f9;font-weight:600} tr:nth-child(even) td{background:#f8fafc}
  hr{border:none;border-top:2px solid #e2e8f0;margin:24px 0}
  @media print{body{margin:0}}
</style></head><body>
<h1>${esc(bundleTitle)}</h1>
<div class="note">MT5 Gap Monitor — CSV statistical research. Research only; not a trading application.</div>
${body}
</body></html>`;
}

// --- download -----------------------------------------------------------------

function sanitize(s: string): string {
  return s.replace(/[^a-z0-9_-]+/gi, '_').replace(/^_+|_+$/g, '');
}

export interface SerializedExport {
  filename: string;
  content: string;
  mime: string;
}

/** Serialises one or more reports to the requested format. */
export function serializeReports(
  reports: Report[],
  format: ExportFormat,
  dateRange: { start: string | null; end: string | null },
): SerializedExport {
  const dateLabel =
    dateRange.start && dateRange.end
      ? dateRange.start === dateRange.end
        ? dateRange.start
        : `${dateRange.start}_to_${dateRange.end}`
      : 'export';

  const base =
    reports.length === 1
      ? sanitize(reports[0]!.title)
      : 'MT5GapResearch_AllReports';
  const filename = `${base}_${dateLabel}.${format}`;

  let content: string;
  let mime: string;
  if (format === 'json') {
    content = serializeJSON(reports);
    mime = 'application/json';
  } else if (format === 'html') {
    const bundleTitle =
      reports.length === 1 ? reports[0]!.title : 'MT5 Gap Monitor — Research Export';
    content = serializeHTML(reports, bundleTitle);
    mime = 'text/html';
  } else {
    content = serializeCSV(reports);
    mime = 'text/csv';
  }
  return { filename, content, mime };
}

/** Triggers a browser download of serialised report content. */
export function downloadExport(exported: SerializedExport): void {
  const blob = new Blob([exported.content], {
    type: `${exported.mime};charset=utf-8`,
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = exported.filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Release the object URL on the next tick.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
