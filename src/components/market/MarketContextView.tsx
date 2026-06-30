/**
 * Market Intelligence — Market Context Engine v1.0 (Phase 13).
 *
 * A descriptive statistical snapshot of the CURRENT market context from
 * uploaded CSV history over a recent research window. It never predicts,
 * recommends or signals — it only describes where the current gap sits, the
 * recent regime, volatility, session and contract context.
 *
 * Default research window is 15 trading days (advisory max 30). Gold Spot vs
 * Gold Futures converge toward expiry, so old gaps are not representative —
 * long windows are an explicit, flagged user choice.
 */

import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useData } from '@/context/DataContext';
import {
  buildMarketContext,
  DEFAULT_MARKET_CONTEXT_INPUT,
  marketContextCsv,
  marketContextJson,
  type MarketContextInput,
  type MarketRegimeKind,
  type RegimeTone,
} from '@/utils/marketContext';
import { downloadExport } from '@/utils/reports';
import { ChipMultiSelect } from '@/components/filters/ChipMultiSelect';
import { StatCard } from '@/components/overview/StatCard';
import { EmptyState } from '@/components/common/EmptyState';
import { fmtInt, fmtNumber, fmtPercent } from '@/utils/format';
import { AlertIcon, ChartIcon, DownloadIcon, GaugeIcon } from '@/components/common/icons';

const REGIME_TONE: Record<MarketRegimeKind, RegimeTone> = {
  Normal: 'accent',
  Expansion: 'negative',
  Compression: 'positive',
  Transition: 'warning',
};

const AXIS = {
  tick: { fill: '#64748b', fontSize: 10 },
  tickLine: false,
  axisLine: { stroke: '#1e293b' },
} as const;

const TOOLTIP = {
  contentStyle: { background: '#111a2c', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 },
  labelStyle: { color: '#94a3b8' },
  itemStyle: { color: '#e2e8f0' },
} as const;

const TONE_TEXT: Record<RegimeTone, string> = {
  positive: 'text-positive',
  warning: 'text-warning',
  negative: 'text-negative',
  accent: 'text-accent',
};
const TONE_BG: Record<RegimeTone, string> = {
  positive: 'border-positive/40 bg-positive/10',
  warning: 'border-warning/40 bg-warning/10',
  negative: 'border-negative/40 bg-negative/10',
  accent: 'border-accent/40 bg-accent/10',
};

