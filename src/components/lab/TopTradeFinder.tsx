/**
 * Top Trade Finder section (additive), embedded in the Research Lab.
 *
 * Finds and ranks historical compression opportunities in the active Research
 * Lab dataset (respecting the date-time range). HISTORICAL OPPORTUNITIES ONLY —
 * not a trading signal, no buy/sell orders are generated.
 */

import { useMemo, useState } from 'react';
import type { GapSample } from '@/types/gap';
import {
  DEFAULT_TOP_TRADE_INPUT,
  findTopTrades,
  topTradesCsv,
  type TopTradeInput,
  type TopTradeOpportunity,
} from '@/utils/topTrades';
import { downloadExport } from '@/utils/reports';
import { TopTradeTable } from '@/components/lab/TopTradeTable';
import { TopTradeCharts } from '@/components/lab/TopTradeCharts';
import { TopTradePathChart } from '@/components/lab/TopTradePathChart';
import { ChipMultiSelect } from '@/components/filters/ChipMultiSelect';
import { fmtDuration, fmtInt, fmtNumber } from '@/utils/format';
import { AlertIcon } from '@/components/common/icons';

interface TopTradeFinderProps {
  samples: GapSample[];
  recoveryTargetTo: number | null;
  slLevel: number | null;
  sessionOptions: string[];
}

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
        onChange={(e) =>
          onChange(e.target.value === '' ? null : Number(e.target.value))
        }
        className="w-full rounded-md border border-panel-border bg-panel px-3 py-1.5 text-sm text-ink focus:border-accent focus:outline-none"
      />
    </label>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <div className="stat-label">{label}</div>
      <div className="stat-value mt-1 text-base">{value}</div>
    </div>
  );
}

