/**
 * Stop Loss Optimizer charts (visualization only).
 *
 * Five institutional charts driven entirely by the already-computed optimizer
 * rows. Every chart supports hover tooltips, a legend, brush-zoom and PNG
 * export. Nothing is recalculated here.
 */

import { useMemo, useRef, type ReactNode } from 'react';
import {
  Area,
  Brush,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { SlOptimizerResult } from '@/utils/slOptimizer';
import { ChartIcon, ImageIcon } from '@/components/common/icons';
import { exportChartPng } from '@/utils/chartExport';
import { SERIES_COLORS } from '@/components/sloptimizer/metrics';

const AXIS = {
  tick: { fill: '#64748b', fontSize: 11 },
  tickLine: false,
  axisLine: { stroke: '#1e293b' },
} as const;

const TOOLTIP = {
  contentStyle: {
    background: '#111a2c',
    border: '1px solid #1e293b',
    borderRadius: 8,
    fontSize: 12,
  },
  labelStyle: { color: '#94a3b8' },
  itemStyle: { color: '#e2e8f0' },
} as const;

const LEGEND = { wrapperStyle: { fontSize: 11, paddingTop: 4 } } as const;
const BRUSH = {
  height: 18,
  stroke: '#334155',
  fill: '#0f1b30',
  travellerWidth: 8,
} as const;

function ChartCard({
  title,
  subtitle,
  filename,
  children,
}: {
  title: string;
  subtitle?: string;
  filename: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <section className="card p-5 transition-shadow hover:shadow-lg hover:shadow-black/20">
      <header className="mb-3 flex items-center gap-2">
        <ChartIcon className="text-base text-accent" />
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold uppercase tracking-wide text-ink">
            {title}
          </h3>
          {subtitle ? <p className="text-[11px] text-ink-faint">{subtitle}</p> : null}
        </div>
        <button
          type="button"
          onClick={() => exportChartPng(ref.current, filename)}
          className="btn ml-auto flex items-center gap-1.5 px-2 py-1 text-xs"
          title="Export this chart as PNG"
        >
          <ImageIcon className="text-sm" />
          PNG
        </button>
      </header>
      <div ref={ref} className="h-64 w-full">
        {children}
      </div>
    </section>
  );
}

export function SlOptimizerCharts({ result }: { result: SlOptimizerResult }) {
  const data = useMemo(
    () =>
      result.rows.map((r) => ({
        sl: r.stopLoss,
        recBefore: r.recoveryBeforeSlPct,
        recAfter: r.recoveryAfterSlPct,
        recIgnoring: r.recoveryIgnoringSlPct,
        slHit: r.slHitPct,
        avgRecMin: r.avgRecoverySec !== null ? round1(r.avgRecoverySec / 60) : null,
        medRecMin:
          r.medianRecoverySec !== null ? round1(r.medianRecoverySec / 60) : null,
        avgGap: r.avgMaxGap ?? null,
        p95Gap: r.p95MaxGap ?? null,
        worstGap: r.worstMaxGap ?? null,
        score: r.score,
      })),
    [result.rows],
  );

  const balancedSl = result.balanced?.stopLoss ?? null;

  const xProps = {
    dataKey: 'sl',
    type: 'number' as const,
    domain: ['dataMin', 'dataMax'] as [string, string],
    tickFormatter: (v: number) => v.toFixed(2),
    minTickGap: 24,
    ...AXIS,
  };

  const balLine =
    balancedSl !== null ? (
      <ReferenceLine
        x={balancedSl}
        stroke={SERIES_COLORS.balanced}
        strokeDasharray="4 3"
        label={{ value: 'Balanced', fill: SERIES_COLORS.balanced, fontSize: 10, position: 'top' }}
      />
    ) : null;

  if (data.length === 0) return null;

  const slLabel = (v: number | string) => `SL ${Number(v).toFixed(2)}`;

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      {/* CHART 1 — Recovery % vs Stop Loss (3 series) */}
      <ChartCard
        title="Recovery % vs Stop Loss"
        subtitle="Before SL · After SL · Ignoring SL"
        filename="recovery-vs-stoploss"
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 12, bottom: 0, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis {...xProps} />
            <YAxis {...AXIS} width={44} domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} />
            <Tooltip
              {...TOOLTIP}
              labelFormatter={slLabel}
              formatter={(v: number, name: string) => [`${v.toFixed(1)}%`, name]}
            />
            <Legend {...LEGEND} />
            {balLine}
            <Line name="Before SL" type="monotone" dataKey="recBefore" stroke={SERIES_COLORS.recoveryBefore} strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line name="After SL" type="monotone" dataKey="recAfter" stroke={SERIES_COLORS.recoveryAfter} strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line name="Ignoring SL" type="monotone" dataKey="recIgnoring" stroke={SERIES_COLORS.recoveryIgnoring} strokeWidth={2} strokeDasharray="5 3" dot={false} isAnimationActive={false} />
            <Brush dataKey="sl" tickFormatter={(v: number) => v.toFixed(2)} {...BRUSH} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* CHART 2 — SL Hit % vs Stop Loss */}
      <ChartCard
        title="SL Hit % vs Stop Loss"
        subtitle="How often the stop-loss was reached"
        filename="slhit-vs-stoploss"
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 12, bottom: 0, left: -10 }}>
            <defs>
              <linearGradient id="slHitFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={SERIES_COLORS.slHit} stopOpacity={0.35} />
                <stop offset="100%" stopColor={SERIES_COLORS.slHit} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis {...xProps} />
            <YAxis {...AXIS} width={44} domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} />
            <Tooltip {...TOOLTIP} labelFormatter={slLabel} formatter={(v: number) => [`${v.toFixed(1)}%`, 'SL Hit']} />
            <Legend {...LEGEND} />
            {balLine}
            <Area name="SL Hit %" type="monotone" dataKey="slHit" stroke={SERIES_COLORS.slHit} strokeWidth={2} fill="url(#slHitFill)" isAnimationActive={false} />
            <Brush dataKey="sl" tickFormatter={(v: number) => v.toFixed(2)} {...BRUSH} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* CHART 3 — Recovery time (avg + median) vs Stop Loss */}
      <ChartCard
        title="Recovery Time vs Stop Loss"
        subtitle="Average and median, in minutes"
        filename="recovery-time-vs-stoploss"
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 12, bottom: 0, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis {...xProps} />
            <YAxis {...AXIS} width={44} tickFormatter={(v: number) => `${v}m`} />
            <Tooltip {...TOOLTIP} labelFormatter={slLabel} formatter={(v: number, name: string) => [`${v} min`, name]} />
            <Legend {...LEGEND} />
            {balLine}
            <Line name="Average" type="monotone" dataKey="avgRecMin" stroke={SERIES_COLORS.avgRecovery} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
            <Line name="Median" type="monotone" dataKey="medRecMin" stroke={SERIES_COLORS.medianRecovery} strokeWidth={2} strokeDasharray="5 3" dot={false} connectNulls isAnimationActive={false} />
            <Brush dataKey="sl" tickFormatter={(v: number) => v.toFixed(2)} {...BRUSH} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* CHART 4 — Maximum gap (avg, p95, worst) vs Stop Loss */}
      <ChartCard
        title="Maximum Gap vs Stop Loss"
        subtitle="Average · P95 · Worst adverse gap"
        filename="maxgap-vs-stoploss"
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 12, bottom: 0, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis {...xProps} />
            <YAxis {...AXIS} width={48} domain={['auto', 'auto']} />
            <Tooltip {...TOOLTIP} labelFormatter={slLabel} formatter={(v: number, name: string) => [v.toFixed(3), name]} />
            <Legend {...LEGEND} />
            {balLine}
            <Line name="Average" type="monotone" dataKey="avgGap" stroke={SERIES_COLORS.avgGap} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
            <Line name="P95" type="monotone" dataKey="p95Gap" stroke={SERIES_COLORS.p95Gap} strokeWidth={2} strokeDasharray="5 3" dot={false} connectNulls isAnimationActive={false} />
            <Line name="Worst" type="monotone" dataKey="worstGap" stroke={SERIES_COLORS.worstGap} strokeWidth={2} strokeDasharray="2 2" dot={false} connectNulls isAnimationActive={false} />
            <Brush dataKey="sl" tickFormatter={(v: number) => v.toFixed(2)} {...BRUSH} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* CHART 5 — Overall Score vs Stop Loss */}
      <ChartCard
        title="Overall Score vs Stop Loss"
        subtitle="Phase 10A composite score (descriptive)"
        filename="score-vs-stoploss"
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 12, bottom: 0, left: -10 }}>
            <defs>
              <linearGradient id="scoreFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={SERIES_COLORS.score} stopOpacity={0.3} />
                <stop offset="100%" stopColor={SERIES_COLORS.score} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis {...xProps} />
            <YAxis {...AXIS} width={44} domain={[0, 100]} />
            <Tooltip {...TOOLTIP} labelFormatter={slLabel} formatter={(v: number) => [v.toFixed(1), 'Score']} />
            <Legend {...LEGEND} />
            {balLine}
            <Area name="Overall Score" type="monotone" dataKey="score" stroke={SERIES_COLORS.score} strokeWidth={2} fill="url(#scoreFill)" isAnimationActive={false} />
            <Brush dataKey="sl" tickFormatter={(v: number) => v.toFixed(2)} {...BRUSH} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