export function MarketContextView() {
  const { dataset, filterOptions } = useData();
  const [input, setInput] = useState<MarketContextInput>(DEFAULT_MARKET_CONTEXT_INPUT);

  const samples = dataset?.samples ?? [];
  const ctx = useMemo(() => buildMarketContext(samples, input), [samples, input]);
  const sessionOptions = filterOptions?.sessions ?? [];

  if (!ctx.hasData || !ctx.current) {
    return (
      <EmptyState
        title="No uploaded data"
        description="Upload one or more GapMonitor CSV exports to describe the current market context. The Market Context Engine reads only your uploaded history — it never predicts."
      />
    );
  }

  const cur = ctx.current;
  const histData = ctx.histogram.map((b) => ({ label: b.label, count: b.count, containsCurrent: b.containsCurrent }));
  const sessionData = ctx.sessions.map((s) => ({ name: s.session, volatility: s.volatility ?? 0, avgGap: s.avgGap ?? 0 }));
  const volData = ctx.volatilityDistribution.map((v) => ({ day: v.day.slice(5), volatility: v.volatility }));
  const dist = ctx.distribution;

  const exportCsv = () => downloadExport(marketContextCsv(ctx));
  const exportJson = () => downloadExport(marketContextJson(ctx, new Date().toISOString()));

  const distRows: Array<{ label: string; value: number | null }> = dist
    ? [
        { label: 'Min', value: dist.min },
        { label: 'P25', value: dist.p25 },
        { label: 'Median (P50)', value: dist.median },
        { label: 'P75', value: dist.p75 },
        { label: 'P90', value: dist.p90 },
        { label: 'P95', value: dist.p95 },
        { label: 'Max', value: dist.max },
      ]
    : [];

  return (
    <div className="space-y-5">
      {/* Disclaimer + status + exports */}
      <section className="card flex flex-wrap items-start gap-3 border-accent/30 bg-accent/5 p-4">
        <GaugeIcon className="mt-0.5 text-base text-accent" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-ink">Current market context</p>
            <span className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
              Market Context Engine v1.0
            </span>
          </div>
          <p className="mt-1 text-sm leading-relaxed text-ink-muted">
            A statistical description of where the current gap sits within recent
            history. This is context only — never a prediction, recommendation or
            trading signal.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={exportCsv}
            className="flex items-center gap-1.5 rounded-md border border-panel-border bg-panel px-3 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:border-accent hover:text-accent"
          >
            <DownloadIcon className="text-sm" /> CSV
          </button>
          <button
            type="button"
            onClick={exportJson}
            className="flex items-center gap-1.5 rounded-md border border-panel-border bg-panel px-3 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:border-accent hover:text-accent"
          >
            <DownloadIcon className="text-sm" /> JSON
          </button>
        </div>
      </section>

      {/* Research inputs */}
      <section className="card p-5">
        <h2 className="stat-label mb-3">Research Inputs</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="flex flex-col gap-1">
            <span className="stat-label">Recent Window (days)</span>
            <input
              type="number"
              min={1}
              step={1}
              value={input.windowDays}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (Number.isFinite(v) && v > 0) setInput((prev) => ({ ...prev, windowDays: Math.round(v) }));
              }}
              className="rounded-md border border-panel-border bg-panel px-3 py-1.5 text-sm text-ink focus:border-accent focus:outline-none"
            />
            <span className="text-[10px] text-ink-faint">Default 15. Recent behaviour is prioritised.</span>
          </label>
          <label className="flex flex-col gap-1">
            <span className="stat-label">Maximum Window (days)</span>
            <input
              type="number"
              min={1}
              step={1}
              value={input.maxWindowDays}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (Number.isFinite(v) && v > 0) setInput((prev) => ({ ...prev, maxWindowDays: Math.round(v) }));
              }}
              className="rounded-md border border-panel-border bg-panel px-3 py-1.5 text-sm text-ink focus:border-accent focus:outline-none"
            />
            <span className="text-[10px] text-ink-faint">Advisory cap 30. Larger windows are flagged.</span>
          </label>
          <label className="flex flex-col gap-1">
            <span className="stat-label">Current Gap (override)</span>
            <input
              type="number"
              step="any"
              placeholder={fmtNumber(cur.gap, 2)}
              value={input.currentGapOverride ?? ''}
              onChange={(e) => {
                const raw = e.target.value.trim();
                if (raw === '') {
                  setInput((prev) => ({ ...prev, currentGapOverride: null }));
                  return;
                }
                const v = Number(raw);
                if (Number.isFinite(v)) setInput((prev) => ({ ...prev, currentGapOverride: v }));
              }}
              className="rounded-md border border-panel-border bg-panel px-3 py-1.5 text-sm text-ink focus:border-accent focus:outline-none"
            />
            <span className="text-[10px] text-ink-faint">Blank = latest sample gap ({fmtNumber(cur.gap, 2)}).</span>
          </label>
          <div className="flex flex-col gap-1">
            <ChipMultiSelect
              label="Session Filter"
              options={sessionOptions}
              selected={input.sessions}
              onChange={(next) => setInput((prev) => ({ ...prev, sessions: next }))}
            />
            <span className="text-[10px] text-ink-faint">Empty = all sessions.</span>
          </div>
        </div>
      </section>

      {ctx.windowCapped && (
        <section className="card flex items-start gap-3 border-warning/40 bg-warning/10 p-4">
          <AlertIcon className="mt-0.5 text-base text-warning" />
          <p className="text-sm leading-relaxed text-ink-muted">
            The selected window of <span className="font-semibold text-warning">{fmtInt(ctx.windowDays)} days</span> exceeds the
            advisory maximum of {fmtInt(ctx.maxWindowDays)} days. Gold Spot vs Gold Futures naturally converge toward expiry, so
            older gaps may not represent the current contract. Long windows are descriptive only and shown because you requested them.
          </p>
        </section>
      )}

      {ctx.windowDayCount > 0 && (
        <p className="text-[11px] text-ink-faint">
          Window: {ctx.windowStartDay} → {ctx.windowEndDay} · {fmtInt(ctx.windowDayCount)} trading days · {fmtInt(ctx.windowSampleCount)} samples.
          Current sample: {cur.day} {cur.time}.
          {ctx.currentGapIsOverride ? ' Current gap is a manual override.' : ''}
        </p>
      )}

      {/* Summary cards */}
      <section>
        <h2 className="stat-label mb-2">Context Summary</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <StatCard label="Current Gap" tone="accent" value={fmtNumber(cur.gap, 2)} hint={ctx.currentGapIsOverride ? 'manual override' : `session ${cur.session}`} />
          <StatCard
            label="Gap Percentile (recent)"
            tone={ctx.gapPercentileRecent >= 80 ? 'negative' : ctx.gapPercentileRecent <= 20 ? 'positive' : 'warning'}
            value={`${Math.round(ctx.gapPercentileRecent)}%`}
            tooltip="Share of recent observations below the current gap."
          />
          <StatCard label="Recent Average Gap" value={fmtNumber(ctx.recentAvgGap, 2)} hint={`median ${fmtNumber(ctx.recentMedianGap, 2)}`} />
          <StatCard label="Recent Volatility" value={fmtNumber(ctx.recentVolatility, 3)} tooltip="Standard deviation of gaps over the research window (gap points)." />
          <StatCard
            label="Relative Volatility"
            tone={ctx.relativeVolatility != null && ctx.relativeVolatility >= 1.15 ? 'negative' : ctx.relativeVolatility != null && ctx.relativeVolatility <= 0.85 ? 'positive' : 'warning'}
            value={ctx.relativeVolatility != null ? `${fmtNumber(ctx.relativeVolatility, 2)}×` : '—'}
            hint={`avg daily ${fmtNumber(ctx.averageDailyVolatility, 3)}`}
            tooltip="Recent volatility ÷ average daily volatility within the window."
          />
          <StatCard label="Contract Age" value={ctx.contract ? `${fmtInt(ctx.contract.ageDays)}d` : '—'} hint={ctx.contract?.symbol} tooltip="Trading days the current contract has been active in the uploaded data." />
        </div>
      </section>

      {/* Market regime + percentile + expansion/compression */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className={['card border p-5', TONE_BG[REGIME_TONE[ctx.marketRegime.kind]]].join(' ')}>
          <div className="stat-label mb-1">Market Regime</div>
          <div className={['text-lg font-semibold', TONE_TEXT[REGIME_TONE[ctx.marketRegime.kind]]].join(' ')}>{ctx.marketRegime.kind}</div>
          <p className="mt-2 text-[12px] leading-relaxed text-ink-muted">{ctx.marketRegime.reason}</p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-ink-muted">
            <div>Gap: <span className="text-ink">{ctx.regime.gapState}</span></div>
            <div>Volatility: <span className="text-ink">{ctx.regime.volState}</span></div>
          </div>
          <p className="mt-2 text-[11px] text-ink-faint">Deterministic: Normal · Expansion · Compression · Transition.</p>
        </div>

        <div className="card p-5">
          <div className="stat-label mb-2">Historical Position</div>
          <div className="mb-1 flex items-baseline justify-between">
            <span className="font-mono text-2xl font-semibold text-ink">{Math.round(ctx.gapPercentileRecent)}%</span>
            <span className="text-[11px] text-ink-faint">of recent observations are below the current gap</span>
          </div>
          <div className="relative mt-3 h-3 w-full rounded-full bg-panel-border">
            <div className="absolute left-0 top-0 h-full rounded-full bg-accent/40" style={{ width: `${ctx.gapPercentileRecent}%` }} />
            <div className="absolute top-1/2 h-5 w-1 -translate-x-1/2 -translate-y-1/2 rounded bg-ink" style={{ left: `${ctx.gapPercentileRecent}%` }} />
          </div>
          <div className="mt-3 text-[11px] text-ink-faint">
            Across all uploaded history: larger than {Math.round(ctx.gapPercentileAll)}% of observations.
          </div>
        </div>

        <div className="card p-5">
          <div className="stat-label mb-2">Gap Expansion / Compression</div>
          <div className="mb-2 text-lg font-semibold capitalize text-ink">{ctx.trend}</div>
          <div className="space-y-2 text-[11px]">
            <div>
              <div className="mb-0.5 flex justify-between"><span className="text-ink-faint">Expansion moves</span><span className="font-mono text-warning">{fmtPercent(ctx.expansionPct)}</span></div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-panel-border"><div className="h-full rounded-full bg-warning" style={{ width: `${ctx.expansionPct}%` }} /></div>
            </div>
            <div>
              <div className="mb-0.5 flex justify-between"><span className="text-ink-faint">Compression moves</span><span className="font-mono text-positive">{fmtPercent(ctx.compressionPct)}</span></div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-panel-border"><div className="h-full rounded-full bg-positive" style={{ width: `${ctx.compressionPct}%` }} /></div>
            </div>
            <div className="text-ink-faint">Avg movement per step: <span className="font-mono text-ink-muted">{fmtNumber(ctx.recentMovement, 3)}</span></div>
          </div>
        </div>
      </section>

      {/* Recent gap distribution percentiles */}
      {dist && (
        <section className="card p-5">
          <header className="mb-3 flex items-center gap-2">
            <GaugeIcon className="text-base text-accent" />
            <h3 className="text-sm font-semibold uppercase tracking-wide text-ink">Recent Gap Distribution</h3>
            <span className="ml-auto text-[11px] text-ink-faint">percentiles within the research window</span>
          </header>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
            {distRows.map((d) => (
              <div key={d.label} className="rounded-md border border-panel-border bg-panel px-3 py-2">
                <div className="stat-label">{d.label}</div>
                <div className="font-mono text-base font-semibold text-ink">{fmtNumber(d.value, 2)}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Histogram + session distribution */}
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="card p-5">
          <header className="mb-3 flex items-center gap-2">
            <ChartIcon className="text-base text-accent" />
            <h3 className="text-sm font-semibold uppercase tracking-wide text-ink">Gap Histogram</h3>
            <span className="ml-auto text-[11px] text-ink-faint">current bin highlighted</span>
          </header>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={histData} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="label" {...AXIS} interval={2} angle={-30} textAnchor="end" height={40} />
                <YAxis {...AXIS} width={34} allowDecimals={false} />
                <Tooltip {...TOOLTIP} formatter={(v: number) => [`${v} samples`, '']} labelFormatter={(l) => `gap ≈ ${l}`} />
                <Bar dataKey="count" radius={[2, 2, 0, 0]} isAnimationActive={false}>
                  {histData.map((d, i) => (
                    <Cell key={i} fill={d.containsCurrent ? '#38bdf8' : '#334155'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-5">
          <header className="mb-3 flex items-center gap-2">
            <ChartIcon className="text-base text-accent" />
            <h3 className="text-sm font-semibold uppercase tracking-wide text-ink">Session Comparison</h3>
            <span className="ml-auto text-[11px] text-ink-faint">std dev of gap per session</span>
          </header>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sessionData} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" {...AXIS} />
                <YAxis {...AXIS} width={40} />
                <Tooltip {...TOOLTIP} formatter={(v: number, n) => [fmtNumber(v, 3), n === 'volatility' ? 'Volatility' : 'Avg gap']} />
                <Bar dataKey="volatility" radius={[2, 2, 0, 0]} isAnimationActive={false}>
                  {sessionData.map((d, i) => (
                    <Cell key={i} fill={d.name === cur.session ? '#38bdf8' : '#334155'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Volatility distribution over the window */}
      {volData.length > 1 && (
        <section className="card p-5">
          <header className="mb-3 flex items-center gap-2">
            <ChartIcon className="text-base text-accent" />
            <h3 className="text-sm font-semibold uppercase tracking-wide text-ink">Volatility Distribution</h3>
            <span className="ml-auto text-[11px] text-ink-faint">per-day gap volatility across the window</span>
          </header>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={volData} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="day" {...AXIS} />
                <YAxis {...AXIS} width={40} />
                <Tooltip {...TOOLTIP} formatter={(v: number) => [fmtNumber(v, 3), 'Volatility']} labelFormatter={(l) => `day ${l}`} />
                <Line type="monotone" dataKey="volatility" stroke="#38bdf8" strokeWidth={2} dot={{ r: 2, fill: '#38bdf8' }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-[11px] text-ink-faint">
            Average daily volatility {fmtNumber(ctx.averageDailyVolatility, 3)} · recent volatility {fmtNumber(ctx.recentVolatility, 3)} ({Math.round(ctx.volPercentile)}th percentile of daily values).
          </p>
        </section>
      )}

      {/* Context summary observations */}
      <section className="card p-5">
        <header className="mb-3 flex items-center gap-2">
          <AlertIcon className="text-base text-accent" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink">Context Summary</h2>
          <span className="ml-auto text-[11px] text-ink-faint">objective description</span>
        </header>
        <ul className="space-y-2">
          {ctx.observations.map((o, i) => (
            <li key={i} className="flex items-start gap-2 text-sm leading-relaxed text-ink-muted">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent/70" />
              <span>{o}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11px] text-ink-faint">
          Statistical context from uploaded CSV history only. The Market Context
          Engine never predicts future movement and never recommends a trade.
        </p>
      </section>
    </div>
  );
}
