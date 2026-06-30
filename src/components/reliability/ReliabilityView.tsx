/**
 * Reliability Engine (Phase 14) — the trust layer.
 *
 * Evaluates how much to TRUST a stored historical research result (a Repository
 * strategy and its occurrences). It never reruns the Research or Probability
 * engines and never scans CSV — it only assesses the quality of existing
 * results. Read-only; deterministic; never a prediction or recommendation.
 */

import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useRepository } from '@/context/RepositoryContext';
import {
  buildReliability,
  DEFAULT_RELIABILITY_CONFIG,
  reliabilityCsv,
  reliabilityJson,
  type ReliabilityConfig,
  type ReliabilityGrade,
  type ReliabilityResult,
} from '@/utils/reliability';
import type { RepositoryRecord } from '@/utils/researchRepository';
import { downloadExport } from '@/utils/reports';
import { StatCard } from '@/components/overview/StatCard';
import { fmtInt, fmtNumber, fmtPercent } from '@/utils/format';
import { AlertIcon, DownloadIcon, LayersIcon, ShieldIcon, TableIcon } from '@/components/common/icons';

const GRADE_TONE: Record<ReliabilityGrade, string> = {
  'A+': 'text-positive',
  A: 'text-positive',
  'B+': 'text-accent',
  B: 'text-accent',
  C: 'text-warning',
  'Low Reliability': 'text-negative',
};

function scoreTone(s: number): string {
  if (s >= 80) return 'text-positive';
  if (s >= 65) return 'text-accent';
  if (s >= 50) return 'text-warning';
  return 'text-negative';
}
function scoreBar(s: number): string {
  if (s >= 80) return 'bg-positive';
  if (s >= 65) return 'bg-accent';
  if (s >= 50) return 'bg-warning';
  return 'bg-negative';
}

function Stars({ n }: { n: number }) {
  return (
    <span className="text-warning" aria-label={`${n} of 5`}>
      {'★'.repeat(n)}
      <span className="text-ink-faint">{'☆'.repeat(5 - n)}</span>
    </span>
  );
}

