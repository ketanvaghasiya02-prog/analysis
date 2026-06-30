/**
 * Probability Engine v1.0 — Core (Phase 12A).
 *
 * Historical compression-probability research: for a current gap, how often did
 * the gap historically compress to each lower target gap, and how long did it
 * take? Everything is computed from uploaded CSV history by the standalone
 * Probability Engine — the Research Engine is never used here.
 *
 * Research only — no trading, no broker, no buy/sell signals, no
 * recommendations.
 */

import { useMemo, useState } from 'react';
import { useData } from '@/context/DataContext';
import {
  computeProbability,
  DEFAULT_PROBABILITY_INPUT,
  type ProbabilityInput,
  type ProbabilityTargetRow,
} from '@/utils/probability';
import { OpportunityScanner } from '@/components/probability/OpportunityScanner';
import { ChipMultiSelect } from '@/components/filters/ChipMultiSelect';
import { StatCard } from '@/components/overview/StatCard';
import { EmptyState } from '@/components/common/EmptyState';
import { fmtDuration, fmtInt, fmtNumber, fmtPercent } from '@/utils/format';
import { AlertIcon, ChartIcon, TableIcon } from '@/components/common/icons';

function NumField({
  label,
  value,
  step,
  placeholder,
  onChange,
}: {
  label: string;
  value: number | null;
  step: number;
  placeholder?: string;
  onChange: (v: number | null) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="stat-label">{label}</span>
      <input
        type="number"
        step={step}
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(e) => {
          const raw = e.target.value.trim();
          if (raw === '') onChange(null);
          else {
            const v = Number(raw);
            if (Number.isFinite(v)) onChange(v);
          }
        }}
        className="w-full rounded-md border border-panel-border bg-panel px-3 py-1.5 text-sm text-ink focus:border-accent focus:outline-none"
      />
    </label>
  );
}

function probTone(p: number): string {
  if (p >= 66) return 'text-positive';
  if (p >= 33) return 'text-warning';
  return 'text-negative';
}

