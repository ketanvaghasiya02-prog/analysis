/**
 * Validation engine.
 *
 * Produces a consolidated validation report over a combined dataset:
 * file count, row tallies, missing columns, duplicate timestamps,
 * SyncStatus distribution and the detected date range.
 */

import type { CombinedDataset, GapColumn, ParsedFile } from '@/types/gap';
import { syncStatusCounts } from '@/utils/statistics';

export interface FileValidation {
  fileName: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  missingColumns: GapColumn[];
  fileNameDate: string | null;
  parseErrors: string[];
}

export interface DuplicateGroup {
  /** Identity key: serverTime + symbol pair. */
  key: string;
  serverTime: string;
  count: number;
  sourceFiles: string[];
}

export interface ValidationReport {
  filesUploaded: number;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  /** Columns missing from at least one file, deduplicated. */
  missingColumns: GapColumn[];
  /** Per-file missing-column breakdown. */
  perFile: FileValidation[];
  duplicateTimestampGroups: DuplicateGroup[];
  duplicateTimestampCount: number;
  syncStatusCounts: Record<string, number>;
  dateRange: { start: string | null; end: string | null };
  totalParseErrors: number;
}

function buildFileValidation(file: ParsedFile): FileValidation {
  return {
    fileName: file.fileName,
    totalRows: file.totalRows,
    validRows: file.validSamples.length,
    invalidRows: file.invalidRows.length,
    missingColumns: file.missingColumns,
    fileNameDate: file.fileNameDate,
    parseErrors: file.parseErrors,
  };
}

/** Builds the full validation report for a combined dataset. */
export function buildValidationReport(
  dataset: CombinedDataset,
): ValidationReport {
  const { files, samples, dayKeys } = dataset;

  const perFile = files.map(buildFileValidation);

  const totalRows = files.reduce((acc, f) => acc + f.totalRows, 0);
  const validRows = samples.length;
  const invalidRows = files.reduce((acc, f) => acc + f.invalidRows.length, 0);

  const missingSet = new Set<GapColumn>();
  for (const f of files) for (const c of f.missingColumns) missingSet.add(c);

  // Duplicate timestamps: identical ServerTime within the same symbol pair.
  const seen = new Map<string, { count: number; files: Set<string>; serverTime: string }>();
  for (const s of samples) {
    if (!s.serverTime) continue;
    const key = `${s.serverTime}|${s.spotSymbol}|${s.futureSymbol}`;
    const entry = seen.get(key);
    if (entry) {
      entry.count += 1;
      entry.files.add(s.sourceFile);
    } else {
      seen.set(key, { count: 1, files: new Set([s.sourceFile]), serverTime: s.serverTime });
    }
  }
  const duplicateTimestampGroups: DuplicateGroup[] = [];
  let duplicateTimestampCount = 0;
  for (const [key, entry] of seen) {
    if (entry.count > 1) {
      duplicateTimestampGroups.push({
        key,
        serverTime: entry.serverTime,
        count: entry.count,
        sourceFiles: [...entry.files],
      });
      duplicateTimestampCount += entry.count - 1;
    }
  }
  duplicateTimestampGroups.sort((a, b) => b.count - a.count);

  const realDays = dayKeys.filter((d) => d !== 'unknown');
  const dateRange = {
    start: realDays.length > 0 ? (realDays[0] as string) : null,
    end: realDays.length > 0 ? (realDays[realDays.length - 1] as string) : null,
  };

  return {
    filesUploaded: files.length,
    totalRows,
    validRows,
    invalidRows,
    missingColumns: [...missingSet],
    perFile,
    duplicateTimestampGroups,
    duplicateTimestampCount,
    syncStatusCounts: syncStatusCounts(samples),
    dateRange,
    totalParseErrors: files.reduce((acc, f) => acc + f.parseErrors.length, 0),
  };
}
