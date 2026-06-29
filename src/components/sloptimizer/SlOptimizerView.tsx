/**
 * Stop Loss Optimizer page (additive).
 *
 * Sweeps stop-loss values and reports the historical statistical outcome at each
 * (via the Research Engine v1.0). It NEVER recommends trades — every figure is a
 * description of what historically happened. Gap points only.
 */

import { useMemo, useState } from 'react';
import { useData } from '@/context/DataContext';
import {
  DEFAULT_SL_OPTIMIZER_INPUT,
  optimizerCsv,
  optimizerJson,
  printOptimizerPdf,
  runSlOptimizer,
  type SlOptimizerInput,
  type SlOptimizerRow,
} from '@/utils/slOptimizer';
import { downloadExport } from '@/utils/reports';
import { SlOptimizerTable } from '@/components/sloptimizer/SlOptimizerTable';
import { SlOptimizerValidation } from '@/components/sloptimizer/SlOptimizerValidation';
import { SlOptimizerCharts } from '@/components/sloptimizer/SlOptimizerCharts';
import { ChipMultiSelect } from '@/components/filters/ChipMultiSelect';
import { StatCard } from '@/components/overview/StatCard';
import { fmtDuration, fmtNumber, fmtPercent } from '@/utils/format';
import { AlertIcon } from '@/components/common/icons';

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

function HighlightCard({
  label,
  row,
  metric,
  tooltip,
}: {
  label: string;
  row: SlOptimizerRow | null;
  metric: (r: SlOptimizerRow) => string;
  tooltip: string;
}) {
  return (
    <StatCard
      label={label}
      tooltip={tooltip}
      tone="accent"
      value={row ? <span className="text-base">{fmtNumber(row.stopLoss, 2)}</span> : '—'}
      hint={row ? metric(row) : undefined}
    />
  );
}

