/**
 * Strategy Ranking charts (Phase 11D) — visualization of stored, ranked
 * historical results. No calculation here; data comes from the ranking result.
 */

import { useMemo, type ReactNode } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Scatter,
  ScatterChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import type { RankingResult } from '@/utils/strategyRanking';
import { ChartIcon } from '@/components/common/icons';

const AXIS = {
  tick: { fill: '#64748b', fontSize: 11 },
  tickLine: false,
  axisLine: { stroke: '#1e293b' },
} as const;

const TOOLTIP = {
  contentStyle: { background: '#111a2c', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 },
  labelStyle: { color: '#94a3b8' },
  itemStyle: { color: '#e2e8f0' },
} as const;

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="card p-5">
      <header className="mb-3 flex items-center gap-2">
        <ChartIcon className="text-base text-accent" />
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-ink">{title}</h3>
          {subtitle ? <p className="text-[11px] text-ink-faint">{subtitle}</p> : null}
        </div>
      </header>
      <div className="h-60 w-full">{children}</div>
    </section>
  );
}

function scoreColor(s: number): string {
  if (s >= 70) return '#34d399';
  if (s >= 45) return '#fbbf24';
  return '#f87171';
}

export function RankingCharts({ result }: { result: RankingResult }) {
  const top20 = useMemo(
    () =>
      result.ranked.slice(0, 20).map((s) => ({
        label: `#${s.rank}`,
        id: s.record.id,
        score: Math.round(s.scores.overall * 10) / 10,
      })),
    [result.ranked],
  );

  const recoveryVsSlHit = useMemo(
    () =>
      result.ranked.map((s) => ({
        x: s.record.slHitPct,
        y: s.record.recoveryBeforeSlPct,
        z: s.scores.overall,
        id: s.record.id,
      })),
    [result.ranked],
  );

  const tradesVsRecovery = useMemo(
    () =>
      result.ranked.map((s) => ({
        x: s.record.historicalTrades,
        y: s.record.recoveryBeforeSlPct,
        z: s.scores.overall,
        id: s.record.id,
      })),
    [result.ranked],
  );

  const timeVsScore = useMemo(
    () =>
      result.ranked
        .filter((s) => s.record.avgRecoverySec !== null)
        .map((s) => ({
          x: Math.round(((s.record.avgRecoverySec as number) / 60) * 10) / 10,
          y: Math.round(s.scores.overall * 10) / 10,
          z: s.record.recoveryBeforeSlPct,
          id: s.record.id,
        })),
    [result.ranked],
  );

  if (result.ranked.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <Card title="Top 20 Overall Score" subtitle="Historical score by rank">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={top20} margin={{ top: 8, right: 12, bottom: 0, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="label" {...AXIS} interval={0} angle={-40} textAnchor="end" height={40} />
            <YAxis {...AXIS} width={40} domain={[0, 100]} />
            <Tooltip
              {...TOOLTIP}
              cursor={{ fill: 'rgba(56,189,248,0.08)' }}
              labelFormatter={(v) => `Rank ${String(v).replace('#', '')}`}
              formatter={(val: number, _n, p) => [`${val} score`, (p?.payload as { id?: string })?.id ?? '']}
            />
            <Bar dataKey="score" radius={[2, 2, 0, 0]} isAnimationActive={false}>
              {top20.map((d, i) => (
                <Cell key={i} fill={scoreColor(d.score)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card title="Recovery vs SL Hit" subtitle="Recovery before SL (%) against SL hit (%)">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 8, right: 12, bottom: 4, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis type="number" dataKey="x" name="SL Hit %" unit="%" domain={[0, 100]} {...AXIS} />
            <YAxis type="number" dataKey="y" name="Recovery %" unit="%" domain={[0, 100]} width={40} {...AXIS} />
            <ZAxis type="number" dataKey="z" range={[30, 220]} name="Score" />
            <Tooltip
              {...TOOLTIP}
              cursor={{ strokeDasharray: '3 3' }}
              formatter={(val: number, name: string) => [name === 'Score' ? `${val.toFixed(1)}` : `${val.toFixed(1)}%`, name]}
            />
            <Scatter data={recoveryVsSlHit} fill="#38bdf8" fillOpacity={0.65} isAnimationActive={false} />
          </ScatterChart>
        </ResponsiveContainer>
      </Card>

      <Card title="Trades vs Recovery" subtitle="Historical trades against recovery before SL (%)">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 8, right: 12, bottom: 4, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis type="number" dataKey="x" name="Trades" {...AXIS} />
            <YAxis type="number" dataKey="y" name="Recovery %" unit="%" domain={[0, 100]} width={40} {...AXIS} />
            <ZAxis type="number" dataKey="z" range={[30, 220]} name="Score" />
            <Tooltip
              {...TOOLTIP}
              cursor={{ strokeDasharray: '3 3' }}
              formatter={(val: number, name: string) => [name === 'Recovery %' ? `${val.toFixed(1)}%` : `${val.toFixed(1)}`, name]}
            />
            <Scatter data={tradesVsRecovery} fill="#a78bfa" fillOpacity={0.65} isAnimationActive={false} />
          </ScatterChart>
        </ResponsiveContainer>
      </Card>

      <Card title="Average Recovery Time vs Score" subtitle="Avg recovery (min) against overall score">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 8, right: 12, bottom: 4, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis type="number" dataKey="x" name="Avg Recovery" unit="m" {...AXIS} />
            <YAxis type="number" dataKey="y" name="Score" domain={[0, 100]} width={40} {...AXIS} />
            <ZAxis type="number" dataKey="z" range={[30, 220]} name="Recovery %" />
            <Tooltip
              {...TOOLTIP}
              cursor={{ strokeDasharray: '3 3' }}
              formatter={(val: number, name: string) => [name === 'Avg Recovery' ? `${val} min` : name === 'Recovery %' ? `${val.toFixed(1)}%` : `${val}`, name]}
            />
            <Scatter data={timeVsScore} fill="#fbbf24" fillOpacity={0.65} isAnimationActive={false} />
          </ScatterChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}
