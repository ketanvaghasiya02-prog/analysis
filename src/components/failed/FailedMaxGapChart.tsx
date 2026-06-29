/**
 * Failed-event max-gap distribution chart (Phase R8).
 */

import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { buildFailedMaxGapDistribution, type FailedEvent } from '@/utils/failed';
import { ChartIcon } from '@/components/common/icons';

export function FailedMaxGapChart({ events }: { events: FailedEvent[] }) {
  const data = useMemo(
    () => buildFailedMaxGapDistribution(events),
    [events],
  );

  return (
    <section className="card p-5">
      <header className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ChartIcon className="text-base text-accent" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink">
            Failed Max Gap Distribution
          </h2>
        </div>
        <span className="text-xs text-ink-faint">max gap after entry</span>
      </header>

      {data.length === 0 ? (
        <div className="flex h-56 items-center justify-center text-sm text-ink-muted">
          No failed events to plot.
        </div>
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="label"
                tick={{ fill: '#64748b', fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: '#1e293b' }}
                minTickGap={8}
              />
              <YAxis
                tick={{ fill: '#64748b', fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: '#1e293b' }}
                width={44}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  background: '#111a2c',
                  border: '1px solid #1e293b',
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelStyle={{ color: '#94a3b8' }}
                cursor={{ fill: 'rgba(248,113,113,0.08)' }}
                labelFormatter={(v) => `Max gap ≈ ${v}`}
                formatter={(v: number) => [v.toLocaleString(), 'Failed events']}
              />
              <Bar
                dataKey="count"
                fill="#f87171"
                radius={[3, 3, 0, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
