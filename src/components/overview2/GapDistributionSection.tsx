/**
 * Section 3 — Gap Distribution charts (Overview 2.0): histogram, probability
 * density + fitted bell curve, and cumulative distribution. Reference lines for
 * mean / median / mode / P95 / P99. Pure descriptive statistics.
 */

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Brush,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartFrame } from '@/components/overview2/ChartFrame';
import { fmtNumber } from '@/utils/format';
import type { GapDistribution } from '@/utils/overviewStats';

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

function RefLines({ d }: { d: GapDistribution }) {
  const marks: Array<{ v: number | null; color: string; label: string }> = [
    { v: d.mean, color: '#38bdf8', label: 'Avg' },
    { v: d.median, color: '#34d399', label: 'Med' },
    { v: d.mode, color: '#a78bfa', label: 'Mode' },
    { v: d.p95, color: '#fbbf24', label: 'P95' },
    { v: d.p99, color: '#f87171', label: 'P99' },
  ];
  return (
    <>
      {marks.map((m) =>
        m.v !== null ? (
          <ReferenceLine
            key={m.label}
            x={m.v}
            stroke={m.color}
            strokeDasharray="4 3"
            label={{ value: m.label, fill: m.color, fontSize: 10, position: 'top' }}
          />
        ) : null,
      )}
    </>
  );
}

export function GapDistributionSection({ dist }: { dist: GapDistribution }) {
  if (dist.points.length === 0) {
    return (
      <section className="card p-6 text-center text-sm text-ink-muted">
        No gap values to chart for the current filters.
      </section>
    );
  }

  const csv = {
    columns: ['Gap', 'Count', 'Density', 'Normal', 'Cumulative %'],
    rows: dist.points.map((p) => [
      Number(p.x.toFixed(3)),
      p.count,
      Number(p.density.toFixed(6)),
      Number(p.normal.toFixed(6)),
      Number(p.cumulative.toFixed(2)),
    ]),
  };

  // Colour-code histogram bars: rare/extreme tails vs common centre.
  const barFill = (x: number): string => {
    if (dist.p99 !== null && x >= dist.p99) return '#f87171';
    if (dist.p95 !== null && x >= dist.p95) return '#fbbf24';
    return '#0ea5e9';
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="stat-label">Gap Distribution</h2>
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-ink-faint">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-accent-soft" /> Common</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-warning" /> Rare (≥P95)</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-negative" /> Extreme (≥P99)</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartFrame title="Histogram — Gap Frequency" fileBase="gap_histogram" csv={csv}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dist.points} margin={{ top: 14, right: 12, bottom: 0, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="x" type="number" domain={['dataMin', 'dataMax']} {...AXIS} tickFormatter={(v: number) => v.toFixed(1)} />
              <YAxis {...AXIS} width={48} allowDecimals={false} />
              <Tooltip {...TOOLTIP} labelFormatter={(v) => `Gap ≈ ${fmtNumber(v as number, 2)}`} formatter={(v: number) => [v.toLocaleString(), 'Count']} />
              <RefLines d={dist} />
              <Bar dataKey="count" isAnimationActive={false} radius={[2, 2, 0, 0]}>
                {dist.points.map((p) => (
                  <Cell key={p.x} fill={barFill(p.x)} />
                ))}
              </Bar>
              <Brush dataKey="x" height={16} stroke="#334155" travellerWidth={8} tickFormatter={(v: number) => v.toFixed(1)} />
            </BarChart>
          </ResponsiveContainer>
        </ChartFrame>

        <ChartFrame title="Probability Distribution + Bell Curve" fileBase="gap_pdf" csv={csv}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dist.points} margin={{ top: 14, right: 12, bottom: 0, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="x" type="number" domain={['dataMin', 'dataMax']} {...AXIS} tickFormatter={(v: number) => v.toFixed(1)} />
              <YAxis {...AXIS} width={48} />
              <Tooltip {...TOOLTIP} labelFormatter={(v) => `Gap ≈ ${fmtNumber(v as number, 2)}`} formatter={(v: number, n: string) => [v.toFixed(4), n]} />
              <RefLines d={dist} />
              <Area type="monotone" dataKey="density" name="Empirical" stroke="#38bdf8" fill="#38bdf8" fillOpacity={0.15} strokeWidth={1.5} isAnimationActive={false} />
              <Area type="monotone" dataKey="normal" name="Normal fit" stroke="#a78bfa" fill="transparent" strokeWidth={2} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartFrame>

        <ChartFrame title="Cumulative Distribution (CDF)" fileBase="gap_cdf" csv={csv} height={280}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dist.points} margin={{ top: 14, right: 12, bottom: 0, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="x" type="number" domain={['dataMin', 'dataMax']} {...AXIS} tickFormatter={(v: number) => v.toFixed(1)} />
              <YAxis {...AXIS} width={48} domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} />
              <Tooltip {...TOOLTIP} labelFormatter={(v) => `Gap ≈ ${fmtNumber(v as number, 2)}`} formatter={(v: number) => [`${(v as number).toFixed(1)}%`, 'Cumulative']} />
              <RefLines d={dist} />
              <Line type="monotone" dataKey="cumulative" stroke="#34d399" strokeWidth={2} dot={false} isAnimationActive={false} />
              <Brush dataKey="x" height={16} stroke="#334155" travellerWidth={8} tickFormatter={(v: number) => v.toFixed(1)} />
            </LineChart>
          </ResponsiveContainer>
        </ChartFrame>

        <ChartFrame title="Bell Curve (Normal Fit)" fileBase="gap_bell" csv={csv} height={280}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dist.points} margin={{ top: 14, right: 12, bottom: 0, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="x" type="number" domain={['dataMin', 'dataMax']} {...AXIS} tickFormatter={(v: number) => v.toFixed(1)} />
              <YAxis {...AXIS} width={48} />
              <Tooltip {...TOOLTIP} labelFormatter={(v) => `Gap ≈ ${fmtNumber(v as number, 2)}`} formatter={(v: number) => [v.toFixed(4), 'Normal']} />
              <RefLines d={dist} />
              <Area type="monotone" dataKey="normal" stroke="#a78bfa" fill="#a78bfa" fillOpacity={0.18} strokeWidth={2} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartFrame>
      </div>
    </section>
  );
}
