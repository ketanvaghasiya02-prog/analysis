/**
 * Walk Forward Validation (Phase 15) — the historical validation page.
 *
 * Validates a stored strategy on UNSEEN historical windows by splitting its
 * occurrences into Training and Validation periods and comparing them. It never
 * optimizes, never reruns research, never modifies ranking. Read-only,
 * deterministic; validation only — never a recommendation or prediction.
 */

import { useMemo, useState } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from 'recharts';
import { useRepository } from '@/context/RepositoryContext';
import {
  buildWalkForward,
  DEFAULT_WALK_FORWARD_CONFIG,
  walkForwardCsv,
  walkForwardJson,
  type DriftLevel,
  type RobustnessGrade,
  type ValidationStatus,
  type WalkForwardConfig,
} from '@/utils/walkForward';
import type { RepositoryRecord } from '@/utils/researchRepository';
import { downloadExport } from '@/utils/reports';
import { StatCard } from '@/components/overview/StatCard';
import { fmtDuration, fmtInt, fmtNumber, fmtPercent } from '@/utils/format';
import { AlertIcon, DownloadIcon, LayersIcon, ShieldIcon, TableIcon } from '@/components/common/icons';

const GRADE_TONE: Record<RobustnessGrade, string> = { 'A+': 'text-positive', A: 'text-positive', 'B+': 'text-accent', B: 'text-accent', C: 'text-warning', Low: 'text-negative' };
const STATUS_TONE: Record<ValidationStatus, string> = { Passed: 'border-positive/40 bg-positive/15 text-positive', Borderline: 'border-warning/40 bg-warning/15 text-warning', Failed: 'border-negative/40 bg-negative/15 text-negative' };
const DRIFT_TONE: Record<DriftLevel, string> = { Minor: 'bg-positive/20 text-positive', Moderate: 'bg-warning/20 text-warning', Major: 'bg-negative/20 text-negative' };

function scoreTone(s: number): string {
  if (s >= 80) return 'text-positive';
  if (s >= 65) return 'text-accent';
  if (s >= 50) return 'text-warning';
  return 'text-negative';
}

function NumField({ label, value, onChange, min = 1 }: { label: string; value: number; onChange: (v: number) => void; min?: number }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="stat-label">{label}</span>
      <input type="number" min={min} step={1} value={value} onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v) && v >= min) onChange(Math.round(v)); }} className="w-full rounded-md border border-panel-border bg-panel px-3 py-1.5 text-sm text-ink focus:border-accent focus:outline-none" />
    </label>
  );
}

