/**
 * Replay gap chart (Phase 11F) — the stored gap path with the current replay
 * position highlighted. Read-only; reveals the path up to the cursor.
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
import type { ReplayTimeline } from '@/utils/replay';

const AXIS = {
  tick: { fill: '#64748b', fontSize: 11 },
  tickLine: false,
  axisLine: { stroke: '#1e293b' },
} as const;

function mmss(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

export function ReplayChart({ timeline, pos }: { timeline: ReplayTimeline; pos: number }) {
  const data = useMemo(
    () =>
      timeline.samples.map((s) => ({
        pos: s.pos,
        elapsed: s.elapsedSec,
        gap: s.gap,
        revealed: s.pos <= pos ? s.gap : null,
      })),
    [timeline.samples, pos],
  );

  const cur = timeline.samples[pos];
  const { entry, recovery, stopLoss } = timeline.levels;

  if (data.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 10, right: 16, bottom: 0, left: -8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
        <XAxis
          dataKey="pos"
          type="number"
          domain={['dataMin', 'dataMax']}
          tickFormatter={(p: number) => {
            const sample = timeline.samples[p];
            return sample ? mmss(sample.elapsedSec) : '';
          }}
          {...AXIS}
        />
        <YAxis {...AXIS} width={46} domain={['auto', 'auto']} tickFormatter={(v: number) => v.toFixed(1)} />
        <Tooltip
          contentStyle={{ background: '#111a2c', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }}
          labelFormatter={(p) => {
            const s = timeline.samples[Number(p)];
            return s ? `${s.time} · ${mmss(s.elapsedSec)}` : '';
          }}
          formatter={(v: number) => [v.toFixed(3), 'Gap']}
        />

        {/* Strategy levels */}
        <ReferenceLine y={entry} stroke="#fbbf24" strokeDasharray="5 3" label={{ value: 'Entry', fill: '#fbbf24', fontSize: 10, position: 'right' }} />
        <ReferenceLine y={recovery} stroke="#34d399" strokeDasharray="5 3" label={{ value: 'Recovery', fill: '#34d399', fontSize: 10, position: 'right' }} />
        <ReferenceLine y={stopLoss} stroke="#f87171" strokeDasharray="5 3" label={{ value: 'Stop Loss', fill: '#f87171', fontSize: 10, position: 'right' }} />

        {/* Full path (faded) + revealed path (bright) */}
        <Line type="monotone" dataKey="gap" stroke="#334155" strokeWidth={1.5} dot={false} isAnimationActive={false} />
        <Line type="monotone" dataKey="revealed" stroke="#38bdf8" strokeWidth={2} dot={false} isAnimationActive={false} connectNulls={false} />

        {/* Current position */}
        <ReferenceLine x={pos} stroke="#e2e8f0" strokeWidth={1} />
        {cur ? <ReferenceDot x={pos} y={cur.gap} r={4} fill="#e2e8f0" stroke="#0b1220" /> : null}
      </LineChart>
    </ResponsiveContainer>
  );
}
