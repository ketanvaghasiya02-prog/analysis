/**
 * Stop-loss survival line chart (Phase R7).
 *
 * Plots, against the SL gap level: recovered-survived %, failed-cut % and
 * overall-recovery %. Research evidence only.
 */

import { useMemo } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { SurvivalRow } from '@/utils/stoploss';
import { ChartIcon } from '@/components/common/icons';

export function SurvivalChart({ rows }: { rows: SurvivalRow[] }) {
  const data = useMemo(
    () =>
      rows.map((r) => ({
        sl: r.slLevel,
        recovered: r.recoveredSurvivedPct,
        failedCut: r.failedCutPct,
        overall: r.overallRecoveryPct,
      })),
    [rows],
  );

  return (
    <section className="card p-5">
      <header className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ChartIcon className="text-base text-accent" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink">
            Survival Curve
          </h2>
        </div>
        <span className="text-xs text-ink-faint">% vs SL gap level</span>
      </header>

      {data.length === 0 ? (
        <div className="flex h-64 items-center justify-center text-sm text-ink-muted">
          No SL levels to plot.
        </div>
      ) : (
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="sl"
                tick={{ fill: '#64748b', fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: '#1e293b' }}
                tickFormatter={(v: number) => v.toFixed(2)}
                minTickGap={16}
              />
              <YAxis
                tick={{ fill: '#64748b', fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: '#1e293b' }}
                width={44}
                domain={[0, 100]}
                tickFormatter={(v: number) => `${v}%`}
              />
              <Tooltip
                contentStyle={{
                  background: '#111a2c',
                  border: '1px solid #1e293b',
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelStyle={{ color: '#94a3b8' }}
                labelFormatter={(v) => `SL gap ${Number(v).toFixed(2)}`}
                formatter={(val: number, name: string) => [
                  `${val.toFixed(1)}%`,
                  name,
                ]}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} iconType="plainline" />
              <Line
                type="monotone"
                dataKey="recovered"
                name="Recovered survived"
                stroke="#34d399"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="failedCut"
                name="Failed cut"
                stroke="#f87171"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="overall"
                name="Overall recovery"
                stroke="#38bdf8"
                strokeWidth={2}
                strokeDasharray="4 3"
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