export function ProbabilityView() {
  const { filteredSamples, filterOptions } = useData();
  const [input, setInput] = useState<ProbabilityInput>(DEFAULT_PROBABILITY_INPUT);

  const patch = (p: Partial<ProbabilityInput>) => setInput((prev) => ({ ...prev, ...p }));

  // Single memoized scan — all targets evaluated together, no per-target rescan.
  const result = useMemo(() => computeProbability(filteredSamples, input), [filteredSamples, input]);

  const sessionOptions = filterOptions?.sessions ?? [];
  const syncOptions = filterOptions?.syncStatuses ?? [];

  const hasSl = input.stopLossGap !== null;

  // KPI derivations from the existing matrix (no recalculation).
  const rows = result.rows;
  const highestProb =
    rows.length > 0 ? rows.reduce((a, b) => (b.probabilityPct > a.probabilityPct ? b : a)) : null;
  const target90 = rows
    .filter((r) => r.probabilityPct >= 90)
    .reduce<ProbabilityTargetRow | null>((deepest, r) => (!deepest || r.targetGap < deepest.targetGap ? r : deepest), null);
  const recoveryTimes = rows.map((r) => r.avgTimeSec).filter((v): v is number => v !== null);
  const avgRecovery = recoveryTimes.length ? recoveryTimes.reduce((a, b) => a + b, 0) / recoveryTimes.length : null;
  const confidenceLabel = rows[0]?.confidenceLabel ?? '—';

  const warnings: string[] = [];
  if (input.targetStart < input.targetEnd) {
    warnings.push('Target Start should be greater than Target End — the ladder runs downward from Start to End.');
  }
  if (result.meta.rejectedTargets > 0) {
    warnings.push(`${fmtInt(result.meta.rejectedTargets)} target(s) at or above the Current Gap were rejected — targets must be below the Current Gap.`);
  }
  if (result.rows.length === 0) {
    warnings.push('No valid targets. Targets must be below the Current Gap and Start must be above End.');
  }
  if (result.meta.truncated) {
    warnings.push('Target ladder capped at 400 steps — increase the step size to cover the full range.');
  }
  const lowConfidence = result.totalEvents > 0 && result.totalEvents < input.minEvents;

  // No data → dedicated empty state.
  if (filteredSamples.length === 0) {
    return (
      <EmptyState
        title="No uploaded data"
        description="Upload one or more GapMonitor CSV exports to research historical compression probability. The Probability Engine reads only your uploaded history — nothing is predicted."
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* Status + disclaimer */}
      <section className="card flex items-start gap-3 border-accent/30 bg-accent/5 p-4">
        <ChartIcon className="mt-0.5 text-base text-accent" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-ink">Historical compression probability</p>
            <span className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
              Probability Engine v1.0 — Core
            </span>
          </div>
          <p className="mt-1 text-sm leading-relaxed text-ink-muted">
            For the Current Gap below, this shows how often the gap historically
            compressed to each lower target, and how long it took. Every figure is
            historical evidence from uploaded CSV data — not a trading signal, and
            never a recommendation to take profit or enter a trade.
          </p>
        </div>
      </section>

      {/* Inputs */}
      <section className="card p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="stat-label">Probability Inputs</span>
          <button type="button" onClick={() => setInput(DEFAULT_PROBABILITY_INPUT)} className="btn px-2 py-1">
            Reset
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
          <NumField label="Current Gap" value={input.currentGap} step={0.1} onChange={(v) => patch({ currentGap: v ?? 0 })} />
          <NumField label="Target Start Gap" value={input.targetStart} step={0.1} onChange={(v) => patch({ targetStart: v ?? 0 })} />
          <NumField label="Target End Gap" value={input.targetEnd} step={0.1} onChange={(v) => patch({ targetEnd: v ?? 0 })} />
          <NumField label="Target Step" value={input.targetStep} step={0.05} onChange={(v) => v && v > 0 && patch({ targetStep: v })} />
          <NumField label="Stop Loss Gap" value={input.stopLossGap} step={0.1} placeholder="optional" onChange={(v) => patch({ stopLossGap: v })} />
          <NumField label="Max Holding (min)" value={input.maxHoldingMinutes} step={1} placeholder="optional" onChange={(v) => patch({ maxHoldingMinutes: v })} />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
          <label className="flex flex-col gap-1">
            <span className="stat-label">Same Day Only</span>
            <button
              type="button"
              onClick={() => patch({ sameDayOnly: !input.sameDayOnly })}
              className={['btn px-3 py-1.5', input.sameDayOnly ? 'btn-active' : ''].join(' ')}
            >
              {input.sameDayOnly ? 'On' : 'Off'}
            </button>
          </label>
          <NumField label="Minimum Events" value={input.minEvents} step={1} onChange={(v) => patch({ minEvents: v != null ? Math.max(0, Math.round(v)) : 0 })} />
          <label className="flex flex-col gap-1">
            <span className="stat-label">Date From</span>
            <input
              type="date"
              value={input.dateRange.from}
              onChange={(e) => patch({ dateRange: { ...input.dateRange, from: e.target.value } })}
              className="w-full rounded-md border border-panel-border bg-panel px-3 py-1.5 text-sm text-ink focus:border-accent focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="stat-label">Date To</span>
            <input
              type="date"
              value={input.dateRange.to}
              onChange={(e) => patch({ dateRange: { ...input.dateRange, to: e.target.value } })}
              className="w-full rounded-md border border-panel-border bg-panel px-3 py-1.5 text-sm text-ink focus:border-accent focus:outline-none"
            />
          </label>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ChipMultiSelect label="Session Filter" options={sessionOptions} selected={input.sessions} onChange={(sessions) => patch({ sessions })} />
          <ChipMultiSelect label="Sync Status Filter" options={syncOptions} selected={input.syncStatuses} onChange={(syncStatuses) => patch({ syncStatuses })} />
        </div>

        <p className="mt-3 text-[11px] text-ink-faint">
          An event opens when the gap first crosses up to the Current Gap; only one
          position is open at a time. All targets are evaluated in a single
          historical scan. A target counts as reached when the gap touches at or
          below it after entry.
        </p>
      </section>

      {warnings.length > 0 && (
        <section className="space-y-2">
          {warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm text-warning">
              <AlertIcon className="mt-0.5 text-base" />
              <span>{w}</span>
            </div>
          ))}
        </section>
      )}

      {lowConfidence && (
        <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm text-warning">
          <AlertIcon className="mt-0.5 text-base" />
          <span>
            Low confidence: only {fmtInt(result.totalEvents)} historical event(s) for this Current Gap,
            below the minimum of {fmtInt(input.minEvents)}. Probabilities are statistically weak.
          </span>
        </div>
      )}

      {/* KPI cards */}
      <section>
        <h2 className="stat-label mb-2">Summary</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <StatCard label="Current Gap" value={fmtNumber(result.meta.currentGap, 2)} />
          <StatCard
            label="Highest Historical Probability"
            tone="positive"
            value={highestProb ? fmtPercent(highestProb.probabilityPct) : '—'}
            hint={highestProb ? `to ${fmtNumber(highestProb.targetGap, 2)}` : undefined}
            tooltip="Highest historical compression probability across all tested targets."
          />
          <StatCard
            label="90% Probability Target"
            tone="accent"
            value={target90 ? fmtNumber(target90.targetGap, 2) : '—'}
            hint={target90 ? `${fmtPercent(target90.probabilityPct)} historical` : 'none ≥ 90%'}
            tooltip="Deepest target gap that still has at least 90% historical compression probability."
          />
          <StatCard
            label="Average Historical Recovery Time"
            value={fmtDuration(avgRecovery)}
            tooltip="Mean historical time-to-target across targets that were reached."
          />
          <StatCard
            label="Largest Historical Dataset"
            value={fmtInt(result.totalEvents)}
            tooltip="Historical events where the gap first crossed up to the Current Gap (one position at a time)."
          />
          <StatCard label="Research Confidence" value={confidenceLabel} tooltip="Based on the number of historical events (the probability denominator)." />
        </div>
      </section>

      {/* Probability matrix table */}
      <section className="card overflow-hidden">
        <header className="flex flex-wrap items-center gap-2 border-b border-panel-border px-5 py-3">
          <TableIcon className="text-base text-accent" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink">Probability Matrix</h2>
          <span className="text-xs text-ink-faint">{fmtInt(result.rows.length)} targets</span>
          <span className="ml-auto text-[11px] text-ink-faint">
            {fmtInt(result.meta.eventScans)} event scans · {fmtNumber(result.meta.calcTimeMs, 1)} ms
          </span>
        </header>
        <div className="max-h-[34rem] overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 z-10 bg-panel text-xs uppercase tracking-wide text-ink-faint">
              <tr>
                <th className="px-3 py-2 font-medium">Target Gap</th>
                <th className="px-3 py-2 text-right font-medium">Probability %</th>
                <th className="px-3 py-2 text-right font-medium">Reached</th>
                <th className="px-3 py-2 text-right font-medium">Total Events</th>
                <th className="px-3 py-2 text-right font-medium">Avg Time</th>
                <th className="px-3 py-2 text-right font-medium">Median Time</th>
                <th className="px-3 py-2 text-right font-medium">P95 Max Gap</th>
                <th className="px-3 py-2 text-right font-medium">Worst Max Gap</th>
                {hasSl && <th className="px-3 py-2 text-right font-medium">SL Before Target %</th>}
                <th className="px-3 py-2 font-medium">Confidence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-panel-border font-mono text-xs">
              {result.rows.map((r) => (
                <tr key={r.targetGap} className="hover:bg-panel/50">
                  <td className="px-3 py-1.5 text-ink">{fmtNumber(r.targetGap, 2)}</td>
                  <td className={['px-3 py-1.5 text-right font-semibold', probTone(r.probabilityPct)].join(' ')}>{fmtPercent(r.probabilityPct)}</td>
                  <td className="px-3 py-1.5 text-right text-ink-muted">{fmtInt(r.reachedCount)}</td>
                  <td className="px-3 py-1.5 text-right text-ink-muted">{fmtInt(r.totalEvents)}</td>
                  <td className="px-3 py-1.5 text-right text-ink-muted">{fmtDuration(r.avgTimeSec)}</td>
                  <td className="px-3 py-1.5 text-right text-ink-muted">{fmtDuration(r.medianTimeSec)}</td>
                  <td className="px-3 py-1.5 text-right text-ink-muted">{fmtNumber(r.p95MaxGap, 3)}</td>
                  <td className="px-3 py-1.5 text-right text-negative">{fmtNumber(r.worstMaxGap, 3)}</td>
                  {hasSl && <td className="px-3 py-1.5 text-right text-warning">{r.slBeforeTargetPct !== null ? fmtPercent(r.slBeforeTargetPct) : '—'}</td>}
                  <td className="px-3 py-1.5 font-sans text-ink-muted">{r.confidenceLabel}</td>
                </tr>
              ))}
              {result.rows.length === 0 && (
                <tr>
                  <td colSpan={hasSl ? 10 : 9} className="px-3 py-6 text-center text-ink-faint">
                    No valid targets below the Current Gap.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <footer className="border-t border-panel-border px-5 py-2 text-[11px] text-ink-faint">
          Historical compression probability only. Each row is descriptive evidence
          from uploaded history — never a recommendation to take profit or trade.
        </footer>
      </section>

      {/* Historical Opportunity Scanner (Phase 12B) — reads the matrix above */}
      <div className="flex items-center gap-3 pt-1">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink">Opportunity Intelligence</h2>
        <span className="h-px flex-1 bg-panel-border" />
        <span className="text-[11px] text-ink-faint">surfaces strong historical compressions</span>
      </div>
      <OpportunityScanner result={result} currentGap={input.currentGap} />

      {/* Placeholder chart area — probability curve (planned) */}
      <section className="card p-5">
        <header className="mb-3 flex items-center gap-2">
          <ChartIcon className="text-base text-accent" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink">Probability Curve</h2>
          <span className="ml-auto rounded-full border border-panel-border bg-panel-raised px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
            Planned
          </span>
        </header>
        <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-panel-border bg-panel-raised/40 text-center text-sm text-ink-faint">
          Probability-vs-target and time-to-target charts are planned. The matrix
          and opportunity scanner above already hold all the underlying historical
          values.
        </div>
      </section>
    </div>
  );
}
