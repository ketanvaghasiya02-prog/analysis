/**
 * CSV parsing engine.
 *
 * Responsibilities:
 *  - Parse each uploaded MT5 GapMonitor CSV with PapaParse.
 *  - Map raw rows to type-safe `GapSample` models.
 *  - Detect missing / unexpected columns.
 *  - Quarantine empty or corrupt rows instead of throwing.
 *  - Merge files into a combined dataset while preserving day-wise buckets.
 */

import Papa from 'papaparse';
import {
  EXPECTED_COLUMNS,
  NUMERIC_COLUMNS,
  type CombinedDataset,
  type GapColumn,
  type GapSample,
  type InvalidRow,
  type ParsedFile,
} from '@/types/gap';
import {
  extractDateFromFilename,
  parseTimestamp,
  resolveDayKey,
} from '@/utils/date';

type RawRow = Record<string, string>;

/** Safely parse a numeric cell; returns null when blank or non-numeric. */
function toNumber(value: string | undefined): number | null {
  if (value === undefined) return null;
  const trimmed = value.trim();
  if (trimmed === '') return null;
  // Tolerate thousands separators and stray whitespace.
  const cleaned = trimmed.replace(/,/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function str(value: string | undefined): string {
  return (value ?? '').trim();
}

/** Returns true when every cell in the row is blank. */
function isEmptyRow(row: RawRow): boolean {
  return Object.values(row).every((v) => str(v) === '');
}

/**
 * Maps one raw CSV row to a GapSample. Returns either a sample or an
 * InvalidRow describing why the row was rejected.
 */
function mapRow(
  row: RawRow,
  rowIndex: number,
  fileName: string,
  fileNameDate: string | null,
): { sample: GapSample } | { invalid: InvalidRow } {
  if (isEmptyRow(row)) {
    return {
      invalid: { sourceFile: fileName, rowIndex, reason: 'empty-row', raw: row },
    };
  }

  const sampleId = str(row.SampleID);
  const serverTime = str(row.ServerTime);
  const rawDate = str(row.Date);

  // A row with no identifier and no timestamp anchor is unusable.
  if (sampleId === '' && serverTime === '' && rawDate === '') {
    return {
      invalid: {
        sourceFile: fileName,
        rowIndex,
        reason: 'missing-sample-id',
        raw: row,
      },
    };
  }

  const timestampMs = parseTimestamp(serverTime);
  const dayKey = resolveDayKey(timestampMs, fileNameDate, rawDate);

  const sample: GapSample = {
    sampleId: sampleId || `${fileName}#${rowIndex}`,
    date: rawDate,
    time: str(row.Time),
    serverTime,

    spotSymbol: str(row.SpotSymbol),
    futureSymbol: str(row.FutureSymbol),

    spotBid: toNumber(row.SpotBid),
    spotAsk: toNumber(row.SpotAsk),
    futureBid: toNumber(row.FutureBid),
    futureAsk: toNumber(row.FutureAsk),
    spotMid: toNumber(row.SpotMid),
    futureMid: toNumber(row.FutureMid),

    gap: toNumber(row.Gap),
    gapBid: toNumber(row.GapBid),
    gapMid: toNumber(row.GapMid),

    spotSpread: toNumber(row.SpotSpread),
    futureSpread: toNumber(row.FutureSpread),

    spotTickTime: str(row.SpotTickTime),
    futureTickTime: str(row.FutureTickTime),
    tickAgeDifferenceSec: toNumber(row.TickAgeDifferenceSec),

    syncStatus: str(row.SyncStatus) || 'UNKNOWN',
    currentSession: str(row.CurrentSession) || 'UNKNOWN',

    dayKey,
    timestampMs,
    sourceFile: fileName,
  };

  // Reject rows where none of the key numeric measures parsed — likely corrupt.
  const anyNumeric = NUMERIC_COLUMNS.some((c) => {
    const key = c.charAt(0).toLowerCase() + c.slice(1);
    return (sample as unknown as Record<string, number | null>)[key] !== null;
  });
  if (!anyNumeric) {
    return {
      invalid: {
        sourceFile: fileName,
        rowIndex,
        reason: 'no-valid-fields',
        raw: row,
      },
    };
  }

  return { sample };
}

/** Parses a single CSV file's text content. */
export function parseCsvText(text: string, fileName: string): ParsedFile {
  const fileNameDate = extractDateFromFilename(fileName);
  const parseErrors: string[] = [];

  const result = Papa.parse<RawRow>(text, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim(),
  });

  for (const err of result.errors) {
    parseErrors.push(
      `Row ${err.row ?? '?'}: ${err.code} — ${err.message}`,
    );
  }

  const headers = result.meta.fields ?? [];
  const headerSet = new Set(headers);
  const missingColumns = EXPECTED_COLUMNS.filter(
    (c) => !headerSet.has(c),
  ) as GapColumn[];
  const expectedSet = new Set<string>(EXPECTED_COLUMNS);
  const unexpectedColumns = headers.filter((h) => !expectedSet.has(h));

  const validSamples: GapSample[] = [];
  const invalidRows: InvalidRow[] = [];

  result.data.forEach((row, idx) => {
    const mapped = mapRow(row, idx, fileName, fileNameDate);
    if ('sample' in mapped) validSamples.push(mapped.sample);
    else invalidRows.push(mapped.invalid);
  });

  return {
    fileName,
    fileNameDate,
    headers,
    missingColumns,
    unexpectedColumns,
    totalRows: result.data.length,
    validSamples,
    invalidRows,
    parseErrors,
  };
}

/** Reads a File object as text using the FileReader API. */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('File read error'));
    reader.readAsText(file);
  });
}

/** Parses many File objects and returns their individual ParsedFile results. */
export async function parseFiles(files: File[]): Promise<ParsedFile[]> {
  const parsed = await Promise.all(
    files.map(async (file) => {
      try {
        const text = await readFileAsText(file);
        return parseCsvText(text, file.name);
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Unknown read error';
        return {
          fileName: file.name,
          fileNameDate: extractDateFromFilename(file.name),
          headers: [],
          missingColumns: [...EXPECTED_COLUMNS],
          unexpectedColumns: [],
          totalRows: 0,
          validSamples: [],
          invalidRows: [],
          parseErrors: [`Failed to read file: ${message}`],
        } satisfies ParsedFile;
      }
    }),
  );
  return parsed;
}

/**
 * Merges parsed files into a combined dataset:
 *  - one flat, timestamp-sorted list of valid samples
 *  - day-wise buckets preserved separately
 */
export function mergeDataset(files: ParsedFile[]): CombinedDataset {
  const samples = files.flatMap((f) => f.validSamples);

  samples.sort((a, b) => {
    const at = a.timestampMs ?? Number.POSITIVE_INFINITY;
    const bt = b.timestampMs ?? Number.POSITIVE_INFINITY;
    if (at !== bt) return at - bt;
    return a.sampleId.localeCompare(b.sampleId);
  });

  const byDay: Record<string, GapSample[]> = {};
  for (const s of samples) {
    (byDay[s.dayKey] ??= []).push(s);
  }

  const dayKeys = Object.keys(byDay).sort();

  return { files, samples, byDay, dayKeys };
}
