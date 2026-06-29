/**
 * Research Lab page (additive).
 *
 * Interactive scenario testing: the user defines an entry gap zone, a recovery
 * target zone and a stop-loss gap; the engine reports what happened historically
 * across the filtered dataset. Research only — gap points, no money, no signals.
 */

import { useMemo, useState } from 'react';
import { useData } from '@/context/DataContext';
import {
  computeScenario,
  computeSensitivity,
  DEFAULT_SCENARIO_INPUT,
  scenarioEventListCsv,
  scenarioSummaryJson,
  sensitivityCsv,
  type ScenarioEvent,
  type ScenarioInput,
} from '@/utils/scenario';
import { downloadExport } from '@/utils/reports';
import { ScenarioCards } from '@/components/lab/ScenarioCards';
import { OutcomeBreakdownTable } from '@/components/lab/OutcomeBreakdownTable';
import { SensitivityTable } from '@/components/lab/SensitivityTable';
import { ScenarioEventTable } from '@/components/lab/ScenarioEventTable';
import { ScenarioCharts } from '@/components/lab/ScenarioCharts';
import { ScenarioPathChart } from '@/components/lab/ScenarioPathChart';
import { ScenarioHelpPanel } from '@/components/lab/ScenarioHelpPanel';
import { TopTradeFinder } from '@/components/lab/TopTradeFinder';
import { ChipMultiSelect } from '@/components/filters/ChipMultiSelect';
import { AlertIcon } from '@/components/common/icons';
import {
  describeDtRange,
  isDtRangeActive,
  scopeByDateTime,
  EMPTY_DT_RANGE,
  type DateTimeRange,
} from '@/utils/dateRange';
import { fmtInt } from '@/utils/format';

const MIN_RANGE_SAMPLES = 100;

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

