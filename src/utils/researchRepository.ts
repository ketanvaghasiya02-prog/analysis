/**
 * Research Repository (Phase 11C) — centralized historical research storage.
 *
 * Stores every COMPLETED strategy result produced by the Historical Strategy
 * Finder so future modules (ranking, reports, replay, AI) can READ results
 * instead of rerunning the frozen Research Engine. This file is pure: record
 * construction, de-duplication keys, indexes, search / filter / sort, summary
 * and serialisation. No engine is called, nothing is ranked or scored.
 */

import type { ConfidenceLevel } from '@/utils/scenario';
import type { StrategyResearchResult } from '@/utils/strategyExecution';
import type { SerializedExport } from '@/utils/reports';

const CONFIDENCE_ORDER: ConfidenceLevel[] = [
  'VERY_LOW',
  'LOW',
  'MEDIUM',
  'HIGH',
  'VERY_HIGH',
];

/** A single stored research record. */
export interface RepositoryRecord {
  /** Stable de-duplication key (Entry/Recovery/SL/SameDay/DateRange/Session). */
  key: string;
  /** Strategy ID captured at ingest time. */
  id: string;
  entryGap: number;
  recoveryGap: number;
  stopLoss: number;
  recoveryBeforeSlPct: number;
  recoveryAfterSlPct: number;
  recoveryIgnoringSlPct: number;
  slHitPct: number;
  totalPositions: number;
  historicalTrades: number;
  avgRecoverySec: number | null;
  medianRecoverySec: number | null;
  avgMaxGap: number | null;
  worstMaxGap: number | null;
  p95MaxGap: number | null;
  p99MaxGap: number | null;
  avgHoldingSec: number | null;
  confidenceLevel: ConfidenceLevel;
  confidenceLabel: string;
  executionMs: number;
  /** Epoch ms when first stored in the repository. */
  createdAt: number;
  // Research context (kept for an exact strategy identity + future modules).
  sameDayOnly: boolean;
  dateFrom: string;
  dateTo: string;
  sessions: string[];
}

/** What the Strategy Finder hands to the repository for one completed result. */
export interface RepositoryIngestItem {
  id: string;
  result: StrategyResearchResult;
  sameDayOnly: boolean;
  dateFrom: string;
  dateTo: string;
  sessions: string[];
}

/** Builds the stable de-duplication key for a strategy. */
export function repositoryKey(item: {
  result: Pick<StrategyResearchResult, 'entryGap' | 'recoveryGap' | 'stopLoss'>;
  sameDayOnly: boolean;
  dateFrom: string;
  dateTo: string;
  sessions: string[];
}): string {
  const sessions = [...item.sessions].sort().join(',');
  return [
    item.result.entryGap,
    item.result.recoveryGap,
    item.result.stopLoss,
    item.sameDayOnly ? 1 : 0,
    item.dateFrom,
    item.dateTo,
    sessions,
  ].join('|');
}

/** Constructs a stored record from an ingest item. */
export function toRepositoryRecord(
  item: RepositoryIngestItem,
  createdAt: number,
): RepositoryRecord {
  const r = item.result;
  return {
    key: repositoryKey(item),
    id: item.id,
    entryGap: r.entryGap,
    recoveryGap: r.recoveryGap,
    stopLoss: r.stopLoss,
    recoveryBeforeSlPct: r.recoveryBeforeSlPct,
    recoveryAfterSlPct: r.recoveryAfterSlPct,
    recoveryIgnoringSlPct: r.recoveryIgnoringSlPct,
    slHitPct: r.slHitPct,
    totalPositions: r.totalPositions,
    historicalTrades: r.totalPositions,
    avgRecoverySec: r.avgRecoverySec,
    medianRecoverySec: r.medianRecoverySec,
    avgMaxGap: r.avgMaxGap,
    worstMaxGap: r.worstMaxGap,
    p95MaxGap: r.p95MaxGap,
    p99MaxGap: r.p99MaxGap,
    avgHoldingSec: r.avgHoldingSec,
    confidenceLevel: r.confidenceLevel,
    confidenceLabel: r.confidenceLabel,
    executionMs: r.executionMs,
    createdAt,
    sameDayOnly: item.sameDayOnly,
    dateFrom: item.dateFrom,
    dateTo: item.dateTo,
    sessions: item.sessions,
  };
}

// --- search / filter ----------------------------------------------------------

