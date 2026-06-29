/**
 * MAE distribution chart (Phase R6).
 *
 * Grouped bars of max-gap-after-entry, split by recovered vs failed events, so
 * you can see how far recovered events expand before coming back.
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
import { buildMaeDistribution, type ZoneMae } from '@/utils/mae';
import { ChartIcon } from '@/components/common/icons';

export function MaeDistributionChart({ zone }: { zone: ZoneMae }) {
  const data = useMemo(() => buildMaeDistribution(zone), [zone]);

  return (
    <section className="card p-5">
      <header className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ChartIcon className="text-base text-accent" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink">
            Max Gap Distribution
          </h2>
        </div>
        <span className="text-xs text-ink-faint">by max gap after entry</span>
      </header>

      {data.length === 0 ? (
        <div className="flex h-64 items-center justify-center text-sm text-ink-muted">
          No events to plot for the selected zone.
        </div>
      ) : (
        <div className="h-72 w-full">
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
                width={48}
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
                cursor={{ fill: 'rgba(56,189,248,0.08)' }}
                labelFormatter={(label) => `Max gap ≈ ${label}`}
              />
              <Legend
                wrapperStyle={{ fontSize: 12, color: '#94a3b8' }}
                iconType="square"
              />
              <Bar
                dataKey="recovered"
                name="Recovered"
                stackId="a"
                fill="#34d399"
                isAnimationActive={false}
              />
              <Bar
                dataKey="failed"
                name="Failed"
                stackId="a"
                fill="#f87171"
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
