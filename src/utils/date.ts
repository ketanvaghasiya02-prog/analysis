/**
 * Date / time helpers for normalising heterogeneous MT5 timestamp formats.
 */

/** Matches YYYYMMDD or YYYY-MM-DD or YYYY_MM_DD inside a filename. */
const FILENAME_DATE_RE = /(\d{4})[-_]?(\d{2})[-_]?(\d{2})/;

/**
 * Extracts a YYYY-MM-DD date from a filename such as
 * "GapMonitor_Main_20260601.csv" → "2026-06-01".
 * Returns null when no plausible date token is present.
 */
export function extractDateFromFilename(fileName: string): string | null {
  const match = FILENAME_DATE_RE.exec(fileName);
  if (!match) return null;
  const [, y, m, d] = match;
  const month = Number(m);
  const day = Number(d);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${y}-${m}-${d}`;
}

/**
 * Parses a ServerTime / timestamp string into epoch milliseconds.
 * Accepts common MT5 forms:
 *   "2026.06.01 09:15:03", "2026-06-01 09:15:03", "2026/06/01T09:15:03".
 * Returns null when the value cannot be interpreted.
 */
export function parseTimestamp(value: string): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  // Normalise separators: dots/slashes in the date portion → dashes,
  // and a space between date and time → 'T' for ISO parsing.
  const normalised = trimmed
    .replace(/^(\d{4})[.\/](\d{2})[.\/](\d{2})/, '$1-$2-$3')
    .replace(/^(\d{4}-\d{2}-\d{2})[ T]/, '$1T');

  const ms = Date.parse(normalised);
  if (!Number.isNaN(ms)) return ms;

  // Last-resort: try the raw value.
  const fallback = Date.parse(trimmed);
  return Number.isNaN(fallback) ? null : fallback;
}

/** Returns the YYYY-MM-DD day bucket for an epoch-ms timestamp (UTC-stable). */
export function dayKeyFromMs(ms: number): string {
  const d = new Date(ms);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Derives a day key from the best available source:
 * ServerTime timestamp → filename date → raw Date column.
 */
export function resolveDayKey(
  timestampMs: number | null,
  fileNameDate: string | null,
  rawDate: string,
): string {
  if (timestampMs !== null) return dayKeyFromMs(timestampMs);
  if (fileNameDate) return fileNameDate;
  const normalisedRaw = rawDate.trim().replace(/[.\/]/g, '-');
  return normalisedRaw || 'unknown';
}

/** Human-friendly label for a day key, e.g. "2026-06-01" → "01 Jun 2026". */
export function formatDayLabel(dayKey: string): string {
  const ms = parseTimestamp(`${dayKey} 00:00:00`);
  if (ms === null) return dayKey;
  return new Date(ms).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
