/**
 * Top Trade Finder charts (additive): compression, entry-vs-exit, adverse
 * expansion and holding time across the ranked opportunities.
 */

import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { TopTradeOpportunity } from '@/utils/topTrades';
import { ChartIcon } from '@/components/common/icons';

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
} as const;

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card p-5">
      <header className="mb-3 flex items-center gap-2">
        <ChartIcon className="text-base text-accent" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink">
          {title}
        </h2>
      </header>
      <div className="h-60 w-full">{children}</div>
    </section>
  );
}

export function TopTradeCharts({ trades }: { trades: TopTradeOpportunity[] }) {
  const data = useMemo(
    () =>
      trades.map((t) => ({
        rank: `#${t.rank}`,
        compression: Math.round(t.compression * 1000) / 1000,
        entryGap: Math.round(t.entryGap * 1000) / 1000,
        exitGap: Math.round(t.exitGap * 1000) / 1000,
        adverseExpansion: Math.round(t.adverseExpansion * 1000) / 1000,
        holdingMin: t.holdingSec !== null ? Math.round((t.holdingSec / 60) * 10) / 10 : 0,
      })),
    [trades],
  );

  if (trades.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      <ChartCard title="Compression by Trade">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="rank" {...AXIS} />
            <YAxis {...AXIS} width={44} />
            <Tooltip {...TOOLTIP} cursor={{ fill: 'rgba(52,211,153,0.08)' }} formatter={(v: number) => [v.toFixed(3), 'Compression']} />
            <Bar dataKey="compression" fill="#34d399" radius={[3, 3, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Entry vs Exit Gap">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="rank" {...AXIS} />
            <YAxis {...AXIS} width={48} domain={['auto', 'auto']} />
            <Tooltip {...TOOLTIP} cursor={{ fill: 'rgba(56,189,248,0.08)' }} formatter={(v: number, n: string) => [v.toFixed(3), n]} />
            <Legend wrapperStyle={{ fontSize: 12 }} iconType="square" />
            <Bar dataKey="entryGap" name="Entry gap" fill="#f87171" radius={[3, 3, 0, 0]} isAnimationActive={false} />
            <Bar dataKey="exitGap" name="Exit gap" fill="#34d399" radius={[3, 3, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Adverse Expansion by Trade">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="rank" {...AXIS} />
            <YAxis {...AXIS} width={44} />
            <Tooltip {...TOOLTIP} cursor={{ fill: 'rgba(248,113,113,0.08)' }} formatter={(v: number) => [v.toFixed(3), 'Adverse exp.']} />
            <Bar dataKey="adverseExpansion" fill="#f87171" radius={[3, 3, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Holding Time by Trade (min)">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="rank" {...AXIS} />
            <YAxis {...AXIS} width={44} />
            <Tooltip {...TOOLTIP} cursor={{ fill: 'rgba(251,191,36,0.08)' }} formatter={(v: number) => [`${v} min`, 'Holding']} />
            <Bar dataKey="holdingMin" fill="#fbbf24" radius={[3, 3, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