export function SlOptimizerView() {
  const { filteredSamples, filterOptions } = useData();
  const [input, setInput] = useState<SlOptimizerInput>(DEFAULT_SL_OPTIMIZER_INPUT);

  const patch = (p: Partial<SlOptimizerInput>) => setInput((prev) => ({ ...prev, ...p }));

  const result = useMemo(
    () => runSlOptimizer(filteredSamples, input),
    [filteredSamples, input],
  );

  const positions = result.rows[0]?.totalPositions ?? 0;

  const warnings: string[] = [];
  if (input.minStopLoss >= input.maxStopLoss) {
    warnings.push('Minimum Stop Loss must be below Maximum Stop Loss.');
  }
  if (positions === 0) {
    warnings.push(
      'No positions for this Entry Gap on the filtered data. Adjust Entry Gap / filters so the Research Engine finds entries.',
    );
  }
  if (result.truncated) {
    warnings.push('SL range capped at 400 steps — increase the step size to cover the full range.');
  }

  const sessionOptions = filterOptions?.sessions ?? [];
  const syncOptions = filterOptions?.syncStatuses ?? [];
  const stamp = () => new Date().toISOString();

  return (
    <div className="space-y-5">
      {/* Disclaimer */}
      <section className="card flex items-start gap-3 border-accent/30 bg-accent/5 p-4">
        <AlertIcon className="mt-0.5 text-base text-accent" />
        <p className="text-sm leading-relaxed text-ink">
          This tool answers “for Entry Gap X and Recovery Gap Y, which historical
          stop-loss values performed best?” using the Research Engine. It is not a
          trading signal and makes no recommendation — each row states only that
          “historically this stop-loss produced the following statistical outcome.”
        </p>
      </section>

      {/* Inputs */}
      <section className="card p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="stat-label">Optimizer Inputs</span>
          <button
            type="button"
            onClick={() => setInput(DEFAULT_SL_OPTIMIZER_INPUT)}
            className="btn px-2 py-1"
          >
            Reset
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
          <NumField label="Entry Gap" value={input.entryGap} step={0.1} onChange={(entryGap) => patch({ entryGap })} />
          <NumField label="Recovery Gap" value={input.recoveryGap} step={0.1} onChange={(recoveryGap) => patch({ recoveryGap })} />
          <NumField label="Minimum SL" value={input.minStopLoss} step={0.1} onChange={(minStopLoss) => patch({ minStopLoss })} />
          <NumField label="Maximum SL" value={input.maxStopLoss} step={0.1} onChange={(maxStopLoss) => patch({ maxStopLoss })} />
          <NumField label="SL Step" value={input.step} step={0.05} onChange={(step) => step > 0 && patch({ step })} />
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
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ChipMultiSelect label="Session Filter" options={sessionOptions} selected={input.sessions} onChange={(sessions) => patch({ sessions })} />
          <ChipMultiSelect label="Sync Status Filter" options={syncOptions} selected={input.syncStatuses} onChange={(syncStatuses) => patch({ syncStatuses })} />
        </div>
        <p className="mt-3 text-[11px] text-ink-faint">
          Date range and the global session/sync selection from the dashboard
          filters also apply. Each SL value runs the full Research Engine once.
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

      {/* Export */}
      <section className="flex flex-wrap gap-2">
        <button type="button" onClick={() => downloadExport(optimizerCsv(result))} className="btn px-3 py-1.5" disabled={result.rows.length === 0}>
          Export CSV
        </button>
        <button type="button" onClick={() => downloadExport(optimizerJson(result, stamp()))} className="btn px-3 py-1.5" disabled={result.rows.length === 0}>
          Export JSON
        </button>
        <button type="button" onClick={() => printOptimizerPdf(result, stamp())} className="btn px-3 py-1.5" disabled={result.rows.length === 0}>
          Export PDF
        </button>
      </section>

      {/* Highlights */}
      <section>
        <h2 className="stat-label mb-2">Highlights</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          <HighlightCard
            label="Best Balanced SL"
            row={result.balanced}
            tooltip="First stop-loss where increasing it further adds almost no historical recovery-before-SL."
            metric={(r) => `recovery ${fmtPercent(r.recoveryBeforeSlPct)}`}
          />
          <HighlightCard
            label="Highest Recovery SL"
            row={result.maxSuccess}
            tooltip="Highest historical recovery-before-SL (risk may be excessive — shown for context only)."
            metric={(r) => `recovery ${fmtPercent(r.recoveryBeforeSlPct)}`}
          />
          <HighlightCard
            label="Fastest Recovery SL"
            row={result.fastest}
            tooltip="Lowest average historical recovery time."
            metric={(r) => `avg ${fmtDuration(r.avgRecoverySec)}`}
          />
          <HighlightCard
            label="Lowest Risk SL"
            row={result.lowestRisk}
            tooltip="Lowest average maximum gap reached after entry."
            metric={(r) => `avg max ${fmtNumber(r.avgMaxGap, 3)}`}
          />
          <HighlightCard
            label="Highest Score SL"
            row={result.highestScore}
            tooltip="Highest balanced score (recovery, risk, holding, confidence)."
            metric={(r) => `score ${fmtNumber(r.score, 1)}`}
          />
        </div>
      </section>

      {/* Summary */}
      {result.balanced && positions > 0 && (
        <section className="card border-accent/20 bg-accent/5 p-5">
          <h2 className="stat-label mb-3">Historical Summary</h2>
          <p className="text-sm leading-relaxed text-ink">
            For Entry Gap{' '}
            <span className="font-semibold text-accent">{fmtNumber(input.entryGap, 2)}</span> and
            Recovery Gap{' '}
            <span className="font-semibold text-accent">{fmtNumber(input.recoveryGap, 2)}</span>,
            historical testing across the filtered data shows a balanced stop-loss of{' '}
            <span className="font-semibold text-positive">{fmtNumber(result.balanced.stopLoss, 2)}</span>{' '}
            with historical recovery-before-SL{' '}
            <span className="font-semibold text-positive">{fmtPercent(result.balanced.recoveryBeforeSlPct)}</span>.
            Increasing the stop-loss above{' '}
            <span className="font-semibold">{fmtNumber(result.balanced.stopLoss, 2)}</span>{' '}
            improved historical recovery by only{' '}
            <span className="font-semibold text-warning">{fmtPercent(result.marginalBeyondBalanced, 1)}</span>{' '}
            while increasing historical risk.
          </p>
          <p className="mt-3 text-[11px] text-ink-faint">
            Descriptive statistics only — not a recommendation to use any stop-loss.
          </p>
        </section>
      )}

      <SlOptimizerValidation meta={result.meta} />

      <SlOptimizerTable result={result} />
      <SlOptimizerCharts result={result} />
    </div>
  );
}