export function WalkForwardView() {
  const { records } = useRepository();
  const [config, setConfig] = useState<WalkForwardConfig>(DEFAULT_WALK_FORWARD_CONFIG);
  const [search, setSearch] = useState('');
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const [walkIdx, setWalkIdx] = useState(0);

  const patch = (p: Partial<WalkForwardConfig>) => setConfig((prev) => ({ ...prev, ...p }));
  const stamp = () => new Date().toISOString();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return records;
    return records.filter((r) => `${r.id} ${r.entryGap}/${r.recoveryGap}/${r.stopLoss}`.toLowerCase().includes(q));
  }, [records, search]);

  const focusRecord = useMemo<RepositoryRecord | null>(() => records.find((r) => r.key === focusKey) ?? records[0] ?? null, [records, focusKey]);
  const result = useMemo(() => (focusRecord ? buildWalkForward(focusRecord, config) : null), [focusRecord, config]);

  const focusedWalk = result && result.walks.length ? result.walks[Math.min(walkIdx, result.walks.length - 1)] ?? null : null;

  const timeline = useMemo(
    () => (result ? result.walks.map((w) => ({ name: `#${w.index + 1}`, robustness: Math.round(w.robustness * 10) / 10, train: Math.round(w.training.recoveryPct * 10) / 10, validation: Math.round(w.validation.recoveryPct * 10) / 10 })) : []),
    [result],
  );

  if (records.length === 0) {
    return (
      <div className="space-y-5">
        <Banner />
        <section className="card flex flex-col items-center gap-3 p-10 text-center">
          <LayersIcon className="text-3xl text-ink-faint" />
          <h2 className="text-base font-semibold text-ink">Repository is empty</h2>
          <p className="max-w-md text-sm text-ink-muted">Run the Historical Strategy Finder to populate the Research Repository, then return here to validate a strategy on unseen windows.</p>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Banner />

      {/* Strategy + config */}
      <section className="card p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="stat-label">Strategy to validate</span>
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search repository" className="ml-auto w-56 rounded-md border border-panel-border bg-panel px-2 py-1 text-xs text-ink focus:border-accent focus:outline-none" />
        </div>
        <div className="mb-4 max-h-44 overflow-auto rounded-lg border border-panel-border">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-panel text-ink-faint"><tr><th className="px-3 py-1.5 font-medium">ID</th><th className="px-3 py-1.5 text-right font-medium">Entry</th><th className="px-3 py-1.5 text-right font-medium">Recovery</th><th className="px-3 py-1.5 text-right font-medium">Stop Loss</th><th className="px-3 py-1.5 text-right font-medium">Events</th></tr></thead>
            <tbody className="font-mono">
              {filtered.map((r) => {
                const isFocus = focusRecord?.key === r.key;
                return (
                  <tr key={r.key} onClick={() => { setFocusKey(r.key); setWalkIdx(0); }} className={['cursor-pointer border-t border-panel-border/60', isFocus ? 'bg-accent/10' : 'hover:bg-panel/50'].join(' ')}>
                    <td className="px-3 py-1.5 text-ink-muted">{r.id}{isFocus ? ' ◂' : ''}</td>
                    <td className="px-3 py-1.5 text-right text-ink">{fmtNumber(r.entryGap, 2)}</td>
                    <td className="px-3 py-1.5 text-right text-ink-muted">{fmtNumber(r.recoveryGap, 2)}</td>
                    <td className="px-3 py-1.5 text-right text-ink-muted">{fmtNumber(r.stopLoss, 2)}</td>
                    <td className="px-3 py-1.5 text-right text-ink-muted">{fmtInt(r.totalPositions)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
          <NumField label="Training Window (days)" value={config.trainingDays} onChange={(v) => patch({ trainingDays: v })} />
          <NumField label="Validation Window (days)" value={config.validationDays} onChange={(v) => patch({ validationDays: v })} />
          <NumField label="Walk Size (days)" value={config.walkSize} onChange={(v) => patch({ walkSize: v })} />
          <NumField label="Minimum Events" value={config.minEvents} min={0} onChange={(v) => patch({ minEvents: v })} />
          <NumField label="Recent Window (days)" value={config.recentWindowDays} onChange={(v) => patch({ recentWindowDays: v })} />
        </div>
        <p className="mt-3 text-[11px] text-ink-faint">Default research period 30 days: training = first 20 days, validation = last 10 days. Walks slide by the walk size across the strategy's full date span ({result ? fmtInt(result.spanDays) : 0} days). Same-day / session context is inherited from the stored strategy.</p>
      </section>

      {result && result.walks.length === 0 && (
        <section className="card flex flex-col items-center gap-2 p-10 text-center"><AlertIcon className="text-2xl text-warning" /><h2 className="text-base font-semibold text-ink">No walks could be formed</h2><p className="max-w-md text-sm text-ink-muted">This strategy has no dated occurrences spanning the configured windows.</p></section>
      )}

      {result && result.walks.length > 0 && focusedWalk && (
        <>
          {/* Aggregate + export */}
          <section className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-ink-faint">Focused: <span className="font-mono text-ink">{result.record.id}</span> ({result.record.entryGap}/{result.record.recoveryGap}/{result.record.stopLoss})</span>
            <div className="ml-auto flex flex-wrap gap-2">
              <button type="button" onClick={() => downloadExport(walkForwardCsv(result))} className="btn flex items-center gap-1.5 px-3 py-1.5 text-sm"><DownloadIcon className="text-sm" /> CSV</button>
              <button type="button" onClick={() => downloadExport(walkForwardJson(result, stamp()))} className="btn flex items-center gap-1.5 px-3 py-1.5 text-sm"><DownloadIcon className="text-sm" /> JSON</button>
            </div>
          </section>

          <section>
            <h2 className="stat-label mb-2">Aggregated Results</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
              <StatCard label="Total Walks" value={fmtInt(result.aggregate.totalWalks)} />
              <StatCard label="Passed Walks" tone="positive" value={fmtInt(result.aggregate.passed)} />
              <StatCard label="Failed Walks" tone="negative" value={fmtInt(result.aggregate.failed)} hint={`${fmtInt(result.aggregate.borderline)} borderline`} />
              <StatCard label="Average Robustness" tone="accent" value={result.aggregate.avgRobustness !== null ? fmtNumber(result.aggregate.avgRobustness, 1) : '—'} />
              <StatCard label="Average Drift" tone="warning" value={result.aggregate.avgDrift !== null ? `${fmtNumber(result.aggregate.avgDrift, 1)}%` : '—'} tooltip="Mean absolute recovery-rate difference between training and validation." />
              <StatCard label="Avg Recovery Diff" value={result.aggregate.avgRecoveryDiff !== null ? `${fmtNumber(result.aggregate.avgRecoveryDiff, 1)}%` : '—'} />
            </div>
          </section>

          {/* Summary panel (focused walk) */}
          <section className="grid grid-cols-1 gap-4 lg:grid-cols-[240px_1fr]">
            <div className={['card flex flex-col items-center justify-center gap-1 border p-5 text-center', STATUS_TONE[focusedWalk.status]].join(' ')}>
              <div className="stat-label flex items-center gap-1.5"><ShieldIcon className="text-sm" /> Robustness · Walk #{focusedWalk.index + 1}</div>
              <div className={['font-mono text-4xl font-semibold', scoreTone(focusedWalk.robustness)].join(' ')}>{fmtNumber(focusedWalk.robustness, 1)}</div>
              <div className={['text-lg font-semibold', GRADE_TONE[focusedWalk.grade]].join(' ')}>{focusedWalk.grade}</div>
              <div className="text-sm font-semibold uppercase tracking-wide">{focusedWalk.status}</div>
              <div className="mt-1 text-[11px] text-ink-faint">train {focusedWalk.trainStart}→{focusedWalk.trainEnd} · val {focusedWalk.valStart}→{focusedWalk.valEnd}</div>
            </div>
            <div>
              <h2 className="stat-label mb-2">Training vs Validation</h2>
              <div className="overflow-x-auto rounded-lg border border-panel-border">
                <table className="w-full text-left text-xs">
                  <thead className="bg-panel text-ink-faint"><tr><th className="px-3 py-2 font-medium">Metric</th><th className="px-3 py-2 text-right font-medium">Training</th><th className="px-3 py-2 text-right font-medium">Validation</th><th className="px-3 py-2 text-right font-medium">Difference</th></tr></thead>
                  <tbody className="divide-y divide-panel-border font-mono">
                    <MetricRow label="Recovery %" t={focusedWalk.training.recoveryPct} v={focusedWalk.validation.recoveryPct} fmt={(x) => fmtPercent(x)} />
                    <MetricRow label="Probability %" t={focusedWalk.training.probabilityPct} v={focusedWalk.validation.probabilityPct} fmt={(x) => fmtPercent(x)} />
                    <MetricRow label="Avg Holding" t={focusedWalk.training.holdingAvgSec} v={focusedWalk.validation.holdingAvgSec} fmt={(x) => fmtDuration(x)} />
                    <MetricRow label="Avg Expansion" t={focusedWalk.training.expansionAvg} v={focusedWalk.validation.expansionAvg} fmt={(x) => fmtNumber(x, 3)} />
                    <MetricRow label="Worst Expansion" t={focusedWalk.training.expansionWorst} v={focusedWalk.validation.expansionWorst} fmt={(x) => fmtNumber(x, 3)} />
                    <MetricRow label="Reliability" t={focusedWalk.training.reliability} v={focusedWalk.validation.reliability} fmt={(x) => fmtNumber(x, 1)} />
                    <MetricRow label="Events" t={focusedWalk.training.events} v={focusedWalk.validation.events} fmt={(x) => fmtInt(x)} />
                  </tbody>
                </table>
              </div>
              {/* Drift chips */}
              <div className="mt-3 flex flex-wrap gap-2">
                {focusedWalk.drifts.map((d) => (
                  <span key={d.key} className={['inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium', DRIFT_TONE[d.level]].join(' ')}>
                    {d.label}: {d.level}
                  </span>
                ))}
              </div>
            </div>
          </section>

          {/* Timeline */}
          <section className="card p-5">
            <h2 className="stat-label mb-3">Walk-Forward Timeline (robustness + train vs validation recovery)</h2>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={timeline} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#1e293b' }} />
                  <YAxis domain={[0, 100]} width={36} tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#1e293b' }} />
                  <Tooltip contentStyle={{ background: '#111a2c', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }} formatter={(v: number, n: string) => [`${v}${n === 'Robustness' ? '' : '%'}`, n]} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="train" name="Train recovery" fill="#334155" radius={[2, 2, 0, 0]} isAnimationActive={false} />
                  <Bar dataKey="validation" name="Validation recovery" fill="#38bdf8" radius={[2, 2, 0, 0]} isAnimationActive={false} />
                  <Line dataKey="robustness" name="Robustness" stroke="#34d399" strokeWidth={2} dot={false} isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-2 text-[11px] text-ink-faint">Each walk: training (grey) vs validation (blue) recovery, with the robustness line. Click a row below to focus a walk.</p>
          </section>

          {/* Multiple walks table */}
          <section className="card overflow-hidden">
            <header className="flex items-center gap-2 border-b border-panel-border px-5 py-3"><TableIcon className="text-base text-accent" /><h2 className="text-sm font-semibold uppercase tracking-wide text-ink">Walks</h2><span className="ml-auto text-xs text-ink-faint">{fmtInt(result.walks.length)} walks · click to focus</span></header>
            <div className="max-h-[28rem] overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 z-10 bg-panel text-xs uppercase tracking-wide text-ink-faint">
                  <tr><th className="px-3 py-2 font-medium">Walk</th><th className="px-3 py-2 font-medium">Train</th><th className="px-3 py-2 font-medium">Validation</th><th className="px-3 py-2 text-right font-medium">Train Rec %</th><th className="px-3 py-2 text-right font-medium">Val Rec %</th><th className="px-3 py-2 text-right font-medium">Train Rel</th><th className="px-3 py-2 text-right font-medium">Val Rel</th><th className="px-3 py-2 text-right font-medium">Robustness</th><th className="px-3 py-2 font-medium">Grade</th><th className="px-3 py-2 font-medium">Status</th></tr>
                </thead>
                <tbody className="divide-y divide-panel-border font-mono text-xs">
                  {result.walks.map((w) => (
                    <tr key={w.index} onClick={() => setWalkIdx(w.index)} className={['cursor-pointer', w.index === focusedWalk.index ? 'bg-accent/10' : 'hover:bg-panel/50'].join(' ')}>
                      <td className="px-3 py-1.5 text-ink">#{w.index + 1}</td>
                      <td className="px-3 py-1.5 text-ink-faint">{w.trainStart}→{w.trainEnd}</td>
                      <td className="px-3 py-1.5 text-ink-faint">{w.valStart}→{w.valEnd}</td>
                      <td className="px-3 py-1.5 text-right text-ink-muted">{fmtPercent(w.training.recoveryPct)}</td>
                      <td className="px-3 py-1.5 text-right text-positive">{fmtPercent(w.validation.recoveryPct)}</td>
                      <td className="px-3 py-1.5 text-right text-ink-muted">{fmtNumber(w.training.reliability, 0)}</td>
                      <td className="px-3 py-1.5 text-right text-ink-muted">{fmtNumber(w.validation.reliability, 0)}</td>
                      <td className={['px-3 py-1.5 text-right font-semibold', scoreTone(w.robustness)].join(' ')}>{fmtNumber(w.robustness, 1)}</td>
                      <td className={['px-3 py-1.5 font-sans font-semibold', GRADE_TONE[w.grade]].join(' ')}>{w.grade}</td>
                      <td className="px-3 py-1.5 font-sans"><span className={['rounded px-1.5 py-0.5 text-[10px] font-semibold', STATUS_TONE[w.status]].join(' ')}>{w.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Warnings */}
          <section className="card p-5">
            <header className="mb-3 flex items-center gap-2"><AlertIcon className="text-base text-accent" /><h2 className="text-sm font-semibold uppercase tracking-wide text-ink">Validation Notes</h2></header>
            <ul className="space-y-2">{result.warnings.map((w, i) => (<li key={i} className="flex items-start gap-2 text-sm leading-relaxed text-ink-muted"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent/70" /><span>{w}</span></li>))}</ul>
          </section>
        </>
      )}
    </div>
  );
}

function MetricRow({ label, t, v, fmt }: { label: string; t: number | null; v: number | null; fmt: (x: number | null) => string }) {
  const diff = t !== null && v !== null ? v - t : null;
  const tone = diff === null ? 'text-ink-faint' : diff > 1e-9 ? 'text-positive' : diff < -1e-9 ? 'text-negative' : 'text-ink-faint';
  return (
    <tr className="hover:bg-panel/40">
      <td className="px-3 py-1.5 font-sans text-ink-muted">{label}</td>
      <td className="px-3 py-1.5 text-right text-ink">{fmt(t)}</td>
      <td className="px-3 py-1.5 text-right text-ink">{fmt(v)}</td>
      <td className={['px-3 py-1.5 text-right', tone].join(' ')}>{diff === null ? '—' : `${diff >= 0 ? '+' : ''}${fmt(diff)}`}</td>
    </tr>
  );
}

function Banner() {
  return (
    <section className="card flex flex-wrap items-start gap-3 border-accent/30 bg-accent/5 p-4">
      <ShieldIcon className="mt-0.5 text-base text-accent" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold text-ink">Walk Forward Validation</p><span className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">Validation Engine v1.0</span></div>
        <p className="mt-1 text-sm leading-relaxed text-ink-muted">Does a historically strong strategy still hold up on unseen historical windows? This splits a stored strategy's occurrences into training and validation periods and compares them. Validation only — it never optimizes, regenerates or recommends.</p>
      </div>
    </section>
  );
}
