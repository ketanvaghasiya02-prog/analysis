/**
 * Event replay chart (Phase R9).
 *
 * Plots the gap line from ~10 minutes before entry until recovery / day-end /
 * dataset-end and marks the entry, max-adverse and recovery points, the
 * stop-loss level and the day boundary.
 */

import { useMemo } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { GapSample } from '@/types/gap';
import {
  buildReplaySeries,
  type ExplorerEvent,
} from '@/utils/explorer';
import { fmtNumber } from '@/utils/format';
import { ChartIcon } from '@/components/common/icons';

interface ReplayChartProps {
  samples: GapSample[];
  event: ExplorerEvent;
  slLevel: number;
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="inline-block h-2.5 w-2.5 rounded-full"
        style={{ background: color }}
      />
      {label}
    </span>
  );
}

export function ReplayChart({ samples, event, slLevel }: ReplayChartProps) {
  const series = useMemo(
    () => buildReplaySeries(samples, event),
    [samples, event],
  );

  const gapAt = (pos: number | null): number | null =>
    pos === null ? null : (series.points[pos]?.gap ?? null);

  const entryGap = gapAt(series.entryPos);
  const maxGap = gapAt(series.maxPos);
  const recoveryGap = gapAt(series.recoveryPos);

  return (
    <section className="card p-5">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ChartIcon className="text-base text-accent" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink">
            Event Replay — {event.eventId}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-ink-muted">
          <LegendDot color="#38bdf8" label="Entry" />
          <LegendDot color="#f87171" label="Max adverse" />
          <LegendDot color="#34d399" label="Recovery" />
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0 w-4 border-t-2 border-dashed border-warning" />
            SL {fmtNumber(slLevel, 2)}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-0 border-l border-dashed border-ink-faint" />
            Day boundary
          </span>
        </div>
      </header>

      {series.points.length === 0 ? (
        <div className="flex h-72 items-center justify-center text-sm text-ink-muted">
          No gap samples to replay for this event.
        </div>
      ) : (
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={series.points}
              margin={{ top: 10, right: 16, bottom: 0, left: -8 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="i"
                type="number"
                tick={{ fill: '#64748b', fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: '#1e293b' }}
                domain={['dataMin', 'dataMax']}
                tickFormatter={(v: number) =>
                  series.points[v]?.time?.slice(-8) ?? ''
                }
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
                labelFormatter={(v) => series.points[v as number]?.time ?? ''}
                formatter={(val: number) => [fmtNumber(val, 3), 'Gap']}
              />

              {/* Stop-loss level */}
              <ReferenceLine
                y={slLevel}
                stroke="#fbbf24"
                strokeDasharray="5 4"
                strokeWidth={1.5}
              />
              {/* Zone low (recovery target) */}
              <ReferenceLine
                y={event.zoneLow}
                stroke="#334155"
                strokeDasharray="2 3"
              />
              {/* Day boundary */}
              {series.dayBoundaryPos !== null && (
                <ReferenceLine
                  x={series.dayBoundaryPos}
                  stroke="#64748b"
                  strokeDasharray="3 3"
                />
              )}

              <Line
                type="monotone"
                dataKey="gap"
                stroke="#38bdf8"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />

              {/* Markers */}
              {series.entryPos !== null && entryGap !== null && (
                <ReferenceDot
                  x={series.entryPos}
                  y={entryGap}
                  r={5}
                  fill="#38bdf8"
                  stroke="#0b1220"
                />
              )}
              {series.maxPos !== null && maxGap !== null && (
                <ReferenceDot
                  x={series.maxPos}
                  y={maxGap}
                  r={5}
                  fill="#f87171"
                  stroke="#0b1220"
                />
              )}
              {series.recoveryPos !== null && recoveryGap !== null && (
                <ReferenceDot
                  x={series.recoveryPos}
                  y={recoveryGap}
                  r={5}
                  fill="#34d399"
                  stroke="#0b1220"
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
