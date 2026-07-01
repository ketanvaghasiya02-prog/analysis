/**
 * Timezone Engine (Time Analysis module) — pure, display/filter only.
 *
 * The uploaded MT5 CSV stores Broker SERVER time (a local wall clock with no
 * timezone marker). This engine converts, on the fly, between the server clock
 * and a display/input timezone (Indian Standard Time, UTC or a custom offset).
 *
 * It NEVER rewrites the CSV: the original sample timestamps are immutable. All
 * conversion happens by mapping a sample's server wall-clock onto an absolute
 * "server timeline" (in seconds) and shifting by the difference of UTC offsets.
 */

export type TzKind = 'server' | 'ist' | 'utc' | 'custom';

export const IST_OFFSET_MIN = 330; // UTC+5:30
export const DEFAULT_SERVER_OFFSET_MIN = 180; // UTC+3 — common MT5 gold-broker server time

export interface TzConfig {
  /** Broker server UTC offset in minutes (assumed/manual — CSV carries no tz). */
  serverOffsetMin: number;
  /** Offset in minutes used when TzKind is 'custom'. */
  customOffsetMin: number;
}

export const DEFAULT_TZ_CONFIG: TzConfig = {
  serverOffsetMin: DEFAULT_SERVER_OFFSET_MIN,
  customOffsetMin: 0,
};

export const TZ_LABEL: Record<TzKind, string> = {
  server: 'Server Time',
  ist: 'Indian Time',
  utc: 'UTC',
  custom: 'Custom',
};

/** UTC offset (minutes) for a timezone kind under the given config. */
export function offsetOf(kind: TzKind, cfg: TzConfig): number {
  switch (kind) {
    case 'server':
      return cfg.serverOffsetMin;
    case 'ist':
      return IST_OFFSET_MIN;
    case 'utc':
      return 0;
    case 'custom':
      return cfg.customOffsetMin;
  }
}

/** "UTC+5:30" / "UTC-4:00" */
export function fmtUtcOffset(min: number): string {
  const sign = min < 0 ? '-' : '+';
  const a = Math.abs(min);
  return `UTC${sign}${Math.floor(a / 60)}:${String(a % 60).padStart(2, '0')}`;
}

/** "+2h30m" / "-3h" */
export function fmtDeltaHM(min: number): string {
  const sign = min < 0 ? '-' : '+';
  const a = Math.abs(min);
  const h = Math.floor(a / 60);
  const m = a % 60;
  return `${sign}${h}h${m > 0 ? `${m}m` : ''}`;
}

/** "Indian Time (UTC+5:30)" */
export function tzLabelFull(kind: TzKind, cfg: TzConfig): string {
  return `${TZ_LABEL[kind]} (${fmtUtcOffset(offsetOf(kind, cfg))})`;
}

// --- clock helpers ------------------------------------------------------------

/** Parses "HH:MM" or "HH:MM:SS" to seconds-of-day, or null. */
export function parseClock(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(s.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  const sec = m[3] ? Number(m[3]) : 0;
  if (h > 23 || min > 59 || sec > 59) return null;
  return h * 3600 + min * 60 + sec;
}

/** HH:MM slice of a time string. */
export function hhmm(time: string): string {
  return time.length >= 5 ? time.slice(0, 5) : time;
}

/** Days since the Unix epoch for a YYYY-MM-DD date (UTC-anchored index). */
export function dayNumUTC(date: string): number {
  const ms = Date.parse(`${date}T00:00:00Z`);
  return Number.isFinite(ms) ? Math.round(ms / 86_400_000) : NaN;
}

const DAY = 86_400;

function wrapDay(sec: number): number {
  const s = Math.round(sec) % DAY;
  return s < 0 ? s + DAY : s;
}

export function secToHHMMSS(secOfDay: number): string {
  const s = wrapDay(secOfDay);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

export function secToHHMM(secOfDay: number): string {
  return secToHHMMSS(secOfDay).slice(0, 5);
}

// --- server-timeline conversions ---------------------------------------------

/**
 * Absolute position on the SERVER wall-clock timeline (seconds) for a sample's
 * immutable server date + time. This is the canonical value everything maps to.
 */
export function serverAbsSec(dayKey: string, time: string): number | null {
  const d = dayNumUTC(dayKey);
  const t = parseClock(time);
  if (!Number.isFinite(d) || t === null) return null;
  return d * DAY + t;
}

/**
 * A wall-clock time entered in `inputTz` on `date` → the absolute server-second
 * it corresponds to (so the CSV, stored in server time, can be filtered).
 */
export function inputToServerAbsSec(date: string, secOfDay: number, inputTz: TzKind, cfg: TzConfig): number {
  // input wall → server wall: add (serverOffset − inputOffset).
  const shift = (cfg.serverOffsetMin - offsetOf(inputTz, cfg)) * 60;
  return dayNumUTC(date) * DAY + secOfDay + shift;
}

/** Seconds-of-day of an absolute server-second when displayed in `tz`. */
export function absSecToTzSecOfDay(absServerSec: number, tz: TzKind, cfg: TzConfig): number {
  const shift = (offsetOf(tz, cfg) - cfg.serverOffsetMin) * 60;
  return wrapDay(absServerSec + shift);
}

/** HH:MM:SS of an absolute server-second in `tz`. */
export function absSecToHHMMSS(absServerSec: number, tz: TzKind, cfg: TzConfig): string {
  return secToHHMMSS(absSecToTzSecOfDay(absServerSec, tz, cfg));
}
/** HH:MM of an absolute server-second in `tz`. */
export function absSecToHHMM(absServerSec: number, tz: TzKind, cfg: TzConfig): string {
  return secToHHMM(absSecToTzSecOfDay(absServerSec, tz, cfg));
}
