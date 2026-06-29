/**
 * Type-safe domain models for MT5 GapMonitor CSV data.
 *
 * This application performs CSV-based statistical research only.
 * It has no broker connection and produces no trading signals.
 */

/** The exact column headers expected from a GapMonitor EA export. */
export const EXPECTED_COLUMNS = [
  'SampleID',
  'Date',
  'Time',
  'ServerTime',
  'SpotSymbol',
  'FutureSymbol',
  'SpotBid',
  'SpotAsk',
  'FutureBid',
  'FutureAsk',
  'SpotMid',
  'FutureMid',
  'Gap',
  'GapBid',
  'GapMid',
  'SpotSpread',
  'FutureSpread',
  'SpotTickTime',
  'FutureTickTime',
  'TickAgeDifferenceSec',
  'SyncStatus',
  'CurrentSession',
] as const;

export type GapColumn = (typeof EXPECTED_COLUMNS)[number];

/** Numeric columns that should parse as floats. */
export const NUMERIC_COLUMNS = [
  'SpotBid',
  'SpotAsk',
  'FutureBid',
  'FutureAsk',
  'SpotMid',
  'FutureMid',
  'Gap',
  'GapBid',
  'GapMid',
  'SpotSpread',
  'FutureSpread',
  'TickAgeDifferenceSec',
] as const satisfies readonly GapColumn[];

/**
 * A single parsed and validated GapMonitor sample.
 * `null` is used for numeric fields that were missing or unparseable.
 */
export interface GapSample {
  sampleId: string;
  date: string;
  time: string;
  serverTime: string;

  spotSymbol: string;
  futureSymbol: string;

  spotBid: number | null;
  spotAsk: number | null;
  futureBid: number | null;
  futureAsk: number | null;
  spotMid: number | null;
  futureMid: number | null;

  gap: number | null;
  gapBid: number | null;
  gapMid: number | null;

  spotSpread: number | null;
  futureSpread: number | null;

  spotTickTime: string;
  futureTickTime: string;
  tickAgeDifferenceSec: number | null;

  syncStatus: string;
  currentSession: string;

  /** Day bucket (YYYY-MM-DD) derived from ServerTime, falling back to filename / Date. */
  dayKey: string;
  /** Parsed timestamp (epoch ms) derived from ServerTime, or null if unparseable. */
  timestampMs: number | null;
  /** Source filename this sample originated from. */
  sourceFile: string;
}

/** Reasons a raw CSV row was rejected during parsing. */
export type RowRejectReason =
  | 'empty-row'
  | 'missing-sample-id'
  | 'unparseable-numeric'
  | 'no-valid-fields';

export interface InvalidRow {
  sourceFile: string;
  rowIndex: number;
  reason: RowRejectReason;
  raw: Record<string, string>;
}

/** Parse result for one CSV file. */
export interface ParsedFile {
  fileName: string;
  /** Date extracted from filename (YYYY-MM-DD) if a date pattern was found. */
  fileNameDate: string | null;
  headers: string[];
  missingColumns: GapColumn[];
  unexpectedColumns: string[];
  totalRows: number;
  validSamples: GapSample[];
  invalidRows: InvalidRow[];
  parseErrors: string[];
}

/** Combined, merged dataset across all uploaded files. */
export interface CombinedDataset {
  files: ParsedFile[];
  /** All valid samples merged and sorted by timestamp. */
  samples: GapSample[];
  /** Day-wise datasets keyed by YYYY-MM-DD, preserved separately. */
  byDay: Record<string, GapSample[]>;
  /** Sorted list of day keys present in the dataset. */
  dayKeys: string[];
}

export type AnalysisMode =
  | 'combined'
  | 'day-wise'
  | 'single-day'
  | 'custom-range';

export interface DateRange {
  start: string | null;
  end: string | null;
}

export interface AnalysisSelection {
  mode: AnalysisMode;
  /** Active day for "single-day" mode. */
  singleDay: string | null;
  /** Active bounds for "custom-range" mode (inclusive, YYYY-MM-DD). */
  customRange: DateRange;
}
