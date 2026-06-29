/**
 * Section 5 — Session Analysis (Overview 2.0).
 *
 * Per-session descriptive gap stats plus recovery rate / confidence consumed
 * from the Research Engine (computeScenario with the reference scenario).
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
import type { GapSample } from '@/types/gap';
import {
  computeScenario,
  CONFIDENCE_LABELS,
  type ScenarioInput,
} from '@/utils/scenario';
import { computeGapStats } from '@/utils/overviewStats';
import { fmtInt, fmtNumber, fmtPercent } from '@/utils/format';
import { TableIcon } from '@/components/common/icons';

interface Row {
  session: string;
  samples: number;
  avg: number | null;
  median: number | null;
  max: number | null;
  min: number | null;
  volatility: number | null;
  mode: number | null;
  recoveryRate: number;
  confidence: string;
}

export function OverviewSessionSection({
  samples,
  reference,
}: {
  samples: GapSample[];
  reference: ScenarioInput;
}) {
  const rows = useMemo<Row[]>(() => {
    const bySession = new Map<string, GapSample[]>();
    for (const s of samples) {
      const k = s.currentSession || 'UNKNOWN';
      (bySession.get(k) ?? bySession.set(k, []).get(k)!).push(s);
    }
    const out: Row[] = [];
    for (const [session, group] of bySession) {
      const stats = computeGapStats(group);
      const res = computeScenario(group, reference);
      out.push({
        session,
        samples: group.length,
        avg: stats.avg,
        median: stats.median,
        max: stats.max,
        min: stats.min,
        volatility: stats.stdDev,
        mode: stats.mode,
        recoveryRate: res.recoveryPctIgnoringSl,
        confidence: CONFIDENCE_LABELS[res.confidence.level],
      });
    }
    out.sort((a, b) => b.samples - a.samples);
    return out;
  }, [samples, reference]);

  const chartData = useMemo(
    () => rows.map((r) => ({ session: r.session, avg: r.avg ?? 0, recovery: r.recoveryRate })),
    [rows],
  );

  return (
    <section className="space-y-4">
      <h2 className="stat-label">Session Analysis</h2>

      <section className="card overflow-hidden">
        <header className="border-b border-panel-border px-5 py-3">
          <div className="flex items-center gap-2">
            <TableIcon className="text-base text-accent" />
            <h3 className="text-sm font-semibold uppercase tracking-wide text-ink">By Session</h3>
          </div>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-panel text-xs uppercase tracking-wide text-ink-faint">
              <tr>
                <th className="px-3 py-2 font-medium">Session</th>
                <th className="px-3 py-2 text-right font-medium">Samples</th>
                <th className="px-3 py-2 text-right font-medium">Avg Gap</th>
                <th className="px-3 py-2 text-right font-medium">Median</th>
                <th className="px-3 py-2 text-right font-medium">Max</th>
                <th className="px-3 py-2 text-right font-medium">Min</th>
                <th className="px-3 py-2 text-right font-medium">Volatility</th>
                <th className="px-3 py-2 text-right font-medium">Mode</th>
                <th className="px-3 py-2 text-right font-medium">Recovery Rate</th>
                <th className="px-3 py-2 font-medium">Confidence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-panel-border font-mono text-xs">
              {rows.map((r) => (
                <tr key={r.session} className="hover:bg-panel/50">
                  <td className="px-3 py-2 font-sans text-ink">{r.session}</td>
                  <td className="px-3 py-2 text-right text-ink-muted">{fmtInt(r.samples)}</td>
                  <td className="px-3 py-2 text-right text-accent">{fmtNumber(r.avg, 3)}</td>
                  <td className="px-3 py-2 text-right text-ink-muted">{fmtNumber(r.median, 3)}</td>
                  <td className="px-3 py-2 text-right text-positive">{fmtNumber(r.max, 3)}</td>
                  <td className="px-3 py-2 text-right text-negative">{fmtNumber(r.min, 3)}</td>
                  <td className="px-3 py-2 text-right text-ink-muted">{fmtNumber(r.volatility, 3)}</td>
                  <td className="px-3 py-2 text-right text-ink-muted">{fmtNumber(r.mode, 2)}</td>
                  <td className="px-3 py-2 text-right text-positive">{fmtPercent(r.recoveryRate)}</td>
                  <td className="px-3 py-2 font-sans text-ink-muted">{r.confidence}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card p-5">
        <h3 className="stat-label mb-3">Session Comparison</h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="session" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#1e293b' }} />
              <YAxis yAxisId="l" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#1e293b' }} width={48} />
              <YAxis yAxisId="r" orientation="right" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#1e293b' }} width={44} domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} />
              <Tooltip contentStyle={{ background: '#111a2c', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: '#94a3b8' }} />
              <Legend wrapperStyle={{ fontSize: 12 }} iconType="square" />
              <Bar yAxisId="l" dataKey="avg" name="Avg gap" fill="#38bdf8" radius={[3, 3, 0, 0]} isAnimationActive={false} />
              <Bar yAxisId="r" dataKey="recovery" name="Recovery rate %" fill="#34d399" radius={[3, 3, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-[11px] text-ink-faint">
          Recovery rate from the Research Engine using the reference scenario
          (entry {fmtNumber(reference.entryGap, 2)}, recovery {fmtNumber(reference.recoveryGap, 2)}, SL {fmtNumber(reference.stopLoss, 2)}).
        </p>
      </section>
    </section>
  );
}