export function ReliabilityView() {
  const { records } = useRepository();
  const [config, setConfig] = useState<ReliabilityConfig>(DEFAULT_RELIABILITY_CONFIG);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [focusKey, setFocusKey] = useState<string | null>(null);

  const stamp = () => new Date().toISOString();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return records;
    return records.filter((r) => `${r.id} ${r.entryGap}/${r.recoveryGap}/${r.stopLoss} ${r.confidenceLabel}`.toLowerCase().includes(q));
  }, [records, search]);

  const focusRecord = useMemo<RepositoryRecord | null>(
    () => records.find((r) => r.key === (focusKey ?? selected[0])) ?? records[0] ?? null,
    [records, focusKey, selected],
  );

  const report = useMemo(
    () => (focusRecord ? buildReliability(focusRecord, config) : null),
    [focusRecord, config],
  );

  const comparison = useMemo<ReliabilityResult[]>(
    () => selected.map((k) => records.find((r) => r.key === k)).filter((r): r is RepositoryRecord => !!r).map((r) => buildReliability(r, config)),
    [selected, records, config],
  );

  const toggleSelect = (key: string) =>
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  if (records.length === 0) {
    return (
      <div className="space-y-5">
        <Banner />
        <section className="card flex flex-col items-center gap-3 p-10 text-center">
          <LayersIcon className="text-3xl text-ink-faint" />
          <h2 className="text-base font-semibold text-ink">Repository is empty</h2>
          <p className="max-w-md text-sm text-ink-muted">
            Run the Historical Strategy Finder to populate the Research Repository,
            then return here to evaluate the reliability of stored results.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Banner />

      {/* Strategy selection + config */}
      <section className="card p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="stat-label">Select Strategy (focus) · tick to compare</span>
          {selected.length > 0 && <button type="button" onClick={() => setSelected([])} className="btn px-2 py-0.5 text-xs">Clear</button>}
          <label className="ml-auto flex items-center gap-2 text-xs">
            <span className="stat-label">Recent Window (days)</span>
            <input
              type="number"
              min={1}
              step={1}
              value={config.recentWindowDays}
              onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v) && v > 0) setConfig({ recentWindowDays: Math.round(v) }); }}
              className="w-20 rounded-md border border-panel-border bg-panel px-2 py-1 text-ink focus:border-accent focus:outline-none"
            />
          </label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search repository"
            className="w-56 rounded-md border border-panel-border bg-panel px-2 py-1 text-xs text-ink focus:border-accent focus:outline-none"
          />
        </div>
        <div className="max-h-56 overflow-auto rounded-lg border border-panel-border">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-panel text-ink-faint">
              <tr>
                <th className="px-3 py-1.5 font-medium"> </th>
                <th className="px-3 py-1.5 font-medium">ID</th>
                <th className="px-3 py-1.5 text-right font-medium">Entry</th>
                <th className="px-3 py-1.5 text-right font-medium">Recovery</th>
                <th className="px-3 py-1.5 text-right font-medium">Stop Loss</th>
                <th className="px-3 py-1.5 text-right font-medium">Events</th>
                <th className="px-3 py-1.5 font-medium">Confidence</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {filtered.map((r) => {
                const isFocus = focusRecord?.key === r.key;
                return (
                  <tr key={r.key} onClick={() => setFocusKey(r.key)} className={['cursor-pointer border-t border-panel-border/60', isFocus ? 'bg-accent/10' : 'hover:bg-panel/50'].join(' ')}>
                    <td className="px-3 py-1.5"><input type="checkbox" checked={selected.includes(r.key)} onClick={(e) => e.stopPropagation()} onChange={() => toggleSelect(r.key)} className="accent-accent" /></td>
                    <td className="px-3 py-1.5 text-ink-muted">{r.id}{isFocus ? ' ◂' : ''}</td>
                    <td className="px-3 py-1.5 text-right text-ink">{fmtNumber(r.entryGap, 2)}</td>
                    <td className="px-3 py-1.5 text-right text-ink-muted">{fmtNumber(r.recoveryGap, 2)}</td>
                    <td className="px-3 py-1.5 text-right text-ink-muted">{fmtNumber(r.stopLoss, 2)}</td>
                    <td className="px-3 py-1.5 text-right text-ink-muted">{fmtInt(r.totalPositions)}</td>
                    <td className="px-3 py-1.5 font-sans text-ink-muted">{r.confidenceLabel}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {report && (
        <>
          {/* Export */}
          <section className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-ink-faint">Focused: <span className="font-mono text-ink">{report.record.id}</span> ({report.record.entryGap}/{report.record.recoveryGap}/{report.record.stopLoss})</span>
            <div className="ml-auto flex flex-wrap gap-2">
              <button type="button" onClick={() => downloadExport(reliabilityCsv(comparison.length ? comparison : [report]))} className="btn flex items-center gap-1.5 px-3 py-1.5 text-sm"><DownloadIcon className="text-sm" /> CSV</button>
              <button type="button" onClick={() => downloadExport(reliabilityJson(report, stamp()))} className="btn flex items-center gap-1.5 px-3 py-1.5 text-sm"><DownloadIcon className="text-sm" /> JSON</button>
            </div>
          </section>

          {/* Summary panel */}
          <section className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr]">
            <div className="card flex flex-col items-center justify-center gap-1 p-5 text-center">
              <div className="stat-label flex items-center gap-1.5"><ShieldIcon className="text-sm text-accent" /> Overall Reliability</div>
              <div className={['font-mono text-4xl font-semibold', scoreTone(report.overall)].join(' ')}>{fmtNumber(report.overall, 1)}</div>
              <div className={['text-lg font-semibold', GRADE_TONE[report.grade]].join(' ')}>{report.grade}</div>
              <div className="mt-1 text-[11px] text-ink-faint">{fmtInt(report.sampleSize)} events · recovery {fmtPercent(report.recoveryRate)}</div>
            </div>
            <div>
              <h2 className="stat-label mb-2">Component Scores</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {report.components.map((c) => (
                  <StatCard key={c.key} label={c.label} value={<span className={scoreTone(c.score)}>{fmtNumber(c.score, 0)}</span>} hint={`weight ${c.weight}`} tooltip={c.detail} />
                ))}
              </div>
            </div>
          </section>

          {/* Detail breakdown */}
          <section className="card p-5">
            <h2 className="stat-label mb-3">Detail Breakdown</h2>
            <div className="mb-4 flex items-center gap-3 text-sm">
              <span className="text-ink-faint">Sample Quality</span>
              <Stars n={report.stars} />
              <span className="text-[11px] text-ink-faint">({fmtInt(report.sampleSize)} events)</span>
            </div>
            <div className="space-y-3">
              {report.components.map((c) => (
                <div key={c.key}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-ink-muted">{c.label} <span className="text-ink-faint">· {c.detail}</span></span>
                    <span className={['font-mono', scoreTone(c.score)].join(' ')}>{fmtNumber(c.score, 0)}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-panel-border">
                    <div className={['h-full rounded-full', scoreBar(c.score)].join(' ')} style={{ width: `${Math.max(0, Math.min(100, c.score))}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Reliability timeline */}
          {report.timeline.length > 0 && (
            <section className="card p-5">
              <h2 className="stat-label mb-3">Reliability Timeline (recent window, week by week)</h2>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={report.timeline} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="weekStart" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={{ stroke: '#1e293b' }} />
                    <YAxis domain={[0, 100]} width={36} tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={{ stroke: '#1e293b' }} tickFormatter={(v: number) => `${v}%`} />
                    <Tooltip contentStyle={{ background: '#111a2c', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }} formatter={(v: number, _n, p) => [`${v.toFixed(1)}% recovery · ${(p?.payload as { occurrences?: number })?.occurrences ?? 0} events`, '']} labelFormatter={(l) => `week of ${l}`} />
                    <Bar dataKey="recoveryPct" radius={[2, 2, 0, 0]} isAnimationActive={false}>
                      {report.timeline.map((d, i) => (<Cell key={i} fill={d.recoveryPct >= 70 ? '#34d399' : d.recoveryPct >= 50 ? '#fbbf24' : '#f87171'} />))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-2 text-[11px] text-ink-faint">Recovery-before-SL rate per week within the recent window only. Older data does not dominate.</p>
            </section>
          )}

          {/* Warnings */}
          <section className="card p-5">
            <header className="mb-3 flex items-center gap-2"><AlertIcon className="text-base text-accent" /><h2 className="text-sm font-semibold uppercase tracking-wide text-ink">Research Warnings</h2><span className="ml-auto text-[11px] text-ink-faint">objective</span></header>
            <ul className="space-y-2">
              {report.warnings.map((w, i) => (
                <li key={i} className="flex items-start gap-2 text-sm leading-relaxed text-ink-muted"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent/70" /><span>{w}</span></li>
              ))}
            </ul>
          </section>

          {/* Comparison */}
          {comparison.length >= 2 && (
            <section className="card overflow-hidden">
              <header className="flex items-center gap-2 border-b border-panel-border px-5 py-3"><TableIcon className="text-base text-accent" /><h2 className="text-sm font-semibold uppercase tracking-wide text-ink">Reliability Comparison</h2><span className="ml-auto text-xs text-ink-faint">{comparison.length} selected</span></header>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-panel text-xs uppercase tracking-wide text-ink-faint">
                    <tr>
                      <th className="px-3 py-2 font-medium">Strategy</th>
                      <th className="px-3 py-2 text-right font-medium">Reliability</th>
                      <th className="px-3 py-2 font-medium">Grade</th>
                      <th className="px-3 py-2 text-right font-medium">Sample</th>
                      <th className="px-3 py-2 text-right font-medium">Consistency</th>
                      <th className="px-3 py-2 text-right font-medium">Expansion</th>
                      <th className="px-3 py-2 text-right font-medium">Holding</th>
                      <th className="px-3 py-2 font-medium">Confidence</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-panel-border font-mono text-xs">
                    {comparison.map((res) => {
                      const c = (k: string) => res.components.find((x) => x.key === k)?.score ?? 0;
                      const consistency = (c('historicalConsistency') + c('sessionConsistency') + c('recentConsistency')) / 3;
                      return (
                        <tr key={res.record.key} className="hover:bg-panel/50">
                          <td className="px-3 py-1.5 text-ink">{res.record.entryGap}/{res.record.recoveryGap}/{res.record.stopLoss}</td>
                          <td className={['px-3 py-1.5 text-right font-semibold', scoreTone(res.overall)].join(' ')}>{fmtNumber(res.overall, 1)}</td>
                          <td className={['px-3 py-1.5 font-sans font-semibold', GRADE_TONE[res.grade]].join(' ')}>{res.grade}</td>
                          <td className="px-3 py-1.5 text-right text-ink-muted">{fmtInt(res.sampleSize)}</td>
                          <td className="px-3 py-1.5 text-right text-ink-muted">{fmtNumber(consistency, 0)}</td>
                          <td className="px-3 py-1.5 text-right text-ink-muted">{fmtNumber(c('expansionStability'), 0)}</td>
                          <td className="px-3 py-1.5 text-right text-ink-muted">{fmtNumber(c('holdingStability'), 0)}</td>
                          <td className="px-3 py-1.5 font-sans text-ink-muted">{res.record.confidenceLabel}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <footer className="border-t border-panel-border px-5 py-2 text-[11px] text-ink-faint">Reliability evaluates trust in stored research — never a recommendation or prediction.</footer>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function Banner() {
  return (
    <section className="card flex flex-wrap items-start gap-3 border-accent/30 bg-accent/5 p-4">
      <ShieldIcon className="mt-0.5 text-base text-accent" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-ink">Reliability — the trust layer</p>
          <span className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">Reliability Engine v1.0</span>
        </div>
        <p className="mt-1 text-sm leading-relaxed text-ink-muted">
          Probability tells what historically happened; reliability tells how much
          to trust it. This evaluates the quality of stored research only — it
          never reruns research and is never a prediction or recommendation.
        </p>
      </div>
    </section>
  );
}
