/**
 * Research Lab charts (additive): outcome bars, SL sensitivity line, and the
 * max-adverse-gap distribution.
 */

import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  OUTCOME_LABELS,
  OUTCOME_ORDER,
  type ScenarioEvent,
  type ScenarioResult,
  type SensitivityRow,
} from '@/utils/scenario';
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
      <div className="h-64 w-full">{children}</div>
    </section>
  );
}

const OUTCOME_FILL: Record<string, string> = {
  RECOVERED_WITHOUT_SL: '#34d399',
  RECOVERED_AFTER_SL: '#fbbf24',
  SL_HIT: '#f87171',
  DAY_END_NO_RESOLUTION: '#64748b',
  MAX_HOLDING_NO_RESOLUTION: '#64748b',
  DATASET_END_NO_RESOLUTION: '#475569',
};

function buildAdverseBins(events: ScenarioEvent[], binCount = 16) {
  const values = events.map((e) => e.maxGap);
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return [{ label: min.toFixed(2), count: values.length }];
  const width = (max - min) / binCount;
  const bins = Array.from({ length: binCount }, (_, i) => ({
    label: (min + i * width).toFixed(2),
    count: 0,
  }));
  for (const v of values) {
    let idx = Math.floor((v - min) / width);
    if (idx < 0) idx = 0;
    if (idx >= binCount) idx = binCount - 1;
    bins[idx]!.count += 1;
  }
  return bins;
}

export function ScenarioCharts({
  result,
  sensitivity,
}: {
  result: ScenarioResult;
  sensitivity: SensitivityRow[];
}) {
  const outcomeData = useMemo(
    () =>
      OUTCOME_ORDER.filter((o) => result.counts[o] > 0).map((o) => ({
        outcome: OUTCOME_LABELS[o],
        key: o,
        count: result.counts[o],
      })),
    [result.counts],
  );

  const sensData = useMemo(
    () =>
      sensitivity.map((r) => ({
        sl: r.slLevel,
        recovery: r.recoveryBeforeSlPct,
        slHit: r.slHitPct,
      })),
    [sensitivity],
  );

  const adverseData = useMemo(
    () => buildAdverseBins(result.events),
    [result.events],
  );

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      <ChartCard title="Outcome Distribution">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={outcomeData} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis
              dataKey="outcome"
              {...AXIS}
              interval={0}
              angle={-12}
              textAnchor="end"
              height={48}
            />
            <YAxis {...AXIS} width={40} allowDecimals={false} />
            <Tooltip
              {...TOOLTIP}
              cursor={{ fill: 'rgba(56,189,248,0.08)' }}
              formatter={(v: number) => [v.toLocaleString(), 'Events']}
            />
            <Bar dataKey="count" radius={[3, 3, 0, 0]} isAnimationActive={false}>
              {outcomeData.map((d) => (
                <Cell key={d.key} fill={OUTCOME_FILL[d.key] ?? '#38bdf8'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Stop-Loss Sensitivity">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={sensData} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis
              dataKey="sl"
              {...AXIS}
              tickFormatter={(v: number) => v.toFixed(1)}
              minTickGap={16}
            />
            <YAxis {...AXIS} width={44} domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} />
            <Tooltip
              {...TOOLTIP}
              labelFormatter={(v) => `SL ${Number(v).toFixed(2)}`}
              formatter={(v: number, name: string) => [`${v.toFixed(1)}%`, name]}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} iconType="plainline" />
            <Line
              type="monotone"
              dataKey="recovery"
              name="Recovery before SL"
              stroke="#34d399"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="slHit"
              name="SL hit"
              stroke="#f87171"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Max Adverse Gap Distribution">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={adverseData} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="label" {...AXIS} minTickGap={8} />
            <YAxis {...AXIS} width={40} allowDecimals={false} />
            <Tooltip
              {...TOOLTIP}
              cursor={{ fill: 'rgba(248,113,113,0.08)' }}
              labelFormatter={(v) => `Max gap ≈ ${v}`}
              formatter={(v: number) => [v.toLocaleString(), 'Events']}
            />
            <Bar dataKey="count" fill="#f87171" radius={[3, 3, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
