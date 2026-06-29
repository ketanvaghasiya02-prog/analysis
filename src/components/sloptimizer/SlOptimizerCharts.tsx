/**
 * Stop Loss Optimizer charts: recovery %, recovery gain, efficiency, score,
 * holding time and max gap — all vs stop loss.
 */

import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { SlOptimizerResult } from '@/utils/slOptimizer';
import { ChartIcon } from '@/components/common/icons';

const AXIS = {
  tick: { fill: '#64748b', fontSize: 11 },
  tickLine: false,
  axisLine: { stroke: '#1e293b' },
} as const;

const TOOLTIP = {
  contentStyle: { background: '#111a2c', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 },
  labelStyle: { color: '#94a3b8' },
} as const;

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card p-5">
      <header className="mb-3 flex items-center gap-2">
        <ChartIcon className="text-base text-accent" />
        <h3 className="text-sm font-semibold uppercase tracking-wide text-ink">{title}</h3>
      </header>
      <div className="h-56 w-full">{children}</div>
    </section>
  );
}

export function SlOptimizerCharts({ result }: { result: SlOptimizerResult }) {
  const data = useMemo(
    () =>
      result.rows.map((r) => ({
        sl: r.stopLoss,
        recovery: r.recoveryBeforeSlPct,
        gain: r.recoveryGain,
        efficiency: r.efficiency,
        score: r.score,
        holding: r.avgHoldingSec !== null ? Math.round((r.avgHoldingSec / 60) * 10) / 10 : 0,
        maxGap: r.avgMaxGap ?? 0,
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
      <ReferenceLine x={balancedSl} stroke="#38bdf8" strokeDasharray="4 3" label={{ value: 'Balanced', fill: '#38bdf8', fontSize: 10, position: 'top' }} />
    ) : null;

  if (data.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <Card title="Recovery % (before SL) vs Stop Loss">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 14, right: 12, bottom: 0, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis {...xProps} />
            <YAxis {...AXIS} width={44} domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} />
            <Tooltip {...TOOLTIP} labelFormatter={(v) => `SL ${Number(v).toFixed(2)}`} formatter={(v: number) => [`${v.toFixed(1)}%`, 'Recovery before SL']} />
            {balLine}
            <Line type="monotone" dataKey="recovery" stroke="#34d399" strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <Card title="Recovery Gain vs Stop Loss">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 14, right: 12, bottom: 0, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis {...xProps} />
            <YAxis {...AXIS} width={44} />
            <Tooltip {...TOOLTIP} cursor={{ fill: 'rgba(56,189,248,0.08)' }} labelFormatter={(v) => `SL ${Number(v).toFixed(2)}`} formatter={(v: number) => [`${v.toFixed(2)}%`, 'Gain']} />
            {balLine}
            <Bar dataKey="gain" fill="#38bdf8" radius={[2, 2, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card title="Efficiency vs Stop Loss">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 14, right: 12, bottom: 0, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis {...xProps} />
            <YAxis {...AXIS} width={44} />
            <Tooltip {...TOOLTIP} labelFormatter={(v) => `SL ${Number(v).toFixed(2)}`} formatter={(v: number) => [v.toFixed(2), 'Efficiency']} />
            {balLine}
            <Line type="monotone" dataKey="efficiency" stroke="#a78bfa" strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <Card title="Score vs Stop Loss">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 14, right: 12, bottom: 0, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis {...xProps} />
            <YAxis {...AXIS} width={44} domain={[0, 100]} />
            <Tooltip {...TOOLTIP} labelFormatter={(v) => `SL ${Number(v).toFixed(2)}`} formatter={(v: number) => [v.toFixed(1), 'Score']} />
            {balLine}
            <Line type="monotone" dataKey="score" stroke="#fbbf24" strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <Card title="Holding Time vs Stop Loss (min)">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 14, right: 12, bottom: 0, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis {...xProps} />
            <YAxis {...AXIS} width={44} />
            <Tooltip {...TOOLTIP} labelFormatter={(v) => `SL ${Number(v).toFixed(2)}`} formatter={(v: number) => [`${v} min`, 'Avg holding']} />
            {balLine}
            <Line type="monotone" dataKey="holding" stroke="#f59e0b" strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <Card title="Maximum Gap vs Stop Loss">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 14, right: 12, bottom: 0, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis {...xProps} />
            <YAxis {...AXIS} width={48} domain={['auto', 'auto']} />
            <Tooltip {...TOOLTIP} labelFormatter={(v) => `SL ${Number(v).toFixed(2)}`} formatter={(v: number) => [v.toFixed(3), 'Avg max gap']} />
            {balLine}
            <Line type="monotone" dataKey="maxGap" stroke="#f87171" strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}
