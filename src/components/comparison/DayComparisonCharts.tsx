/**
 * Day comparison charts (Phase R2, feature #4).
 *
 *  - Daily average gap     → line chart
 *  - Daily max gap         → bar chart
 *  - Daily sample count    → bar chart
 *
 * All three read the per-day stats derived from `filteredSamples`.
 */

import { useMemo, type ReactNode } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useData } from '@/context/DataContext';
import { computeDayStats } from '@/utils/dayAnalysis';
import { ChartIcon } from '@/components/common/icons';

const AXIS = {
  tick: { fill: '#64748b', fontSize: 11 },
  tickLine: false,
  axisLine: { stroke: '#1e293b' },
} as const;

const TOOLTIP_STYLE = {
  contentStyle: {
    background: '#111a2c',
    border: '1px solid #1e293b',
    borderRadius: 8,
    fontSize: 12,
  },
  labelStyle: { color: '#94a3b8' },
} as const;

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="card p-4">
      <header className="mb-2 flex items-center gap-2">
        <ChartIcon className="text-sm text-accent" />
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ink">
          {title}
        </h3>
      </header>
      <div className="h-56 w-full">{children}</div>
    </div>
  );
}

export function DayComparisonCharts() {
  const { filteredSamples } = useData();

  const data = useMemo(() => {
    return computeDayStats(filteredSamples).map((d) => ({
      day: d.day,
      avgGap: d.avgGap ?? 0,
      maxGap: d.maxGap ?? 0,
      samples: d.samples,
    }));
  }, [filteredSamples]);

  if (data.length === 0) {
    return (
      <section className="card p-6 text-center text-sm text-ink-muted">
        No day-level data to compare for the current selection.
      </section>
    );
  }

  return (
    <section className="grid grid-cols-1 gap-3 xl:grid-cols-3">
      <ChartCard title="Daily Average Gap">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="day" {...AXIS} minTickGap={16} />
            <YAxis {...AXIS} width={52} domain={['auto', 'auto']} />
            <Tooltip
              {...TOOLTIP_STYLE}
              formatter={(v: number) => [v.toFixed(3), 'Avg Gap']}
            />
            <Line
              type="monotone"
              dataKey="avgGap"
              stroke="#38bdf8"
              strokeWidth={2}
              dot={{ r: 2, fill: '#38bdf8' }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Daily Max Gap">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="day" {...AXIS} minTickGap={16} />
            <YAxis {...AXIS} width={52} domain={['auto', 'auto']} />
            <Tooltip
              {...TOOLTIP_STYLE}
              cursor={{ fill: 'rgba(56,189,248,0.08)' }}
              formatter={(v: number) => [v.toFixed(3), 'Max Gap']}
            />
            <Bar dataKey="maxGap" fill="#34d399" radius={[3, 3, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Daily Sample Count">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="day" {...AXIS} minTickGap={16} />
            <YAxis {...AXIS} width={52} allowDecimals={false} />
            <Tooltip
              {...TOOLTIP_STYLE}
              cursor={{ fill: 'rgba(56,189,248,0.08)' }}
              formatter={(v: number) => [v.toLocaleString(), 'Samples']}
            />
            <Bar dataKey="samples" fill="#fbbf24" radius={[3, 3, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </section>
  );
}
