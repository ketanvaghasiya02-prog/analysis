/**
 * Research Lab event path chart (additive).
 *
 * Gap over time for the selected event — ~10 min before entry through its
 * terminal — with horizontal reference lines for the entry zone, recovery
 * target and stop-loss.
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
  buildScenarioPath,
  type ScenarioEvent,
  type ScenarioInput,
} from '@/utils/scenario';
import { fmtNumber } from '@/utils/format';
import { ChartIcon } from '@/components/common/icons';

function LegendItem({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className={dashed ? 'inline-block h-0 w-4 border-t-2 border-dashed' : 'inline-block h-2.5 w-2.5 rounded-full'}
        style={dashed ? { borderColor: color } : { background: color }}
      />
      {label}
    </span>
  );
}

export function ScenarioPathChart({
  samples,
  event,
  input,
}: {
  samples: GapSample[];
  event: ScenarioEvent;
  input: ScenarioInput;
}) {
  const path = useMemo(
    () => buildScenarioPath(samples, event, input.stopLoss),
    [samples, event, input.stopLoss],
  );

  const gapAt = (pos: number | null) =>
    pos === null ? null : (path.points[pos]?.gap ?? null);

  return (
    <section className="card p-5">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ChartIcon className="text-base text-accent" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink">
            Event Path — {event.id}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-ink-muted">
          <LegendItem color="#38bdf8" label="Entry" />
          <LegendItem color="#34d399" label="Recovery" />
          <LegendItem color="#f87171" label="SL hit" />
          <LegendItem color="#fbbf24" label="SL level" dashed />
          <LegendItem color="#34d399" label="Recovery target" dashed />
        </div>
      </header>

      {path.points.length === 0 ? (
        <div className="flex h-72 items-center justify-center text-sm text-ink-muted">
          No gap samples to plot for this event.
        </div>
      ) : (
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={path.points} margin={{ top: 10, right: 16, bottom: 0, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="i"
                type="number"
                tick={{ fill: '#64748b', fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: '#1e293b' }}
                domain={['dataMin', 'dataMax']}
                tickFormatter={(v: number) => path.points[v]?.time?.slice(-8) ?? ''}
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
                labelFormatter={(v) => path.points[v as number]?.time ?? ''}
                formatter={(val: number) => [fmtNumber(val, 3), 'Gap']}
              />

              {/* Reference lines: stop-loss, entry, recovery */}
              <ReferenceLine y={input.stopLoss} stroke="#fbbf24" strokeDasharray="5 4" strokeWidth={1.5} />
              <ReferenceLine y={input.entryGap} stroke="#38bdf8" strokeDasharray="2 3" strokeWidth={1.5} />
              <ReferenceLine y={input.recoveryGap} stroke="#34d399" strokeDasharray="5 4" strokeWidth={1.5} />

              <Line
                type="monotone"
                dataKey="gap"
                stroke="#94a3b8"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />

              {path.entryPos !== null && gapAt(path.entryPos) !== null && (
                <ReferenceDot x={path.entryPos} y={gapAt(path.entryPos)!} r={5} fill="#38bdf8" stroke="#0b1220" />
              )}
              {path.slHitPos !== null && gapAt(path.slHitPos) !== null && (
                <ReferenceDot x={path.slHitPos} y={gapAt(path.slHitPos)!} r={5} fill="#f87171" stroke="#0b1220" />
              )}
              {path.recoveryPos !== null && gapAt(path.recoveryPos) !== null && (
                <ReferenceDot x={path.recoveryPos} y={gapAt(path.recoveryPos)!} r={5} fill="#34d399" stroke="#0b1220" />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
