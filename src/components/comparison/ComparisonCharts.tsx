/**
 * Strategy Comparison charts (Phase 11G) — radar, bar, scatter and outcome
 * distribution overlay. Read-only visualization of stored comparison data.
 */

import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import type { Comparison, CompStrategy } from '@/utils/strategyComparison';
import { OUTCOME_LABELS, OUTCOME_ORDER, type ConfidenceLevel } from '@/utils/scenario';
import { ChartIcon } from '@/components/common/icons';

const CONFIDENCE_ORDER: ConfidenceLevel[] = ['VERY_LOW', 'LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH'];

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

const LEGEND = { wrapperStyle: { fontSize: 11 } } as const;

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="card p-5">
      <header className="mb-3 flex items-center gap-2">
        <ChartIcon className="text-base text-accent" />
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-ink">{title}</h3>
          {subtitle ? <p className="text-[11px] text-ink-faint">{subtitle}</p> : null}
        </div>
      </header>
      <div className="h-64 w-full">{children}</div>
    </section>
  );
}

const RADAR_AXES: Array<{ axis: string; dir: 'higher' | 'lower'; get: (s: CompStrategy) => number | null }> = [
  { axis: 'Recovery Before', dir: 'higher', get: (s) => s.record.recoveryBeforeSlPct },
  { axis: 'Recovery Ignoring', dir: 'higher', get: (s) => s.record.recoveryIgnoringSlPct },
  { axis: 'SL Safety', dir: 'lower', get: (s) => s.record.slHitPct },
  { axis: 'Trades', dir: 'higher', get: (s) => s.record.historicalTrades },
  { axis: 'Speed', dir: 'lower', get: (s) => s.record.avgRecoverySec },
  { axis: 'Low Risk', dir: 'lower', get: (s) => s.record.worstMaxGap },
  { axis: 'Confidence', dir: 'higher', get: (s) => CONFIDENCE_ORDER.indexOf(s.record.confidenceLevel) },
];

function normalize(value: number | null, min: number, max: number, dir: 'higher' | 'lower'): number {
  if (value === null || !Number.isFinite(value)) return 0;
  if (max - min < 1e-9) return 50;
  const n = ((value - min) / (max - min)) * 100;
  return dir === 'higher' ? n : 100 - n;
}

export function ComparisonCharts({ comparison }: { comparison: Comparison }) {
  const { strategies } = comparison;

  const radarData = useMemo(() => {
    return RADAR_AXES.map((ax) => {
      const vals = strategies.map((s) => ax.get(s)).filter((v): v is number => v !== null && Number.isFinite(v));
      const min = vals.length ? Math.min(...vals) : 0;
      const max = vals.length ? Math.max(...vals) : 0;
      const row: Record<string, number | string> = { axis: ax.axis };
      strategies.forEach((s) => {
        row[s.letter] = Math.round(normalize(ax.get(s), min, max, ax.dir));
      });
      return row;
    });
  }, [strategies]);

  const recoveryBars = useMemo(
    () =>
      strategies.map((s) => ({
        name: s.letter,
        'Recovery Before %': round1(s.record.recoveryBeforeSlPct),
        'SL Hit %': round1(s.record.slHitPct),
      })),
    [strategies],
  );

  const outcomeBars = useMemo(() => {
    return OUTCOME_ORDER.map((oc) => {
      const row: Record<string, number | string> = { outcome: OUTCOME_LABELS[oc] };
      strategies.forEach((s) => {
        const found = s.dossier.outcomes.find((o) => o.outcome === oc);
        row[s.letter] = found ? round1(found.pct) : 0;
      });
      return row;
    }).filter((row) => strategies.some((s) => (row[s.letter] as number) > 0));
  }, [strategies]);

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <Card title="Profile Radar" subtitle="Normalized within the selection (higher is stronger)">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={radarData} outerRadius="72%">
            <PolarGrid stroke="#1e293b" />
            <PolarAngleAxis dataKey="axis" tick={{ fill: '#94a3b8', fontSize: 10 }} />
            <PolarRadiusAxis domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 9 }} angle={90} />
            {strategies.map((s) => (
              <Radar key={s.letter} name={`${s.letter} (${s.params})`} dataKey={s.letter} stroke={s.color} fill={s.color} fillOpacity={0.18} isAnimationActive={false} />
            ))}
            <Legend {...LEGEND} />
            <Tooltip {...TOOLTIP} />
          </RadarChart>
        </ResponsiveContainer>
      </Card>

      <Card title="Recovery vs SL Hit" subtitle="Recovery before SL % and SL hit % per strategy">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={recoveryBars} margin={{ top: 8, right: 12, bottom: 0, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="name" {...AXIS} />
            <YAxis {...AXIS} width={40} domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} />
            <Tooltip {...TOOLTIP} cursor={{ fill: 'rgba(56,189,248,0.08)' }} formatter={(v: number, n: string) => [`${v.toFixed(1)}%`, n]} />
            <Legend {...LEGEND} />
            <Bar dataKey="Recovery Before %" fill="#34d399" radius={[2, 2, 0, 0]} isAnimationActive={false} />
            <Bar dataKey="SL Hit %" fill="#f87171" radius={[2, 2, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card title="Recovery vs SL Hit (Scatter)" subtitle="Each point is one strategy; bubble size = trades">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 8, right: 16, bottom: 4, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis type="number" dataKey="x" name="SL Hit %" unit="%" domain={[0, 100]} {...AXIS} />
            <YAxis type="number" dataKey="y" name="Recovery %" unit="%" domain={[0, 100]} width={40} {...AXIS} />
            <ZAxis type="number" dataKey="z" range={[40, 320]} name="Trades" />
            <Tooltip {...TOOLTIP} cursor={{ strokeDasharray: '3 3' }} formatter={(v: number, n: string) => [n === 'Trades' ? `${v}` : `${v.toFixed(1)}%`, n]} />
            <Legend {...LEGEND} />
            {strategies.map((s) => (
              <Scatter
                key={s.letter}
                name={`${s.letter} (${s.params})`}
                data={[{ x: s.record.slHitPct, y: s.record.recoveryBeforeSlPct, z: s.record.historicalTrades }]}
                fill={s.color}
                isAnimationActive={false}
              />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      </Card>

      <Card title="Outcome Distribution" subtitle="Share of each historical outcome (%)">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={outcomeBars} margin={{ top: 8, right: 12, bottom: 0, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="outcome" {...AXIS} interval={0} angle={-20} textAnchor="end" height={48} />
            <YAxis {...AXIS} width={40} tickFormatter={(v: number) => `${v}%`} />
            <Tooltip {...TOOLTIP} cursor={{ fill: 'rgba(167,139,250,0.08)' }} formatter={(v: number, n: string) => [`${v.toFixed(1)}%`, n]} />
            <Legend {...LEGEND} />
            {strategies.map((s) => (
              <Bar key={s.letter} dataKey={s.letter} name={`${s.letter} (${s.params})`} fill={s.color} radius={[2, 2, 0, 0]} isAnimationActive={false} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}

function round1(n: number | null): number {
  return n === null || !Number.isFinite(n) ? 0 : Math.round(n * 10) / 10;
}
