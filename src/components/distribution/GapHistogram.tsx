/**
 * Gap distribution histogram (Phase R3).
 *
 * X-axis = gap zones, Y-axis = sample count. Tooltip shows zone, count and
 * percentage. Clicking a bar selects that zone.
 */

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from 'recharts';
import type { GapZone } from '@/utils/histogram';
import { fmtInt, fmtPercent } from '@/utils/format';
import { ChartIcon } from '@/components/common/icons';

interface GapHistogramProps {
  zones: GapZone[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function HistogramTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null;
  const zone = payload[0]?.payload as GapZone | undefined;
  if (!zone) return null;
  return (
    <div className="rounded-md border border-panel-border bg-panel-raised px-3 py-2 text-xs shadow-card">
      <div className="mb-1 font-mono text-ink">{zone.label}</div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-ink-muted">Count</span>
        <span className="font-mono text-accent">{fmtInt(zone.count)}</span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-ink-muted">Percentage</span>
        <span className="font-mono text-ink">{fmtPercent(zone.percentage)}</span>
      </div>
    </div>
  );
}

export function GapHistogram({ zones, selectedId, onSelect }: GapHistogramProps) {
  return (
    <section className="card p-5">
      <header className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ChartIcon className="text-base text-accent" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink">
            Gap Distribution
          </h2>
        </div>
        <span className="text-xs text-ink-faint">
          {zones.length} zone{zones.length === 1 ? '' : 's'} · click a bar to
          inspect
        </span>
      </header>

      {zones.length === 0 ? (
        <div className="flex h-72 items-center justify-center text-sm text-ink-muted">
          No gap values to bin for the current selection.
        </div>
      ) : (
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={zones}
              margin={{ top: 8, right: 12, bottom: 0, left: -8 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="label"
                tick={{ fill: '#64748b', fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: '#1e293b' }}
                minTickGap={8}
                angle={zones.length > 8 ? -25 : 0}
                textAnchor={zones.length > 8 ? 'end' : 'middle'}
                height={zones.length > 8 ? 56 : 24}
              />
              <YAxis
                tick={{ fill: '#64748b', fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: '#1e293b' }}
                width={56}
                allowDecimals={false}
              />
              <Tooltip
                content={<HistogramTooltip />}
                cursor={{ fill: 'rgba(56,189,248,0.08)' }}
              />
              <Bar
                dataKey="count"
                radius={[3, 3, 0, 0]}
                isAnimationActive={false}
                onClick={(data: unknown) => {
                  const zone = data as GapZone;
                  if (zone?.id) onSelect(zone.id);
                }}
                className="cursor-pointer"
              >
                {zones.map((z) => (
                  <Cell
                    key={z.id}
                    fill={z.id === selectedId ? '#38bdf8' : '#0ea5e9'}
                    fillOpacity={
                      selectedId === null || z.id === selectedId ? 1 : 0.4
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