export function TopTradeFinder({
  samples,
  recoveryTargetTo,
  slLevel,
  sessionOptions,
}: TopTradeFinderProps) {
  const [input, setInput] = useState<TopTradeInput>(DEFAULT_TOP_TRADE_INPUT);
  const [selected, setSelected] = useState<TopTradeOpportunity | null>(null);

  const patch = (p: Partial<TopTradeInput>) =>
    setInput((prev) => ({ ...prev, ...p }));

  const result = useMemo(
    () => findTopTrades(samples, input, recoveryTargetTo),
    [samples, input, recoveryTargetTo],
  );

  const activeSelected = useMemo(
    () =>
      selected ? result.trades.find((t) => t.id === selected.id) ?? null : null,
    [selected, result.trades],
  );

  const shortfall =
    result.totalValid < input.count
      ? `Only ${fmtInt(result.totalValid)} valid opportunit${
          result.totalValid === 1 ? 'y' : 'ies'
        } found in the selected range.`
      : null;

  const sel = activeSelected;

  return (
    <section className="space-y-5">
      <header className="card border-accent/30 bg-accent/5 p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-ink">
          <AlertIcon className="text-base text-accent" />
          Top Trade Finder
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-ink-muted">
          Historical opportunities only. Not a trading signal. No buy/sell orders
          are generated — this ranks past gap-compression episodes for research.
        </p>
      </header>

      {/* Inputs */}
      <div className="card p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="stat-label">Finder Inputs</span>
          <button
            type="button"
            onClick={() => {
              setInput(DEFAULT_TOP_TRADE_INPUT);
              setSelected(null);
            }}
            className="btn px-2 py-1"
          >
            Reset
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
          <NumField label="Number of Trades" value={input.count} step={1} onChange={(v) => patch({ count: Math.max(1, Math.round(v ?? 1)) })} />
          <NumField label="Min Entry Gap" value={input.minEntryGap} step={0.1} onChange={(v) => patch({ minEntryGap: v ?? 0 })} />
          <NumField label="Max Entry Gap" value={input.maxEntryGap} step={0.1} placeholder="none" onChange={(v) => patch({ maxEntryGap: v })} />
          <NumField label="Min Compression Target" value={input.minCompressionTarget} step={0.1} placeholder="none" onChange={(v) => patch({ minCompressionTarget: v })} />
          <NumField label="Min Profit (gap pts)" value={input.minProfitGapPoints} step={0.1} onChange={(v) => patch({ minProfitGapPoints: v ?? 0 })} />
          <NumField label="Max Allowed Adverse Gap" value={input.maxAdverseGap} step={0.1} placeholder="none" onChange={(v) => patch({ maxAdverseGap: v })} />
          <NumField label="Min Recovery Prob %" value={input.minRecoveryProbability} step={5} onChange={(v) => patch({ minRecoveryProbability: v ?? 0 })} />
          <NumField label="Max Holding (min)" value={input.maxHoldingMinutes} step={1} placeholder="none" onChange={(v) => patch({ maxHoldingMinutes: v })} />
          <NumField label="Min Events per Setup" value={input.minEventsPerSetup} step={1} onChange={(v) => patch({ minEventsPerSetup: Math.max(1, Math.round(v ?? 1)) })} />
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
        <div className="mt-4">
          <ChipMultiSelect
            label="Session Filter"
            options={sessionOptions}
            selected={input.sessions}
            onChange={(sessions) => patch({ sessions })}
          />
        </div>
      </div>

      {shortfall && (
        <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm text-warning">
          <AlertIcon className="mt-0.5 text-base" />
          <span>{shortfall}</span>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <SummaryCard
          label="Showing / Requested"
          value={`${fmtInt(result.trades.length)} / ${fmtInt(result.requested)}`}
        />
        <SummaryCard label="Avg Compression" value={fmtNumber(result.avgCompression, 3)} />
        <SummaryCard label="Avg Holding" value={fmtDuration(result.avgHoldingSec)} />
        <SummaryCard label="Worst Adverse Exp." value={fmtNumber(result.worstAdverseExpansion, 3)} />
        <SummaryCard
          label="Best Trade"
          value={result.best ? `#${result.best.rank} · ${fmtNumber(result.best.compression, 2)}` : '—'}
        />
        <SummaryCard
          label="Lowest Risk Trade"
          value={
            result.lowestRisk
              ? `#${result.lowestRisk.rank} · ${fmtNumber(result.lowestRisk.adverseExpansion, 2)}`
              : '—'
          }
        />
      </div>

      {/* Export */}
      <div>
        <button
          type="button"
          onClick={() => downloadExport(topTradesCsv(result))}
          className="btn px-3 py-1.5"
          disabled={result.trades.length === 0}
        >
          Export top trades (CSV)
        </button>
      </div>

      {/* Replay + score breakdown */}
      {sel && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <TopTradePathChart samples={samples} trade={sel} slLevel={slLevel} />
          </div>
          <div className="card p-5">
            <h3 className="stat-label mb-3">Score Breakdown — {sel.id}</h3>
            <div className="space-y-1.5 font-mono text-sm">
              {[
                ['Compression score', sel.breakdown.compression, 'text-positive'],
                ['Recovery bonus', sel.breakdown.recoveryBonus, 'text-positive'],
                ['Adverse risk score', -sel.breakdown.adversePenalty, 'text-negative'],
                ['Time score', -sel.breakdown.timePenalty, 'text-warning'],
                ['Sync quality score', -sel.breakdown.syncPenalty, 'text-warning'],
              ].map(([label, val, tone]) => (
                <div key={label as string} className="flex items-center justify-between">
                  <span className="font-sans text-ink-muted">{label}</span>
                  <span className={tone as string}>{fmtNumber(val as number, 2)}</span>
                </div>
              ))}
              <div className="mt-2 flex items-center justify-between border-t border-panel-border pt-2">
                <span className="font-sans font-semibold text-ink">Final score</span>
                <span className="font-semibold text-accent">{fmtNumber(sel.breakdown.final, 2)}</span>
              </div>
            </div>
            <p className="mt-3 text-[11px] text-ink-faint">
              Setup compression rate: {fmtNumber(sel.setupRecoveryPct, 1)}% ·
              reached recovery target: {sel.reachedRecoveryTarget ? 'yes' : 'no'}
            </p>
          </div>
        </div>
      )}

      <TopTradeCharts trades={result.trades} />

      <TopTradeTable
        trades={result.trades}
        selectedId={sel?.id ?? null}
        onSelect={setSelected}
      />
    </section>
  );
}