export type FilterField =
  | 'entryGap'
  | 'recoveryGap'
  | 'stopLoss'
  | 'recoveryBeforeSlPct'
  | 'slHitPct'
  | 'historicalTrades'
  | 'avgHoldingMin'
  | 'worstMaxGap'
  | 'executionMs'
  | 'confidence';

export type FilterOp = 'gt' | 'lt' | 'eq' | 'between';

export interface RepositoryFilter {
  id: number;
  field: FilterField;
  op: FilterOp;
  value: number;
  value2: number; // for "between"
  confidence: ConfidenceLevel; // for the confidence field
}

export const NUMERIC_FILTER_FIELDS: Array<{ field: FilterField; label: string }> = [
  { field: 'entryGap', label: 'Entry Gap' },
  { field: 'recoveryGap', label: 'Recovery Gap' },
  { field: 'stopLoss', label: 'Stop Loss' },
  { field: 'recoveryBeforeSlPct', label: 'Recovery %' },
  { field: 'slHitPct', label: 'SL Hit %' },
  { field: 'historicalTrades', label: 'Historical Trades' },
  { field: 'avgHoldingMin', label: 'Avg Holding (min)' },
  { field: 'worstMaxGap', label: 'Worst Gap' },
  { field: 'executionMs', label: 'Execution Time (ms)' },
];

/** Reads the numeric value for a filter field from a record (null if absent). */
function numericValue(rec: RepositoryRecord, field: FilterField): number | null {
  switch (field) {
    case 'entryGap':
      return rec.entryGap;
    case 'recoveryGap':
      return rec.recoveryGap;
    case 'stopLoss':
      return rec.stopLoss;
    case 'recoveryBeforeSlPct':
      return rec.recoveryBeforeSlPct;
    case 'slHitPct':
      return rec.slHitPct;
    case 'historicalTrades':
      return rec.historicalTrades;
    case 'avgHoldingMin':
      return rec.avgHoldingSec === null ? null : rec.avgHoldingSec / 60;
    case 'worstMaxGap':
      return rec.worstMaxGap;
    case 'executionMs':
      return rec.executionMs;
    case 'confidence':
      return CONFIDENCE_ORDER.indexOf(rec.confidenceLevel);
  }
}

function matchesFilter(rec: RepositoryRecord, f: RepositoryFilter): boolean {
  if (f.field === 'confidence') {
    return rec.confidenceLevel === f.confidence;
  }
  const v = numericValue(rec, f.field);
  if (v === null) return false;
  const eps = 1e-9;
  switch (f.op) {
    case 'gt':
      return v > f.value;
    case 'lt':
      return v < f.value;
    case 'eq':
      return Math.abs(v - f.value) < 1e-6;
    case 'between': {
      const lo = Math.min(f.value, f.value2);
      const hi = Math.max(f.value, f.value2);
      return v >= lo - eps && v <= hi + eps;
    }
  }
}

/** Applies all filters (AND) to the records. */
export function applyFilters(
  records: RepositoryRecord[],
  filters: RepositoryFilter[],
): RepositoryRecord[] {
  if (filters.length === 0) return records;
  return records.filter((rec) => filters.every((f) => matchesFilter(rec, f)));
}

// --- sorting ------------------------------------------------------------------

export type SortKey =
  | 'recoveryBeforeSlPct'
  | 'confidence'
  | 'historicalTrades'
  | 'avgHoldingSec'
  | 'worstMaxGap'
  | 'executionMs'
  | 'createdAt';

export const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: 'recoveryBeforeSlPct', label: 'Recovery %' },
  { key: 'confidence', label: 'Confidence' },
  { key: 'historicalTrades', label: 'Historical Trades' },
  { key: 'avgHoldingSec', label: 'Holding Time' },
  { key: 'worstMaxGap', label: 'Worst Gap' },
  { key: 'executionMs', label: 'Execution Time' },
  { key: 'createdAt', label: 'Date Added' },
];

function sortValue(rec: RepositoryRecord, key: SortKey): number {
  switch (key) {
    case 'confidence':
      return CONFIDENCE_ORDER.indexOf(rec.confidenceLevel);
    case 'avgHoldingSec':
      return rec.avgHoldingSec ?? -Infinity;
    case 'worstMaxGap':
      return rec.worstMaxGap ?? -Infinity;
    default:
      return rec[key];
  }
}

export function sortRecords(
  records: RepositoryRecord[],
  key: SortKey,
  desc: boolean,
): RepositoryRecord[] {
  const out = [...records];
  out.sort((a, b) => {
    const av = sortValue(a, key);
    const bv = sortValue(b, key);
    return desc ? bv - av : av - bv;
  });
  return out;
}

