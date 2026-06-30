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

const DEFAULT_WINDOW_DAYS = 20;

export interface MarketContextInput {
  windowDays: number;
}

export const DEFAULT_MARKET_CONTEXT_INPUT: MarketContextInput = {
  windowDays: DEFAULT_WINDOW_DAYS,
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

export interface MarketContext {
  hasData: boolean;
  windowDays: number;
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
  recentMovement: number | null; // mean |Δgap| between consecutive recent samples

  trend: 'expanding' | 'compressing' | 'stable';
  expansionPct: number; // share of upward moves recently
  compressionPct: number; // share of downward moves recently

  histogram: HistogramBin[];

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

  const empty: MarketContext = {
    hasData: false,
    windowDays,
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
    recentMovement: null,
    trend: 'stable',
    expansionPct: 0,
    compressionPct: 0,
    histogram: [],
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

  // Recent window = the last `windowDays` distinct trading days.
  const dayKeys = Array.from(new Set(samples.map((s) => s.dayKey))).filter((d) => d && d !== 'unknown').sort();
  const windowDayKeys = new Set(dayKeys.slice(Math.max(0, dayKeys.length - windowDays)));
  const windowSamples = samples.filter((s) => windowDayKeys.has(s.dayKey));
  const windowGaps = gapsOf(windowSamples);
  const allGaps = gapsOf(samples);

  const currentGap = current.gap!;
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

  // Regime — deterministic from recent gap percentile + volatility percentile.
  const dailyVol: number[] = [];
  for (const day of dayKeys) {
    const v = stdDev(gapsOf(samples.filter((s) => s.dayKey === day)));
    if (v !== null) dailyVol.push(v);
  }
  const volPercentile = recentVolatility !== null ? percentileBelow(dailyVol, recentVolatility) : 50;
  const gapState = gapPercentileRecent >= 80 ? 'Wide gap' : gapPercentileRecent <= 20 ? 'Tight gap' : 'Normal gap';
  const volState = volPercentile >= 70 ? 'High volatility' : volPercentile <= 30 ? 'Low volatility' : 'Normal volatility';
  let regimeTone: RegimeTone = 'accent';
  if (gapPercentileRecent >= 80 || volPercentile >= 70) regimeTone = 'negative';
  else if (gapPercentileRecent <= 20 && volPercentile <= 30) regimeTone = 'positive';
  else regimeTone = 'warning';
  const regime = { label: `${gapState} · ${volState}`, tone: regimeTone, gapState, volState };

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
    recentMovement,
    trend,
    expansionPct,
    compressionPct,
    histogram,
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
      trend,
      regime,
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
  trend: MarketContext['trend'];
  regime: MarketContext['regime'];
  sessionContext: MarketContext['sessionContext'];
  contract: MarketContext['contract'];
}): string[] {
  const out: string[] = [];

  out.push(
    `The current gap (${fmt(x.currentGap)}) is larger than ${Math.round(x.gapPercentileRecent)}% of observations in the last ${x.windowDayCount} trading day${x.windowDayCount === 1 ? '' : 's'}.`,
  );
  if (x.recentAvgGap !== null) {
    const rel = x.currentGap > x.recentAvgGap ? 'above' : x.currentGap < x.recentAvgGap ? 'below' : 'in line with';
    out.push(`The recent average gap is ${fmt(x.recentAvgGap)}; the current gap is ${rel} the recent average.`);
  }
  if (x.trend !== 'stable') {
    out.push(`The gap has recently been ${x.trend} relative to its recent average.`);
  } else {
    out.push('The gap has recently been broadly stable relative to its recent average.');
  }
  if (x.sessionContext) {
    out.push(
      `The current session (${x.sessionContext.current}) historically shows ${x.sessionContext.aboveAverage ? 'above-average' : 'around- or below-average'} volatility in this window.`,
    );
  }
  out.push(`Current regime: ${x.regime.label}.`);
  if (x.contract) {
    out.push(
      `The current contract (${x.contract.symbol}) has been active for ${x.contract.ageDays} trading day${x.contract.ageDays === 1 ? '' : 's'} in the uploaded data${x.contract.rollDetectedInWindow ? `; a contract roll was detected on ${x.contract.rollDay}` : ''}.`,
    );
  }
  out.push('This is statistical context from uploaded history only — not a prediction or recommendation.');
  return out;
}
