/**
 * Market Intelligence — Market Context Engine v1.0 (Phase 13).
 *
 * A descriptive statistical snapshot of the CURRENT market context from
 * uploaded CSV history over a recent research window. It never predicts,
 * recommends or signals — it only describes where the current gap sits, the
 * recent regime, volatility, session and contract context.
 */

import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useData } from '@/context/DataContext';
import {
  buildMarketContext,
  DEFAULT_MARKET_CONTEXT_INPUT,
  type MarketContextInput,
  type RegimeTone,
} from '@/utils/marketContext';
import { StatCard } from '@/components/overview/StatCard';
import { EmptyState } from '@/components/common/EmptyState';
import { fmtInt, fmtNumber, fmtPercent } from '@/utils/format';
import { AlertIcon, ChartIcon, GaugeIcon } from '@/components/common/icons';

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
  const { dataset } = useData();
  const [input, setInput] = useState<MarketContextInput>(DEFAULT_MARKET_CONTEXT_INPUT);

  const samples = dataset?.samples ?? [];
  const ctx = useMemo(() => buildMarketContext(samples, input), [samples, input]);

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

  return (
    <div className="space-y-5">
      {/* Disclaimer + status + window control */}
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
        <label className="flex flex-col gap-1">
          <span className="stat-label">Research Window (days)</span>
          <input
            type="number"
            min={1}
            step={1}
            value={input.windowDays}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v) && v > 0) setInput({ windowDays: Math.round(v) });
            }}
            className="w-32 rounded-md border border-panel-border bg-panel px-3 py-1.5 text-sm text-ink focus:border-accent focus:outline-none"
          />
        </label>
      </section>

      {ctx.windowDayCount > 0 && (
        <p className="text-[11px] text-ink-faint">
          Window: {ctx.windowStartDay} → {ctx.windowEndDay} · {fmtInt(ctx.windowDayCount)} trading days · {fmtInt(ctx.windowSampleCount)} samples.
          Current sample: {cur.day} {cur.time}.
        </p>
      )}

      {/* Summary cards */}
      <section>
        <h2 className="stat-label mb-2">Context Summary</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <StatCard label="Current Gap" tone="accent" value={fmtNumber(cur.gap, 2)} hint={`session ${cur.session}`} />
          <StatCard
            label="Gap Percentile (recent)"
            tone={ctx.gapPercentileRecent >= 80 ? 'negative' : ctx.gapPercentileRecent <= 20 ? 'positive' : 'warning'}
            value={`${Math.round(ctx.gapPercentileRecent)}%`}
            tooltip="Share of recent observations below the current gap."
          />
          <StatCard label="Recent Average Gap" value={fmtNumber(ctx.recentAvgGap, 2)} hint={`median ${fmtNumber(ctx.recentMedianGap, 2)}`} />
          <StatCard label="Recent Volatility" value={fmtNumber(ctx.recentVolatility, 3)} tooltip="Standard deviation of gaps over the research window (gap points)." />
          <StatCard label="Current Session" value={cur.session} hint={ctx.sessionContext?.aboveAverage ? 'above-avg volatility' : 'around/below-avg volatility'} />
          <StatCard label="Contract Age" value={ctx.contract ? `${fmtInt(ctx.contract.ageDays)}d` : '—'} hint={ctx.contract?.symbol} tooltip="Trading days the current contract has been active in the uploaded data." />
        </div>
      </section>

      {/* Regime + percentile + trend */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className={['card border p-5', TONE_BG[ctx.regime.tone]].join(' ')}>
          <div className="stat-label mb-1">Current Regime</div>
          <div className={['text-lg font-semibold', TONE_TEXT[ctx.regime.tone]].join(' ')}>{ctx.regime.label}</div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-ink-muted">
            <div>Gap: <span className="text-ink">{ctx.regime.gapState}</span></div>
            <div>Volatility: <span className="text-ink">{ctx.regime.volState}</span></div>
          </div>
          <p className="mt-2 text-[11px] text-ink-faint">Deterministic classification from recent gap percentile and volatility percentile.</p>
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

      {/* Histogram + session distribution */}
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="card p-5">
          <header className="mb-3 flex items-center gap-2">
            <ChartIcon className="text-base text-accent" />
            <h3 className="text-sm font-semibold uppercase tracking-wide text-ink">Recent Gap Distribution</h3>
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
            <h3 className="text-sm font-semibold uppercase tracking-wide text-ink">Session Volatility (recent)</h3>
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
