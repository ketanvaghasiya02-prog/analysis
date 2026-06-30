/**
 * Session recovery and worst-gap bar charts (Phase R10).
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
import type { SessionStat } from '@/utils/sessions';
import { ChartIcon } from '@/components/common/icons';
import { InfoTip } from '@/components/common/InfoTip';

const RECOVERY_TIP =
  'Same-Day Recovery % = events where the gap returned to the zone low on the same trading day. Stop Loss is not used on this page.';

const TOOLTIP = {
  contentStyle: {
    background: '#111a2c',
    border: '1px solid #1e293b',
    borderRadius: 8,
    fontSize: 12,
  },
  labelStyle: { color: '#94a3b8' },
} as const;

const AXIS = {
  tick: { fill: '#64748b', fontSize: 11 },
  tickLine: false,
  axisLine: { stroke: '#1e293b' },
} as const;

function ChartCard({
  title,
  tip,
  children,
}: {
  title: string;
  tip?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card p-5">
      <header className="mb-3 flex items-center gap-2">
        <ChartIcon className="text-base text-accent" />
        <h2 className="flex items-center text-sm font-semibold uppercase tracking-wide text-ink">
          {title}
          {tip ? <InfoTip text={tip} /> : null}
        </h2>
      </header>
      <div className="h-64 w-full">{children}</div>
    </section>
  );
}

export function SessionCharts({ sessions }: { sessions: SessionStat[] }) {
  const data = useMemo(
    () =>
      sessions.map((s) => ({
        session: s.session,
        recovery: s.recoveryPct,
        worstGap: s.worstMaxGap ?? 0,
      })),
    [sessions],
  );

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <ChartCard title="Same-Day Recovery % by Session" tip={RECOVERY_TIP}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="session" {...AXIS} />
            <YAxis {...AXIS} width={48} domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} />
            <Tooltip
              {...TOOLTIP}
              cursor={{ fill: 'rgba(56,189,248,0.08)' }}
              formatter={(v: number) => [`${v.toFixed(1)}%`, 'Same-day recovery']}
            />
            <Bar dataKey="recovery" fill="#34d399" radius={[3, 3, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Worst Max Gap by Session">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="session" {...AXIS} />
            <YAxis {...AXIS} width={52} domain={['auto', 'auto']} />
            <Tooltip
              {...TOOLTIP}
              cursor={{ fill: 'rgba(248,113,113,0.08)' }}
              formatter={(v: number) => [v.toFixed(3), 'Worst gap']}
            />
            <Bar dataKey="worstGap" fill="#f87171" radius={[3, 3, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