// --- indexes + summary --------------------------------------------------------

export interface RepositoryIndexes {
  byConfidence: Map<ConfidenceLevel, RepositoryRecord[]>;
  entryGaps: number[];
  recoveryGaps: number[];
  stopLosses: number[];
}

/** Builds lookup indexes over the indexed fields. */
export function buildRepositoryIndexes(records: RepositoryRecord[]): RepositoryIndexes {
  const byConfidence = new Map<ConfidenceLevel, RepositoryRecord[]>();
  const entries = new Set<number>();
  const recoveries = new Set<number>();
  const stopLosses = new Set<number>();
  for (const r of records) {
    const list = byConfidence.get(r.confidenceLevel);
    if (list) list.push(r);
    else byConfidence.set(r.confidenceLevel, [r]);
    entries.add(r.entryGap);
    recoveries.add(r.recoveryGap);
    stopLosses.add(r.stopLoss);
  }
  return {
    byConfidence,
    entryGaps: [...entries].sort((a, b) => a - b),
    recoveryGaps: [...recoveries].sort((a, b) => a - b),
    stopLosses: [...stopLosses].sort((a, b) => a - b),
  };
}

export interface RepositorySummary {
  size: number;
  completed: number;
  uniqueEntries: number;
  uniqueRecoveries: number;
  uniqueStopLosses: number;
}

export function repositorySummary(records: RepositoryRecord[]): RepositorySummary {
  const idx = buildRepositoryIndexes(records);
  return {
    size: records.length,
    completed: records.length,
    uniqueEntries: idx.entryGaps.length,
    uniqueRecoveries: idx.recoveryGaps.length,
    uniqueStopLosses: idx.stopLosses.length,
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
  'Strategy ID', 'Entry Gap', 'Recovery Gap', 'Stop Loss',
  'Recovery Before %', 'Recovery After %', 'Recovery Ignoring %', 'SL Hit %',
  'Total Positions', 'Historical Trades', 'Avg Recovery (s)', 'Median Recovery (s)',
  'Avg Max Gap', 'Worst Max Gap', 'P95 Gap', 'P99 Gap', 'Avg Holding (s)',
  'Confidence', 'Execution Time (ms)', 'Created',
];

function rowToCsv(r: RepositoryRecord): Array<string | number> {
  return [
    r.id, r3(r.entryGap), r3(r.recoveryGap), r3(r.stopLoss),
    r1(r.recoveryBeforeSlPct), r1(r.recoveryAfterSlPct), r1(r.recoveryIgnoringSlPct), r1(r.slHitPct),
    r.totalPositions, r.historicalTrades, rt(r.avgRecoverySec), rt(r.medianRecoverySec),
    r3(r.avgMaxGap), r3(r.worstMaxGap), r3(r.p95MaxGap), r3(r.p99MaxGap), rt(r.avgHoldingSec),
    r.confidenceLabel, Math.round(r.executionMs), new Date(r.createdAt).toISOString(),
  ];
}

export function repositoryCsv(records: RepositoryRecord[]): SerializedExport {
  const lines = [CSV_COLUMNS.map(csvCell).join(',')];
  for (const r of records) lines.push(rowToCsv(r).map(csvCell).join(','));
  return { filename: 'ResearchRepository.csv', content: lines.join('\n'), mime: 'text/csv' };
}

export function repositoryJson(
  records: RepositoryRecord[],
  generatedAt: string,
): SerializedExport {
  const payload = {
    note: 'Historical research repository. Stored Research Engine v1.0 results only — not a trading signal, no ranking or recommendation.',
    generatedAt,
    count: records.length,
    records,
  };
  return {
    filename: 'ResearchRepository.json',
    content: JSON.stringify(payload, null, 2),
    mime: 'application/json',
  };
}

/** Full backup, including provenance, for restore by future modules. */
export function repositoryBackup(
  records: RepositoryRecord[],
  createdAt: number | null,
  updatedAt: number | null,
  generatedAt: string,
): SerializedExport {
  const payload = {
    kind: 'gap-research-repository-backup',
    version: 1,
    generatedAt,
    createdAt: createdAt ? new Date(createdAt).toISOString() : null,
    updatedAt: updatedAt ? new Date(updatedAt).toISOString() : null,
    count: records.length,
    records,
  };
  return {
    filename: 'ResearchRepository.backup.json',
    content: JSON.stringify(payload, null, 2),
    mime: 'application/json',
  };
}
