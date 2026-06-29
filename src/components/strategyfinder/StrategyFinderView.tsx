/**
 * Historical Strategy Finder — Foundation Mode (Phase 11A).
 *
 * Generates and validates research parameter combinations. It does NOT execute
 * the Research Engine, and computes no recovery / score / ranking. The
 * generation pass is memoized and reused until the inputs change.
 *
 * This is a research parameter builder — never a trading signal or
 * recommendation.
 */

import { useMemo, useState, type ReactNode } from 'react';
import { useData } from '@/context/DataContext';
import {
  DEFAULT_STRATEGY_FINDER_INPUT,
  generateStrategies,
  MAX_COMBINATIONS,
  type NumericRange,
  type StrategyCombination,
  type StrategyFinderInput,
  type StrategyStatus,
} from '@/utils/strategyFinder';
import { ChipMultiSelect } from '@/components/filters/ChipMultiSelect';
import { StatCard } from '@/components/overview/StatCard';
import { fmtInt, fmtNumber } from '@/utils/format';
import { AlertIcon, TableIcon, TargetIcon } from '@/components/common/icons';

const ROW_RENDER_CAP = 500;

const STATUS_STYLE: Record<StrategyStatus, string> = {
  PENDING: 'bg-ink-faint/15 text-ink-faint',
  READY: 'bg-positive/20 text-positive',
  INVALID: 'bg-negative/20 text-negative',
  DUPLICATE: 'bg-warning/20 text-warning',
};

function NumField({
  label,
  value,
  step,
  onChange,
}: {
  label: string;
  value: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="stat-label">{label}</span>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v)) onChange(v);
        }}
        className="w-full rounded-md border border-panel-border bg-panel px-3 py-1.5 text-sm text-ink focus:border-accent focus:outline-none"
      />
    </label>
  );
}

function RangeRow({
  label,
  range,
  onChange,
}: {
  label: string;
  range: NumericRange;
  onChange: (r: NumericRange) => void;
}) {
  return (
    <div className="rounded-lg border border-panel-border p-3">
      <div className="stat-label mb-2">{label}</div>
      <div className="grid grid-cols-3 gap-3">
        <NumField label="Start" value={range.start} step={0.1} onChange={(start) => onChange({ ...range, start })} />
        <NumField label="End" value={range.end} step={0.1} onChange={(end) => onChange({ ...range, end })} />
        <NumField label="Step" value={range.step} step={0.05} onChange={(step) => step > 0 && onChange({ ...range, step })} />
      </div>
    </div>
  );
}

function SummaryCard({ label, value, tone, tooltip }: { label: string; value: ReactNode; tone?: 'default' | 'positive' | 'warning' | 'negative' | 'accent'; tooltip?: string }) {
  return <StatCard label={label} value={value} tone={tone} tooltip={tooltip} />;
}

