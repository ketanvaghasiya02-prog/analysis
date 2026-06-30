/**
 * Market Context Engine (Phase 13) — statistical context, not prediction.
 *
 * Describes the CURRENT market context from uploaded CSV history over a recent
 * research window: where the current gap sits in the recent distribution, the
 * recent regime, volatility, session context and contract age. It is purely
 * descriptive — it never predicts, recommends or signals.
 *
 * Standalone and read-only. It does NOT modify or call the Research Engine,
 * Probability Engine, Ranking or Strategy Finder.
 */

import type { GapSample } from '@/types/gap';
import type { SerializedExport } from '@/utils/reports';

// Recent market behaviour is the default priority (Constitution Rule 7).
// Gold Spot vs Gold Futures converge toward expiry, so old gap values are not
// representative — default 15 days, advisory max 30. Long windows must be an
// explicit user choice.
const DEFAULT_WINDOW_DAYS = 15;
const DEFAULT_MAX_WINDOW_DAYS = 30;

export interface MarketContextInput {
  /** Recent research window in trading days (default 15). */
  windowDays: number;
  /** Advisory maximum window (default 30); larger is flagged, not blocked. */
  maxWindowDays: number;
  /** Override the "current gap"; null = use the latest sample's gap. */
  currentGapOverride: number | null;
  /** Session filter; empty = all sessions. */
  sessions: string[];
}

export const DEFAULT_MARKET_CONTEXT_INPUT: MarketContextInput = {
  windowDays: DEFAULT_WINDOW_DAYS,
  maxWindowDays: DEFAULT_MAX_WINDOW_DAYS,
  currentGapOverride: null,
  sessions: [],
};

export interface HistogramBin {
  label: string;
  from: number;
  to: number;
  count: number;
  containsCurrent: boolean;
}

export interface SessionContext {
  session: string;
  avgGap: number | null;
  volatility: number | null;
  samples: number;
}

export type RegimeTone = 'positive' | 'warning' | 'negative' | 'accent';

export interface GapDistribution {
  min: number;
  p25: number;
  median: number; // P50
  p75: number;
  p90: number;
  p95: number;
  max: number;
}

export interface VolPoint {
  day: string;
  volatility: number;
}

export type MarketRegimeKind = 'Normal' | 'Expansion' | 'Compression' | 'Transition';

export interface MarketRegime {
  kind: MarketRegimeKind;
  tone: RegimeTone;
  reason: string;
}

export interface MarketContext {
  hasData: boolean;
  windowDays: number;
  maxWindowDays: number;
  windowCapped: boolean;
  currentGapIsOverride: boolean;
  windowDayCount: number;
  windowStartDay: string | null;
  windowEndDay: string | null;
  windowSampleCount: number;

  current: {
    gap: number;
    session: string;
    futureSymbol: string;
    spotSymbol: string;
    day: string;
    time: string;
  } | null;

  gapPercentileRecent: number; // % of recent observations below the current gap
  gapPercentileAll: number; // % of all observations below the current gap
  recentAvgGap: number | null;
  recentMedianGap: number | null;
  recentVolatility: number | null; // std dev of recent gaps
  averageDailyVolatility: number | null; // mean per-day volatility in the window
  relativeVolatility: number | null; // recentVolatility / averageDailyVolatility
  volPercentile: number; // recent volatility percentile vs daily-vol distribution
  recentMovement: number | null; // mean |Δgap| between consecutive recent samples

  trend: 'expanding' | 'compressing' | 'stable';
  expansionPct: number; // share of upward moves recently
  compressionPct: number; // share of downward moves recently

  distribution: GapDistribution | null;
  histogram: HistogramBin[];
  volatilityDistribution: VolPoint[];

  marketRegime: MarketRegime;
  regime: { label: string; tone: RegimeTone; gapState: string; volState: string };

  contract: {
    symbol: string;
    ageDays: number;
    rollDetectedInWindow: boolean;
    rollDay: string | null;
  } | null;

  sessions: SessionContext[];
  sessionContext: {
    current: string;
    currentVolatility: number | null;
    averageVolatility: number | null;
    aboveAverage: boolean;
  } | null;

  observations: string[];
}