export function ResearchLabView() {
  const { filteredSamples, filterOptions } = useData();
  const [input, setInput] = useState<ScenarioInput>(DEFAULT_SCENARIO_INPUT);
  const [selected, setSelected] = useState<ScenarioEvent | null>(null);
  const [dtRange, setDtRange] = useState<DateTimeRange>(EMPTY_DT_RANGE);

  const patch = (p: Partial<ScenarioInput>) =>
    setInput((prev) => ({ ...prev, ...p }));
  const patchRange = (p: Partial<DateTimeRange>) =>
    setDtRange((prev) => ({ ...prev, ...p }));

  // Active Research Lab dataset: global filters → date-time range scope.
  const labSamples = useMemo(
    () => scopeByDateTime(filteredSamples, dtRange),
    [filteredSamples, dtRange],
  );

  const daysCovered = useMemo(
    () => new Set(labSamples.map((s) => s.dayKey)).size,
    [labSamples],
  );

  // Heavy work memoized — recomputes only when the dataset or inputs change.
  const result = useMemo(
    () => computeScenario(labSamples, input),
    [labSamples, input],
  );
  const sensitivity = useMemo(
    () => computeSensitivity(result.events, input),
    [result.events, input],
  );

  const activeSelected = useMemo(
    () =>
      selected ? result.events.find((e) => e.id === selected.id) ?? null : null,
    [selected, result.events],
  );

  // Validation warnings.
  const warnings: string[] = [];
  if (result.validEvents < input.minEvents) {
    warnings.push(
      `Only ${result.validEvents} valid events — below the minimum of ${input.minEvents}. Results are low-confidence.`,
    );
  }
  if (input.stopLoss <= input.entryGap) {
    warnings.push(
      'Stop-Loss Gap is at or below the Entry Gap. A stop should sit above the entry level.',
    );
  }
  if (input.recoveryGap >= input.entryGap) {
    warnings.push(
      'Recovery Gap is at or above the Entry Gap. The recovery target should sit below the entry level.',
    );
  }

  const sessionOptions = filterOptions?.sessions ?? [];
  const syncOptions = filterOptions?.syncStatuses ?? [];

  // Date-time range warnings.
  const rangeWarnings: string[] = [];
  if (isDtRangeActive(dtRange) && labSamples.length === 0) {
    rangeWarnings.push('No data found in the selected date-time range.');
  } else if (labSamples.length > 0 && labSamples.length < MIN_RANGE_SAMPLES) {
    rangeWarnings.push(
      `Only ${labSamples.length} samples in the selected range (below ${MIN_RANGE_SAMPLES}). Results may be unstable.`,
    );
  }

  const stamp = () => new Date().toISOString();

  return (
    <div className="space-y-5">
      {/* Explanation */}
      <section className="card flex items-start gap-3 border-accent/30 bg-accent/5 p-4">
        <AlertIcon className="mt-0.5 text-base text-accent" />
        <p className="text-sm leading-relaxed text-ink">
          This is not a trading signal. It only shows what happened historically
          for this scenario, measured in gap points across the currently filtered
          data. No orders, no money, no buy/sell recommendation.
        </p>
      </section>

      <ScenarioHelpPanel />

      {/* Date-time range */}
      <section className="card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <span className="stat-label">Date-Time Range</span>
          <div className="flex items-center gap-3 text-xs text-ink-muted">
            <span>
              Range:{' '}
              <span className="font-medium text-ink">
                {describeDtRange(dtRange)}
              </span>
            </span>
            {isDtRangeActive(dtRange) && (
              <button
                type="button"
                onClick={() => setDtRange(EMPTY_DT_RANGE)}
                className="text-ink-faint transition-colors hover:text-accent"
              >
                clear
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <label className="flex flex-col gap-1">
            <span className="stat-label">Start Date</span>
            <input
              type="date"
              value={dtRange.startDate ?? ''}
              onChange={(e) => patchRange({ startDate: e.target.value || null })}
              className="w-full rounded-md border border-panel-border bg-panel px-3 py-1.5 text-sm text-ink focus:border-accent focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="stat-label">Start Time</span>
            <input
              type="time"
              value={dtRange.startTime ?? ''}
              onChange={(e) => patchRange({ startTime: e.target.value || null })}
              className="w-full rounded-md border border-panel-border bg-panel px-3 py-1.5 text-sm text-ink focus:border-accent focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="stat-label">End Date</span>
            <input
              type="date"
              value={dtRange.endDate ?? ''}
              onChange={(e) => patchRange({ endDate: e.target.value || null })}
              className="w-full rounded-md border border-panel-border bg-panel px-3 py-1.5 text-sm text-ink focus:border-accent focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="stat-label">End Time</span>
            <input
              type="time"
              value={dtRange.endTime ?? ''}
              onChange={(e) => patchRange({ endTime: e.target.value || null })}
              className="w-full rounded-md border border-panel-border bg-panel px-3 py-1.5 text-sm text-ink focus:border-accent focus:outline-none"
            />
          </label>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-3">
          <div className="rounded-md border border-panel-border bg-panel p-3">
            <div className="stat-label">Samples in Range</div>
            <div className="mt-1 font-mono text-lg text-ink">
              {fmtInt(labSamples.length)}
            </div>
          </div>
          <div className="rounded-md border border-panel-border bg-panel p-3">
            <div className="stat-label">Days Covered</div>
            <div className="mt-1 font-mono text-lg text-ink">
              {fmtInt(daysCovered)}
            </div>
          </div>
          <div className="rounded-md border border-panel-border bg-panel p-3">
            <div className="stat-label">Events in Range</div>
            <div className="mt-1 font-mono text-lg text-ink">
              {fmtInt(result.totalEvents)}
            </div>
          </div>
        </div>

        {rangeWarnings.length > 0 && (
          <div className="mt-3 space-y-2">
            {rangeWarnings.map((w, i) => (
              <div
                key={i}
                className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning"
              >
                <AlertIcon className="mt-0.5 text-sm" />
                <span>{w}</span>
              </div>
            ))}
          </div>
        )}

        <p className="mt-3 text-[11px] text-ink-faint">
          This range is separate from the global dashboard filter, but applies on
          top of it. Leave the dates empty to use all uploaded data.
        </p>
      </section>

      {/* Inputs */}
      <section className="card p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="stat-label">Scenario Inputs</span>
          <button
            type="button"
            onClick={() => {
              setInput(DEFAULT_SCENARIO_INPUT);
              setSelected(null);
            }}
            className="btn px-2 py-1"
          >
            Reset
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
          <NumField label="Entry Gap" value={input.entryGap} step={0.1} onChange={(entryGap) => patch({ entryGap })} />
          <NumField label="Recovery Gap" value={input.recoveryGap} step={0.1} onChange={(recoveryGap) => patch({ recoveryGap })} />
          <NumField label="Stop Loss Gap" value={input.stopLoss} step={0.1} onChange={(stopLoss) => patch({ stopLoss })} />
          <label className="flex flex-col gap-1">
            <span className="stat-label">Max Holding (min)</span>
            <input
              type="number"
              step={1}
              min={0}
              placeholder="optional"
              value={input.maxHoldingMinutes ?? ''}
              onChange={(e) =>
                patch({
                  maxHoldingMinutes:
                    e.target.value === '' ? null : Number(e.target.value),
                })
              }
              className="w-full rounded-md border border-panel-border bg-panel px-3 py-1.5 text-sm text-ink focus:border-accent focus:outline-none"
            />
          </label>
          <NumField label="Minimum Events" value={input.minEvents} step={1} onChange={(minEvents) => patch({ minEvents })} />
          <label className="flex flex-col gap-1">
            <span className="stat-label">Same Day Only</span>
            <button
              type="button"
              onClick={() => patch({ sameDayOnly: !input.sameDayOnly })}
              className={[
                'btn px-3 py-1.5',
                input.sameDayOnly ? 'btn-active' : '',
              ].join(' ')}
            >
              {input.sameDayOnly ? 'On' : 'Off'}
            </button>
          </label>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ChipMultiSelect
            label="Session Filter"
            options={sessionOptions}
            selected={input.sessions}
            onChange={(sessions) => patch({ sessions })}
          />
          <ChipMultiSelect
            label="Sync Status Filter"
            options={syncOptions}
            selected={input.syncStatuses}
            onChange={(syncStatuses) => patch({ syncStatuses })}
          />
        </div>
      </section>

      {/* Warnings */}
      {warnings.length > 0 && (
        <section className="space-y-2">
          {warnings.map((w, i) => (
            <div
              key={i}
              className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm text-warning"
            >
              <AlertIcon className="mt-0.5 text-base" />
              <span>{w}</span>
            </div>
          ))}
        </section>
      )}

      {/* Export */}
      <section className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => downloadExport(scenarioEventListCsv(result))}
          className="btn px-3 py-1.5"
        >
          Export event list (CSV)
        </button>
        <button
          type="button"
          onClick={() => downloadExport(scenarioSummaryJson(result, stamp()))}
          className="btn px-3 py-1.5"
        >
          Export scenario summary (JSON)
        </button>
        <button
          type="button"
          onClick={() => downloadExport(sensitivityCsv(sensitivity))}
          className="btn px-3 py-1.5"
        >
          Export SL sensitivity (CSV)
        </button>
      </section>

      <ScenarioCards result={result} />

      {/* Accounting validation */}
      {!result.accountingOk && (
        <div className="flex items-start gap-3 rounded-lg border border-negative/40 bg-negative/10 p-3 text-sm text-negative">
          <AlertIcon className="mt-0.5 text-base" />
          <span>
            Outcome accounting mismatch — outcomes sum to{' '}
            {fmtInt(result.outcomeTotal)} but there are {fmtInt(result.validEvents)}{' '}
            events.
          </span>
        </div>
      )}

      {activeSelected && (
        <ScenarioPathChart
          samples={labSamples}
          event={activeSelected}
          input={input}
        />
      )}

      <ScenarioCharts result={result} sensitivity={sensitivity} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <OutcomeBreakdownTable result={result} />
        <SensitivityTable rows={sensitivity} currentSl={input.stopLoss} />
      </div>

      {/* Outcome explanation + accounting debug */}
      <section className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="card p-4 text-xs leading-relaxed text-ink-muted lg:col-span-2">
          <p>
            <span className="font-semibold text-positive">Recovery Before SL</span>{' '}
            means the target was reached before stop-loss.
          </p>
          <p className="mt-1.5">
            <span className="font-semibold text-warning">Recovery After SL</span>{' '}
            means the idea eventually worked, but the selected SL was too tight.
          </p>
          <p className="mt-1.5">
            <span className="font-semibold text-ink">Unresolved</span> means the
            event did not reach recovery or SL before the selected scan limit.
          </p>
        </div>
        <div className="card p-4">
          <div className="stat-label mb-2">Debug · Accounting</div>
          <div className="space-y-1 font-mono text-xs">
            <div className="flex items-center justify-between">
              <span className="font-sans text-ink-muted">Outcome total</span>
              <span className="text-ink">{fmtInt(result.outcomeTotal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-sans text-ink-muted">Total events</span>
              <span className="text-ink">{fmtInt(result.validEvents)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-sans text-ink-muted">Status</span>
              <span
                className={result.accountingOk ? 'text-positive' : 'text-negative'}
              >
                {result.accountingOk ? 'OK' : 'ERROR'}
              </span>
            </div>
          </div>
        </div>
      </section>

      <ScenarioEventTable
        events={result.events}
        selectedId={activeSelected?.id ?? null}
        onSelect={setSelected}
      />

      {/* Top Trade Finder — uses the same active Research Lab dataset. */}
      <TopTradeFinder
        samples={labSamples}
        recoveryTargetTo={input.recoveryGap}
        slLevel={input.stopLoss}
        sessionOptions={sessionOptions}
      />
    </div>
  );
}
