/**
 * Strategy Dossier charts (Phase 11E) — read-only visualization of stored
 * occurrence evidence. No calculation here.
 */

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { HistogramBin, MonthStat, OutcomeStat, SessionStat } from '@/utils/strategyDossier';

const AXIS = {
  tick: { fill: '#64748b', fontSize: 11 },
  tickLine: false,
  axisLine: { stroke: '#1e293b' },
} as const;

const TOOLTIP = {
  contentStyle: { background: '#111a2c', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 },
  labelStyle: { color: '#94a3b8' },
  itemStyle: { color: '#e2e8f0' },
} as const;

const PIE_COLORS = ['#34d399', '#38bdf8', '#fbbf24', '#a78bfa', '#f87171', '#22d3ee', '#f59e0b', '#94a3b8'];

export function SessionBarChart({ sessions }: { sessions: SessionStat[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={sessions} margin={{ top: 8, right: 12, bottom: 0, left: -10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
        <XAxis dataKey="session" {...AXIS} />
        <YAxis {...AXIS} width={36} />
        <Tooltip
          {...TOOLTIP}
          cursor={{ fill: 'rgba(56,189,248,0.08)' }}
          formatter={(v: number, n: string) => [n === 'recoveryPct' ? `${v.toFixed(1)}%` : v, n === 'recoveryPct' ? 'Recovery %' : 'Occurrences']}
        />
        <Bar dataKey="occurrences" fill="#38bdf8" radius={[2, 2, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function SessionPieChart({ sessions }: { sessions: SessionStat[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={sessions} dataKey="occurrences" nameKey="session" cx="50%" cy="50%" outerRadius={80} isAnimationActive={false} label={(e) => e.session}>
          {sessions.map((_, i) => (
            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip {...TOOLTIP} formatter={(v: number) => [`${v} occurrences`, '']} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function OutcomePieChart({ outcomes }: { outcomes: OutcomeStat[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={outcomes} dataKey="count" nameKey="label" cx="50%" cy="50%" innerRadius={45} outerRadius={82} paddingAngle={2} isAnimationActive={false}>
          {outcomes.map((_, i) => (
            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
          ))}
        </Pie>
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Tooltip {...TOOLTIP} formatter={(v: number, _n, p) => [`${v} (${(p?.payload as { pct?: number })?.pct?.toFixed(1) ?? ''}%)`, (p?.payload as { label?: string })?.label ?? '']} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function RecoveryHistogramChart({ bins }: { bins: HistogramBin[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={bins} margin={{ top: 8, right: 12, bottom: 0, left: -10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
        <XAxis dataKey="label" {...AXIS} interval={0} angle={-30} textAnchor="end" height={42} />
        <YAxis {...AXIS} width={36} allowDecimals={false} />
        <Tooltip {...TOOLTIP} cursor={{ fill: 'rgba(167,139,250,0.08)' }} formatter={(v: number) => [`${v} occurrences`, '']} />
        <Bar dataKey="count" fill="#a78bfa" radius={[2, 2, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function MonthlyBarChart({ months }: { months: MonthStat[] }) {
  const data = months.map((m) => ({ ...m, short: m.label.slice(0, 3) }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
        <XAxis dataKey="short" {...AXIS} interval={0} />
        <YAxis {...AXIS} width={36} allowDecimals={false} />
        <Tooltip
          {...TOOLTIP}
          cursor={{ fill: 'rgba(52,211,153,0.08)' }}
          formatter={(v: number) => [`${v} occurrences`, '']}
        />
        <Bar dataKey="occurrences" fill="#34d399" radius={[2, 2, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}
