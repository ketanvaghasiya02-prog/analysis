/**
 * Top Trade replay path chart (additive).
 *
 * Gap path from ~10 min before entry to exit, marking entry, exit and the
 * max-adverse point, shading the compression area, and (optionally) the SL line.
 */

import { useMemo } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { GapSample } from '@/types/gap';
import { buildTradePath, type TopTradeOpportunity } from '@/utils/topTrades';
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

export function TopTradePathChart({
  samples,
  trade,
  slLevel,
}: {
  samples: GapSample[];
  trade: TopTradeOpportunity;
  slLevel: number | null;
}) {
  const path = useMemo(() => buildTradePath(samples, trade), [samples, trade]);

  const gapAt = (pos: number | null) =>
    pos === null ? null : (path.points[pos]?.gap ?? null);
  const entryGap = gapAt(path.entryPos);
  const exitGap = gapAt(path.exitPos);
  const adverseGap = gapAt(path.adversePos);

  return (
    <section className="card p-5">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ChartIcon className="text-base text-accent" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink">
            Trade Path — {trade.id} (rank #{trade.rank})
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-ink-muted">
          <LegendItem color="#f87171" label="Entry" />
          <LegendItem color="#34d399" label="Exit" />
          <LegendItem color="#fbbf24" label="Max adverse" />
          {slLevel !== null && <LegendItem color="#fbbf24" label="SL level" dashed />}
        </div>
      </header>

      {path.points.length === 0 ? (
        <div className="flex h-72 items-center justify-center text-sm text-ink-muted">
          No gap samples to plot for this trade.
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
                contentStyle={{ background: '#111a2c', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#94a3b8' }}
                labelFormatter={(v) => path.points[v as number]?.time ?? ''}
                formatter={(val: number) => [fmtNumber(val, 3), 'Gap']}
              />

              {/* Compression area between entry and exit gap levels */}
              {path.entryPos !== null &&
                path.exitPos !== null &&
                entryGap !== null &&
                exitGap !== null && (
                  <ReferenceArea
                    x1={path.entryPos}
                    x2={path.exitPos}
                    y1={exitGap}
                    y2={entryGap}
                    fill="#34d399"
                    fillOpacity={0.1}
                    stroke="#34d399"
                    strokeOpacity={0.25}
                  />
                )}

              {slLevel !== null && (
                <ReferenceLine y={slLevel} stroke="#fbbf24" strokeDasharray="5 4" strokeWidth={1.5} />
              )}

              <Line type="monotone" dataKey="gap" stroke="#94a3b8" strokeWidth={1.5} dot={false} isAnimationActive={false} />

              {path.entryPos !== null && entryGap !== null && (
                <ReferenceDot x={path.entryPos} y={entryGap} r={5} fill="#f87171" stroke="#0b1220" />
              )}
              {path.adversePos !== null && adverseGap !== null && (
                <ReferenceDot x={path.adversePos} y={adverseGap} r={5} fill="#fbbf24" stroke="#0b1220" />
              )}
              {path.exitPos !== null && exitGap !== null && (
                <ReferenceDot x={path.exitPos} y={exitGap} r={5} fill="#34d399" stroke="#0b1220" />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