export function StrategyFinderView() {
  const { filterOptions } = useData();
  const [input, setInput] = useState<StrategyFinderInput>(DEFAULT_STRATEGY_FINDER_INPUT);
  const [statusFilter, setStatusFilter] = useState<'ALL' | StrategyStatus>('ALL');

  const patch = (p: Partial<StrategyFinderInput>) => setInput((prev) => ({ ...prev, ...p }));

  // Single memoized generation pass — reused until the inputs change.
  const result = useMemo(() => generateStrategies(input), [input]);

  const sessionOptions = filterOptions?.sessions ?? [];

  const filtered = useMemo(() => {
    if (statusFilter === 'ALL') return result.combinations;
    return result.combinations.filter((c) => c.status === statusFilter);
  }, [result.combinations, statusFilter]);

  const shown = filtered.slice(0, ROW_RENDER_CAP);

  const warnings: string[] = [];
  if (result.summary.generated === 0) {
    warnings.push('No combinations generated — check that each range has Start ≤ End and a positive Step.');
  }
  if (result.truncated) {
    warnings.push(`Combination count hit the ${fmtInt(MAX_COMBINATIONS)} cap — narrow the ranges or increase the step size to cover the full grid.`);
  }
  if (result.summary.generated > 0 && result.summary.valid === 0) {
    warnings.push('Every combination was rejected by validation. Recovery must be below Entry, and Stop Loss above Entry (and above Recovery).');
  }

  return (
    <div className="space-y-5">
      {/* Foundation banner */}
      <section className="card flex items-start gap-3 border-accent/30 bg-accent/5 p-4">
        <TargetIcon className="mt-0.5 text-base text-accent" />
        <div>
          <p className="text-sm font-semibold text-ink">Foundation Mode</p>
          <p className="mt-0.5 text-sm leading-relaxed text-ink-muted">
            This page only generates and validates research parameter
            combinations. It does not run the Research Engine and computes no
            recovery, score or ranking — those arrive in later phases. Nothing
            here is a trading signal or recommendation.
          </p>
        </div>
      </section>

      {/* Inputs */}
      <section className="card p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="stat-label">Parameter Ranges</span>
          <button type="button" onClick={() => setInput(DEFAULT_STRATEGY_FINDER_INPUT)} className="btn px-2 py-1">
            Reset
          </button>
        </div>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <RangeRow label="Entry Gap" range={input.entry} onChange={(entry) => patch({ entry })} />
          <RangeRow label="Recovery Gap" range={input.recovery} onChange={(recovery) => patch({ recovery })} />
          <RangeRow label="Stop Loss" range={input.stopLoss} onChange={(stopLoss) => patch({ stopLoss })} />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
          <NumField label="Min Historical Trades" value={input.minTrades} step={1} onChange={(minTrades) => patch({ minTrades: Math.max(0, Math.round(minTrades)) })} />
          <label className="flex flex-col gap-1">
            <span className="stat-label">Max Holding (min)</span>
            <input
              type="number"
              step={1}
              value={input.maxHoldingMinutes ?? ''}
              placeholder="∞"
              onChange={(e) => {
                const raw = e.target.value.trim();
                patch({ maxHoldingMinutes: raw === '' ? null : Math.max(0, Number(raw)) });
              }}
              className="w-full rounded-md border border-panel-border bg-panel px-3 py-1.5 text-sm text-ink focus:border-accent focus:outline-none"
            />
          </label>
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

        <div className="mt-4">
          <ChipMultiSelect label="Session Filter" options={sessionOptions} selected={input.sessions} onChange={(sessions) => patch({ sessions })} />
        </div>

        <p className="mt-3 text-[11px] text-ink-faint">
          Validation rejects any combination where Recovery ≥ Entry, Stop Loss ≤
          Entry, or Recovery ≥ Stop Loss, plus duplicates and invalid numbers.
          Only READY combinations will be sent to the Research Engine in a later
          phase.
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

      {/* Summary */}
      <section>
        <h2 className="stat-label mb-2">Generation Summary</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          <SummaryCard label="Generated Combinations" value={fmtInt(result.summary.generated)} tooltip="Total parameter combinations produced from the ranges." />
          <SummaryCard label="Valid Combinations" tone="positive" value={fmtInt(result.summary.valid)} tooltip="Combinations that passed validation (status READY)." />
          <SummaryCard label="Rejected Combinations" tone="warning" value={fmtInt(result.summary.rejected)} tooltip="Invalid + duplicate combinations." />
          <SummaryCard label="Duplicate Combinations" tone="warning" value={fmtInt(result.summary.duplicates)} tooltip="Combinations whose Entry/Recovery/Stop-Loss triplet already existed." />
          <SummaryCard label="Invalid Combinations" tone="negative" value={fmtInt(result.summary.invalid)} tooltip="Combinations rejected by a validation rule." />
        </div>
      </section>

      {/* Table */}
      <section className="card overflow-hidden">
        <header className="flex flex-wrap items-center gap-2 border-b border-panel-border px-5 py-3">
          <TableIcon className="text-base text-accent" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink">
            Parameter Combinations
          </h2>
          <span className="text-xs text-ink-faint">
            {fmtInt(filtered.length)}
            {filtered.length > shown.length ? ` (showing first ${fmtInt(shown.length)})` : ''}
          </span>
          <label className="ml-auto flex items-center gap-2 text-xs">
            <span className="stat-label">Status</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'ALL' | StrategyStatus)}
              className="rounded-md border border-panel-border bg-panel px-2 py-1 text-ink focus:border-accent focus:outline-none"
            >
              <option value="ALL">All</option>
              <option value="READY">Ready</option>
              <option value="INVALID">Invalid</option>
              <option value="DUPLICATE">Duplicate</option>
              <option value="PENDING">Pending</option>
            </select>
          </label>
        </header>
        <div className="max-h-[34rem] overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 z-10 bg-panel text-xs uppercase tracking-wide text-ink-faint">
              <tr>
                <th className="px-3 py-2 font-medium">ID</th>
                <th className="px-3 py-2 text-right font-medium">Entry</th>
                <th className="px-3 py-2 text-right font-medium">Recovery</th>
                <th className="px-3 py-2 text-right font-medium">Stop Loss</th>
                <th className="px-3 py-2 text-center font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Validation Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-panel-border font-mono text-xs">
              {shown.map((c: StrategyCombination) => (
                <tr key={c.id} className="hover:bg-panel/50">
                  <td className="px-3 py-1.5 text-ink-muted">{c.id}</td>
                  <td className="px-3 py-1.5 text-right text-ink">{fmtNumber(c.entryGap, 2)}</td>
                  <td className="px-3 py-1.5 text-right text-ink-muted">{fmtNumber(c.recoveryGap, 2)}</td>
                  <td className="px-3 py-1.5 text-right text-ink-muted">{fmtNumber(c.stopLoss, 2)}</td>
                  <td className="px-3 py-1.5 text-center">
                    <span className={['rounded px-1.5 py-0.5 text-[10px] font-semibold', STATUS_STYLE[c.status]].join(' ')}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 font-sans text-ink-muted">{c.validationResult}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-ink-faint">
                    No combinations for this status — adjust the ranges or the filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <footer className="border-t border-panel-border px-5 py-2 text-[11px] text-ink-faint">
          Parameter generation only — no Research Engine calls, no recovery or
          score computed. READY rows are the validated foundation for later
          phases.
        </footer>
      </section>
    </div>
  );
}
