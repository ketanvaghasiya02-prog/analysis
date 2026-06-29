/**
 * Gap-over-time line chart for the active selection (Recharts).
 * Large datasets are uniformly down-sampled to keep rendering smooth.
 */

import { useMemo } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useData } from '@/context/DataContext';
import { ChartIcon } from '@/components/common/icons';

const MAX_POINTS = 600;

export function GapTrendChart() {
  const { filteredSamples } = useData();

  const data = useMemo(() => {
    const withGap = filteredSamples.filter((s) => s.gap !== null);
    const step = Math.max(1, Math.ceil(withGap.length / MAX_POINTS));
    const points: Array<{ t: string; gap: number; idx: number }> = [];
    for (let i = 0; i < withGap.length; i += step) {
      const s = withGap[i];
      if (!s) continue;
      points.push({
        t: s.serverTime || s.sampleId,
        gap: s.gap as number,
        idx: i,
      });
    }
    return points;
  }, [filteredSamples]);

  return (
    <section className="card p-5">
      <header className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ChartIcon className="text-base text-accent" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink">
            Gap Trend
          </h2>
        </div>
        <span className="text-xs text-ink-faint">
          {data.length.toLocaleString()} points
          {filteredSamples.length > data.length ? ' (sampled)' : ''}
        </span>
      </header>

      {data.length === 0 ? (
        <div className="flex h-64 items-center justify-center text-sm text-ink-muted">
          No gap values to plot for this selection.
        </div>
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="idx"
                tick={{ fill: '#64748b', fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: '#1e293b' }}
                minTickGap={48}
              />
              <YAxis
                tick={{ fill: '#64748b', fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: '#1e293b' }}
                width={56}
                domain={['auto', 'auto']}
              />
              <Tooltip
                contentStyle={{
                  background: '#111a2c',
                  border: '1px solid #1e293b',
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelStyle={{ color: '#94a3b8' }}
                itemStyle={{ color: '#38bdf8' }}
                formatter={(v: number) => [v.toFixed(3), 'Gap']}
                labelFormatter={(_, payload) =>
                  payload?.[0]?.payload?.t ?? ''
                }
              />
              <Line
                type="monotone"
                dataKey="gap"
                stroke="#38bdf8"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