function mean(values: number[]): number | null {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

function stdDev(values: number[]): number | null {
  if (values.length < 2) return null;
  const m = values.reduce((a, b) => a + b, 0) / values.length;
  const v = values.reduce((a, b) => a + (b - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(v);
}

/** Percentage of values strictly below `target`. */
function percentileBelow(values: number[], target: number): number {
  if (values.length === 0) return 0;
  let below = 0;
  for (const v of values) if (v < target) below += 1;
  return (below / values.length) * 100;
}

/** Value at percentile p (0–100) using linear interpolation. */
function percentileValue(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  if (s.length === 1) return s[0]!;
  const idx = (p / 100) * (s.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return s[lo]!;
  return s[lo]! + (s[hi]! - s[lo]!) * (idx - lo);
}

function distributionOf(gaps: number[]): GapDistribution | null {
  if (gaps.length === 0) return null;
  return {
    min: Math.min(...gaps),
    p25: percentileValue(gaps, 25) ?? 0,
    median: percentileValue(gaps, 50) ?? 0,
    p75: percentileValue(gaps, 75) ?? 0,
    p90: percentileValue(gaps, 90) ?? 0,
    p95: percentileValue(gaps, 95) ?? 0,
    max: Math.max(...gaps),
  };
}

function gapsOf(samples: GapSample[]): number[] {
  const out: number[] = [];
  for (const s of samples) if (s.gap !== null) out.push(s.gap);
  return out;
}

function buildHistogram(gaps: number[], current: number, binCount = 16): HistogramBin[] {
  if (gaps.length === 0) return [];
  const min = Math.min(...gaps, current);
  const max = Math.max(...gaps, current);
  if (max - min < 1e-9) {
    return [{ label: min.toFixed(2), from: min, to: max, count: gaps.length, containsCurrent: true }];
  }
  const width = (max - min) / binCount;
  const bins: HistogramBin[] = Array.from({ length: binCount }, (_, i) => {
    const from = min + i * width;
    const to = i === binCount - 1 ? max : from + width;
    return { label: `${from.toFixed(2)}`, from, to, count: 0, containsCurrent: false };
  });
  const idxOf = (v: number) => {
    let idx = Math.floor((v - min) / width);
    if (idx >= binCount) idx = binCount - 1;
    if (idx < 0) idx = 0;
    return idx;
  };
  for (const g of gaps) bins[idxOf(g)]!.count += 1;
  bins[idxOf(current)]!.containsCurrent = true;
  return bins;
}

/** Builds the market context. Pure and read-only. */
export function buildMarketContext(samples: GapSample[], input: MarketContextInput): MarketContext {
  const windowDays = input.windowDays > 0 ? Math.round(input.windowDays) : DEFAULT_WINDOW_DAYS;

  const maxWindowDays = input.maxWindowDays > 0 ? Math.round(input.maxWindowDays) : DEFAULT_MAX_WINDOW_DAYS;
  const empty: MarketContext = {
    hasData: false,
    windowDays,
    maxWindowDays,
    windowCapped: windowDays > maxWindowDays,
    currentGapIsOverride: input.currentGapOverride !== null,
    windowDayCount: 0,
    windowStartDay: null,
    windowEndDay: null,
    windowSampleCount: 0,
    current: null,
    gapPercentileRecent: 0,
    gapPercentileAll: 0,
    recentAvgGap: null,
    recentMedianGap: null,
    recentVolatility: null,
    averageDailyVolatility: null,
    relativeVolatility: null,
    volPercentile: 50,
    recentMovement: null,
    trend: 'stable',
    expansionPct: 0,
    compressionPct: 0,
    distribution: null,
    histogram: [],
    volatilityDistribution: [],
    marketRegime: { kind: 'Normal', tone: 'accent', reason: 'No data' },
    regime: { label: 'No data', tone: 'accent', gapState: '—', volState: '—' },
    contract: null,
    sessions: [],
    sessionContext: null,
    observations: [],
  };

  if (samples.length === 0) return empty;

  // Latest valid sample = current market state.
  let current: GapSample | null = null;
  for (let i = samples.length - 1; i >= 0; i -= 1) {
    const s = samples[i]!;
    if (s.gap !== null) {
      current = s;
      break;
    }
  }
  if (!current) return empty;

  // Recent window = the last `windowDays` distinct trading days. The session
  // filter (if any) scopes every recent-window metric.
  const sessionSet = input.sessions.length ? new Set(input.sessions) : null;
  const inSession = (s: GapSample) => !sessionSet || sessionSet.has(s.currentSession);
  const dayKeys = Array.from(new Set(samples.map((s) => s.dayKey))).filter((d) => d && d !== 'unknown').sort();
  const windowDayKeys = new Set(dayKeys.slice(Math.max(0, dayKeys.length - windowDays)));
  const windowSamples = samples.filter((s) => windowDayKeys.has(s.dayKey) && inSession(s));
  const windowGaps = gapsOf(windowSamples);
  const allGaps = gapsOf(samples.filter(inSession));

  // Current gap: an explicit override, else the latest sample's gap.
  const currentGap = input.currentGapOverride ?? current.gap!;
  const gapPercentileRecent = percentileBelow(windowGaps, currentGap);
  const gapPercentileAll = percentileBelow(allGaps, currentGap);
  const recentAvgGap = mean(windowGaps);
  const recentMedianGap = median(windowGaps);
  const recentVolatility = stdDev(windowGaps);

  // Movement + trend from consecutive recent samples (chronological).
  const recentChrono = windowSamples.filter((s) => s.gap !== null);
  const diffs: number[] = [];
  for (let i = 1; i < recentChrono.length; i += 1) {
    diffs.push(recentChrono[i]!.gap! - recentChrono[i - 1]!.gap!);
  }
  const recentMovement = diffs.length ? mean(diffs.map((d) => Math.abs(d))) : null;
  const ups = diffs.filter((d) => d > 1e-9).length;
  const downs = diffs.filter((d) => d < -1e-9).length;
  const moves = ups + downs;
  const expansionPct = moves ? (ups / moves) * 100 : 0;
  const compressionPct = moves ? (downs / moves) * 100 : 0;

  // Short-term trend: last ~10% of the window vs the window average.
  const tailN = Math.max(5, Math.floor(recentChrono.length * 0.1));
  const tailGaps = gapsOf(recentChrono.slice(-tailN));
  const tailAvg = mean(tailGaps);
  let trend: MarketContext['trend'] = 'stable';
  if (tailAvg !== null && recentAvgGap !== null) {
    const band = (recentVolatility ?? 0) * 0.25;
    if (tailAvg > recentAvgGap + band) trend = 'expanding';
    else if (tailAvg < recentAvgGap - band) trend = 'compressing';
  }

  // Recent gap distribution (within the window only).
  const distribution = distributionOf(windowGaps);

  // Per-day volatility within the window → average + relative + distribution.
  const windowDayList = [...windowDayKeys].sort();
  const volatilityDistribution: VolPoint[] = [];
  const dailyVol: number[] = [];
  for (const day of windowDayList) {
    const v = stdDev(gapsOf(windowSamples.filter((s) => s.dayKey === day)));
    if (v !== null) {
      dailyVol.push(v);
      volatilityDistribution.push({ day, volatility: v });
    }
  }
  const averageDailyVolatility = mean(dailyVol);
  const relativeVolatility =
    recentVolatility !== null && averageDailyVolatility !== null && averageDailyVolatility > 1e-9
      ? recentVolatility / averageDailyVolatility
      : null;
  const volPercentile = recentVolatility !== null ? percentileBelow(dailyVol, recentVolatility) : 50;

  // Legacy gap/volatility-state regime (kept for the existing indicator).
  const gapState = gapPercentileRecent >= 80 ? 'Wide gap' : gapPercentileRecent <= 20 ? 'Tight gap' : 'Normal gap';
  const volState = volPercentile >= 70 ? 'High volatility' : volPercentile <= 30 ? 'Low volatility' : 'Normal volatility';
  let regimeTone: RegimeTone = 'accent';
  if (gapPercentileRecent >= 80 || volPercentile >= 70) regimeTone = 'negative';
  else if (gapPercentileRecent <= 20 && volPercentile <= 30) regimeTone = 'positive';
  else regimeTone = 'warning';
  const regime = { label: `${gapState} · ${volState}`, tone: regimeTone, gapState, volState };

  // Deterministic market regime: Normal / Expansion / Compression / Transition.
  const highVol = volPercentile >= 70;
  let marketRegime: MarketRegime;
  if (highVol && trend === 'stable') {
    marketRegime = { kind: 'Transition', tone: 'warning', reason: 'High recent volatility with no clear directional trend.' };
  } else if (trend === 'expanding' || expansionPct >= 60) {
    marketRegime = { kind: 'Expansion', tone: 'negative', reason: 'The gap has been widening relative to its recent average.' };
  } else if (trend === 'compressing' || compressionPct >= 60) {
    marketRegime = { kind: 'Compression', tone: 'positive', reason: 'The gap has been compressing relative to its recent average.' };
  } else {
    marketRegime = { kind: 'Normal', tone: 'accent', reason: 'Recent behaviour is broadly stable around its average.' };
  }

  // Contract age + roll detection.
  const symbol = current.futureSymbol;
  const symbolDays = Array.from(new Set(samples.filter((s) => s.futureSymbol === symbol).map((s) => s.dayKey)))
    .filter((d) => d && d !== 'unknown')
    .sort();
  const ageDays = symbolDays.length;
  const firstSymbolDay = symbolDays[0] ?? null;
  const rollDetectedInWindow = firstSymbolDay !== null && windowDayKeys.has(firstSymbolDay) && firstSymbolDay !== dayKeys[0];
  const contract = { symbol, ageDays, rollDetectedInWindow, rollDay: rollDetectedInWindow ? firstSymbolDay : null };

  // Session context.
  const sessionMap = new Map<string, number[]>();
  for (const s of windowSamples) {
    if (s.gap === null) continue;
    const list = sessionMap.get(s.currentSession);
    if (list) list.push(s.gap);
    else sessionMap.set(s.currentSession, [s.gap]);
  }
  const sessions: SessionContext[] = Array.from(sessionMap.entries())
    .map(([session, gaps]) => ({ session, avgGap: mean(gaps), volatility: stdDev(gaps), samples: gaps.length }))
    .sort((a, b) => b.samples - a.samples);
  const sessionVols = sessions.map((s) => s.volatility).filter((v): v is number => v !== null);
  const averageVolatility = mean(sessionVols);
  const currentSessionStat = sessions.find((s) => s.session === current.currentSession) ?? null;
  const sessionContext = {
    current: current.currentSession,
    currentVolatility: currentSessionStat?.volatility ?? null,
    averageVolatility,
    aboveAverage:
      currentSessionStat?.volatility != null && averageVolatility != null
        ? currentSessionStat.volatility > averageVolatility
        : false,
  };

  const histogram = buildHistogram(windowGaps, currentGap);

  return {
    hasData: true,
    windowDays,
    maxWindowDays,
    windowCapped: windowDays > maxWindowDays,
    currentGapIsOverride: input.currentGapOverride !== null,
    windowDayCount: windowDayKeys.size,
    windowStartDay: dayKeys[Math.max(0, dayKeys.length - windowDays)] ?? null,
    windowEndDay: dayKeys[dayKeys.length - 1] ?? null,
    windowSampleCount: windowSamples.length,
    current: {
      gap: currentGap,
      session: current.currentSession,
      futureSymbol: current.futureSymbol,
      spotSymbol: current.spotSymbol,
      day: current.dayKey,
      time: current.serverTime,
    },
    gapPercentileRecent,
    gapPercentileAll,
    recentAvgGap,
    recentMedianGap,
    recentVolatility,
    averageDailyVolatility,
    relativeVolatility,
    volPercentile,
    recentMovement,
    trend,
    expansionPct,
    compressionPct,
    distribution,
    histogram,
    volatilityDistribution,
    marketRegime,
    regime,
    contract,
    sessions,
    sessionContext,
    observations: buildObservations({
      currentGap,
      windowDayCount: windowDayKeys.size,
      gapPercentileRecent,
      recentAvgGap,
      recentVolatility,
      relativeVolatility,
      trend,
      marketRegime,
      sessionContext,
      contract,
    }),
  };
}

function fmt(n: number, d = 2): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

function buildObservations(x: {
  currentGap: number;
  windowDayCount: number;
  gapPercentileRecent: number;
  recentAvgGap: number | null;
  recentVolatility: number | null;
  relativeVolatility: number | null;
  trend: MarketContext['trend'];
  marketRegime: MarketRegime;
  sessionContext: MarketContext['sessionContext'];
  contract: MarketContext['contract'];
}): string[] {
  const out: string[] = [];

  const pct = Math.round(x.gapPercentileRecent);
  const rare = pct >= 95 || pct <= 5;
  out.push(
    `The current gap (${fmt(x.currentGap)}) is larger than ${pct}% of observations in the last ${x.windowDayCount} trading day${x.windowDayCount === 1 ? '' : 's'}${rare ? ' — historically rare within the selected research window' : ''}.`,
  );
  if (x.recentAvgGap !== null) {
    const rel = x.currentGap > x.recentAvgGap ? 'above' : x.currentGap < x.recentAvgGap ? 'below' : 'in line with';
    out.push(`The recent average gap is ${fmt(x.recentAvgGap)}; the current gap is ${rel} the recent average.`);
  }
  if (x.relativeVolatility !== null) {
    const lvl = x.relativeVolatility >= 1.15 ? 'above' : x.relativeVolatility <= 0.85 ? 'below' : 'around';
    out.push(`Current recent volatility is ${lvl} the recent daily average (${fmt(x.relativeVolatility, 2)}× the average daily volatility).`);
  }
  if (x.sessionContext) {
    out.push(
      `The current session (${x.sessionContext.current}) historically shows ${x.sessionContext.aboveAverage ? 'above-average' : 'around- or below-average'} volatility in this window.`,
    );
  }
  out.push(`Current market regime: ${x.marketRegime.kind} — ${x.marketRegime.reason}`);
  if (x.contract) {
    out.push(
      `The current contract (${x.contract.symbol}) has been active for ${x.contract.ageDays} trading day${x.contract.ageDays === 1 ? '' : 's'} in the uploaded data${x.contract.rollDetectedInWindow ? `; a contract roll was detected on ${x.contract.rollDay}` : ''}.`,
    );
  }
  out.push('This is statistical context from uploaded history only — not a prediction or recommendation.');
  return out;
}

// --- export -------------------------------------------------------------------

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const r3 = (n: number | null) => (n === null ? '' : Math.round(n * 1000) / 1000);

export function marketContextCsv(ctx: MarketContext): SerializedExport {
  const lines: string[] = [];
  lines.push('Section,Metric,Value');
  const row = (sec: string, m: string, v: string | number) => lines.push([sec, m, v].map(csvCell).join(','));
  if (ctx.current) {
    row('Current', 'Gap', r3(ctx.current.gap));
    row('Current', 'Session', ctx.current.session);
    row('Current', 'Trading Day', ctx.current.day);
    row('Current', 'Gap Percentile (recent)', Math.round(ctx.gapPercentileRecent));
    row('Current', 'Market Regime', ctx.marketRegime.kind);
  }
  row('Window', 'Research Window (days)', ctx.windowDays);
  row('Window', 'Days Covered', ctx.windowDayCount);
  row('Window', 'Sample Count', ctx.windowSampleCount);
  if (ctx.distribution) {
    const d = ctx.distribution;
    row('Distribution', 'Min', r3(d.min));
    row('Distribution', 'P25', r3(d.p25));
    row('Distribution', 'Median (P50)', r3(d.median));
    row('Distribution', 'P75', r3(d.p75));
    row('Distribution', 'P90', r3(d.p90));
    row('Distribution', 'P95', r3(d.p95));
    row('Distribution', 'Max', r3(d.max));
  }
  row('Volatility', 'Recent Volatility', r3(ctx.recentVolatility));
  row('Volatility', 'Average Daily Volatility', r3(ctx.averageDailyVolatility));
  row('Volatility', 'Relative Volatility', r3(ctx.relativeVolatility));
  row('Volatility', 'Expansion Frequency %', Math.round(ctx.expansionPct));
  row('Volatility', 'Compression Frequency %', Math.round(ctx.compressionPct));
  for (const s of ctx.sessions) {
    row('Session', `${s.session} avg gap`, r3(s.avgGap));
    row('Session', `${s.session} volatility`, r3(s.volatility));
    row('Session', `${s.session} samples`, s.samples);
  }
  return { filename: 'MarketContext.csv', content: lines.join('\n'), mime: 'text/csv' };
}

export function marketContextJson(ctx: MarketContext, generatedAt: string): SerializedExport {
  const payload = {
    note: 'Market context describes where today stands relative to recent history. Descriptive only — never a prediction, recommendation or signal.',
    generatedAt,
    window: { days: ctx.windowDays, maxDays: ctx.maxWindowDays, capped: ctx.windowCapped, daysCovered: ctx.windowDayCount, samples: ctx.windowSampleCount, start: ctx.windowStartDay, end: ctx.windowEndDay },
    current: ctx.current,
    gapPercentileRecent: ctx.gapPercentileRecent,
    gapPercentileAll: ctx.gapPercentileAll,
    distribution: ctx.distribution,
    volatility: { recent: ctx.recentVolatility, averageDaily: ctx.averageDailyVolatility, relative: ctx.relativeVolatility, percentile: ctx.volPercentile, expansionPct: ctx.expansionPct, compressionPct: ctx.compressionPct },
    marketRegime: ctx.marketRegime,
    sessions: ctx.sessions,
    contract: ctx.contract,
    observations: ctx.observations,
  };
  return { filename: 'MarketContext.json', content: JSON.stringify(payload, null, 2), mime: 'application/json' };
}
