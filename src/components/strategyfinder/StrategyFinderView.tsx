/**
 * Historical Strategy Finder — Research Execution (Phase 11B).
 *
 * Phase 11A (parameter generation + validation) is unchanged and frozen. This
 * phase adds the execution layer: it runs the FROZEN Research Engine v1.0
 * sequentially for every READY combination, with caching, a live progress
 * panel, pause / resume / stop, per-strategy error isolation and a live results
 * table.
 *
 * It NEVER ranks, scores, compares or recommends — it only executes historical
 * research and stores the results.
 */

import { useMemo, useState, type ReactNode } from 'react';
import { useData } from '@/context/DataContext';
import {
  DEFAULT_STRATEGY_FINDER_INPUT,
  generateStrategies,
  MAX_COMBINATIONS,
  type NumericRange,
  type StrategyFinderInput,
} from '@/utils/strategyFinder';
import { ChipMultiSelect } from '@/components/filters/ChipMultiSelect';
import { StatCard } from '@/components/overview/StatCard';
import { fmtInt } from '@/utils/format';
import { AlertIcon, TargetIcon } from '@/components/common/icons';
import { useStrategyExecution } from '@/components/strategyfinder/useStrategyExecution';
import {
  StrategyExecutionPanel,
  StrategyExecutionSummary,
} from '@/components/strategyfinder/StrategyExecutionPanel';
import { StrategyResultsTable } from '@/components/strategyfinder/StrategyResultsTable';

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
  const { filterOptions, filteredSamples } = useData();
  const [input, setInput] = useState<StrategyFinderInput>(DEFAULT_STRATEGY_FINDER_INPUT);

  const patch = (p: Partial<StrategyFinderInput>) => setInput((prev) => ({ ...prev, ...p }));

  // Phase 11A: single memoized generation + validation pass.
  const result = useMemo(() => generateStrategies(input), [input]);

  // Only READY combinations are executable.
  const readyCombos = useMemo(
    () => result.combinations.filter((c) => c.status === 'READY'),
    [result],
  );

  // Apply this page's date range to the (already globally-filtered) samples.
  // Sessions / same-day are applied by the Research Engine per combination.
  const dateFilteredSamples = useMemo(() => {
    const { from, to } = input.dateRange;
    if (!from && !to) return filteredSamples;
    return filteredSamples.filter((s) => {
      if (from && s.dayKey < from) return false;
      if (to && s.dayKey > to) return false;
      return true;
    });
  }, [filteredSamples, input.dateRange]);

  // Phase 11B: execution controller (sequential, cached, interruptible).
  const exec = useStrategyExecution(readyCombos, dateFilteredSamples, input.minTrades);

  const sessionOptions = filterOptions?.sessions ?? [];

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
  if (readyCombos.length > 0 && dateFilteredSamples.length === 0) {
    warnings.push('The current date range leaves no samples to research. Widen the date range.');
  }

  return (
    <div className="space-y-5">
      {/* Banner */}
      <section className="card flex items-start gap-3 border-accent/30 bg-accent/5 p-4">
        <TargetIcon className="mt-0.5 text-base text-accent" />
        <div>
          <p className="text-sm font-semibold text-ink">Historical Research Execution</p>
          <p className="mt-0.5 text-sm leading-relaxed text-ink-muted">
            Generates and validates parameter combinations, then runs the frozen
            Research Engine v1.0 once per READY strategy and stores the historical
            result. Identical strategies are never rerun. This page does not rank,
            score or compare strategies, and makes no recommendation — it only
            executes historical research.
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
          Only READY combinations are sent to the Research Engine.
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

      {/* Generation summary (Phase 11A) */}
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

      {/* Execution controls + live progress (Phase 11B) */}
      <StrategyExecutionPanel
        progress={exec.progress}
        running={exec.running}
        paused={exec.paused}
        canStart={exec.progress.remaining > 0 && dateFilteredSamples.length > 0}
        onStart={exec.start}
        onPause={exec.pause}
        onResume={exec.resume}
        onStop={exec.stop}
        onReset={exec.reset}
      />

      <StrategyExecutionSummary progress={exec.progress} />

      <StrategyResultsTable executions={exec.executions} />
    </div>
  );
}
