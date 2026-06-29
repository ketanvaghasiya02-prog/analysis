/**
 * Strategy Ranking (Phase 11D) — deterministic ranking of stored research.
 *
 * Reads ONLY the Research Repository, filters, then scores and ranks with a
 * deterministic 0–100 statistical score. It never reruns the Research Engine
 * and makes no recommendation.
 *
 * Ranking is based only on uploaded historical CSV results. This is not a
 * trading signal. Higher rank means stronger historical statistics, not
 * guaranteed future performance.
 */

import { Fragment, useMemo, useState } from 'react';
import { useData } from '@/context/DataContext';
import { useRepository } from '@/context/RepositoryContext';
import { useStrategyFocus } from '@/context/StrategyFocusContext';
import { useComparison } from '@/context/ComparisonContext';
import {
  DEFAULT_RANKING_FILTERS,
  rankStrategies,
  rankingCsv,
  rankingJson,
  RANKING_MODES,
  type RankedStrategy,
  type RankingFilters,
  type RankingMode,
} from '@/utils/strategyRanking';
import { CONFIDENCE_LABELS, type ConfidenceLevel } from '@/utils/scenario';
import type { RepositoryRecord } from '@/utils/researchRepository';
import { downloadExport } from '@/utils/reports';
import { RankingCharts } from '@/components/ranking/RankingCharts';
import { StatCard } from '@/components/overview/StatCard';
import { fmtDuration, fmtInt, fmtNumber, fmtPercent } from '@/utils/format';
import { AlertIcon, DownloadIcon, LayersIcon, TableIcon } from '@/components/common/icons';

const CONFIDENCE_LEVELS: ConfidenceLevel[] = ['VERY_LOW', 'LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH'];

function scoreTone(s: number): string {
  if (s >= 70) return 'text-positive';
  if (s >= 45) return 'text-warning';
  return 'text-negative';
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

function ScoreBar({ label, value }: { label: string; value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div>
      <div className="mb-0.5 flex justify-between text-[11px]">
        <span className="text-ink-faint">{label}</span>
        <span className={['font-mono', scoreTone(value)].join(' ')}>{fmtNumber(value, 1)}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-panel-border">
        <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function HighlightCard({
  label,
  record,
  metric,
  tooltip,
}: {
  label: string;
  record: RepositoryRecord | null;
  metric: (r: RepositoryRecord) => string;
  tooltip: string;
}) {
  return (
    <StatCard
      label={label}
      tone="accent"
      tooltip={tooltip}
      value={record ? <span className="text-base">{`${fmtNumber(record.entryGap, 2)} / ${fmtNumber(record.recoveryGap, 2)} / ${fmtNumber(record.stopLoss, 2)}`}</span> : '—'}
      hint={record ? metric(record) : undefined}
    />
  );
}

export function StrategyRankingView() {
  const { records } = useRepository();
  const { setView } = useData();
  const { setFocus } = useStrategyFocus();
  const [filters, setFilters] = useState<RankingFilters>(DEFAULT_RANKING_FILTERS);
  const [mode, setMode] = useState<RankingMode>('BALANCED');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const patch = (p: Partial<RankingFilters>) => setFilters((prev) => ({ ...prev, ...p }));

  // Memoized ranking — only reruns when repository, filters or mode change.
  const result = useMemo(() => rankStrategies(records, filters, mode), [records, filters, mode]);

  const modeLabel = RANKING_MODES.find((m) => m.mode === mode)?.label ?? null;
  const openDossier = (s: RankedStrategy) => {
    setFocus({ key: s.record.key, rank: s.rank, overall: s.scores.overall, modeLabel });
    setView('strategy-details');
  };

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const stamp = () => new Date().toISOString();

  return (
    <div className="space-y-5">
      {/* Disclaimer */}
      <section className="card flex items-start gap-3 border-accent/30 bg-accent/5 p-4">
        <AlertIcon className="mt-0.5 text-base text-accent" />
        <div className="space-y-1 text-sm leading-relaxed text-ink-muted">
          <p className="font-semibold text-ink">Historical statistical ranking</p>
          <p>Ranking is based only on uploaded historical CSV results. This is not a trading signal.</p>
          <p>Higher rank means stronger historical statistics, not guaranteed future performance.</p>
        </div>
      </section>

      {records.length === 0 ? (
        <section className="card flex flex-col items-center gap-3 p-10 text-center">
          <LayersIcon className="text-3xl text-ink-faint" />
          <h2 className="text-base font-semibold text-ink">No completed strategy research found</h2>
          <p className="max-w-md text-sm text-ink-muted">
            Run Historical Strategy Finder execution first. Completed strategies
            are stored in the Research Repository and ranked here.
          </p>
        </section>
      ) : (
        <>
          {/* Controls */}
          <section className="card p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <span className="stat-label">Ranking Filters &amp; Mode</span>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-xs">
                  <span className="stat-label">Mode</span>
                  <select
                    value={mode}
                    onChange={(e) => setMode(e.target.value as RankingMode)}
                    className="rounded-md border border-panel-border bg-panel px-2 py-1 text-ink focus:border-accent focus:outline-none"
                  >
                    {RANKING_MODES.map((m) => (
                      <option key={m.mode} value={m.mode}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="button" onClick={() => setFilters(DEFAULT_RANKING_FILTERS)} className="btn px-2 py-1 text-xs">
                  Reset
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
              <NumField label="Min Recovery Before SL %" value={filters.minRecoveryBefore} step={1} onChange={(v) => patch({ minRecoveryBefore: v ?? 0 })} />
              <NumField label="Min Recovery Ignoring SL %" value={filters.minRecoveryIgnoring} step={1} onChange={(v) => patch({ minRecoveryIgnoring: v ?? 0 })} />
              <NumField label="Max SL Hit %" value={filters.maxSlHit} step={1} onChange={(v) => patch({ maxSlHit: v ?? 100 })} />
              <NumField label="Min Historical Trades" value={filters.minTrades} step={1} onChange={(v) => patch({ minTrades: v ?? 0 })} />
              <NumField label="Max Avg Recovery (min)" value={filters.maxAvgRecoveryMin} step={1} placeholder="no cap" onChange={(v) => patch({ maxAvgRecoveryMin: v })} />
              <NumField label="Max Worst Gap" value={filters.maxWorstGap} step={0.1} placeholder="no cap" onChange={(v) => patch({ maxWorstGap: v })} />
              <label className="flex flex-col gap-1">
                <span className="stat-label">Min Research Confidence</span>
                <select
                  value={filters.minConfidence}
                  onChange={(e) => patch({ minConfidence: e.target.value as ConfidenceLevel })}
                  className="w-full rounded-md border border-panel-border bg-panel px-3 py-1.5 text-sm text-ink focus:border-accent focus:outline-none"
                >
                  {CONFIDENCE_LEVELS.map((c) => (
                    <option key={c} value={c}>
                      {CONFIDENCE_LABELS[c]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          {/* Counts */}
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Repository Records" value={fmtInt(result.repositoryCount)} />
            <StatCard label="Filtered Out" tone="warning" value={fmtInt(result.filteredOut)} />
            <StatCard label="Eligible Strategies" tone="accent" value={fmtInt(result.eligibleCount)} />
            <StatCard label="Ranked Strategies" tone="positive" value={fmtInt(result.rankedCount)} />
          </section>

          {result.invalidCount > 0 && (
            <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm text-warning">
              <AlertIcon className="mt-0.5 text-base" />
              <span>
                {fmtInt(result.invalidCount)} strateg{result.invalidCount === 1 ? 'y' : 'ies'} produced a
                non-finite score and {result.invalidCount === 1 ? 'was' : 'were'} excluded from the ranking.
              </span>
            </div>
          )}

          {result.eligibleCount === 0 ? (
            <section className="card flex flex-col items-center gap-2 p-10 text-center">
              <AlertIcon className="text-2xl text-warning" />
              <h2 className="text-base font-semibold text-ink">No strategies match current filters</h2>
              <p className="max-w-md text-sm text-ink-muted">Loosen the filters above to include more stored strategies.</p>
            </section>
          ) : (
            <>
              {/* Summary cards */}
              <section>
                <h2 className="stat-label mb-2">Ranking Summary</h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                  <StatCard label="Eligible Strategies" tone="accent" value={fmtInt(result.eligibleCount)} />
                  <HighlightCard
                    label="Historically Top Ranked"
                    record={result.highlights.top?.record ?? null}
                    tooltip="Highest overall historical score under the selected ranking mode."
                    metric={(r) => `score ${fmtNumber(result.highlights.top?.scores.overall ?? 0, 1)} · rec ${fmtPercent(r.recoveryBeforeSlPct)}`}
                  />
                  <HighlightCard
                    label="Historically Highest Recovery"
                    record={result.highlights.highestRecovery}
                    tooltip="Highest historical recovery-before-SL among eligible strategies."
                    metric={(r) => `rec ${fmtPercent(r.recoveryBeforeSlPct)}`}
                  />
                  <HighlightCard
                    label="Historically Lowest Risk"
                    record={result.highlights.lowestRisk}
                    tooltip="Lowest historical SL hit rate (then lowest worst gap)."
                    metric={(r) => `SL hit ${fmtPercent(r.slHitPct)}`}
                  />
                  <HighlightCard
                    label="Historically Fastest Recovery"
                    record={result.highlights.fastest}
                    tooltip="Lowest average historical recovery time."
                    metric={(r) => `avg ${fmtDuration(r.avgRecoverySec)}`}
                  />
                  <HighlightCard
                    label="Historically Most Frequent"
                    record={result.highlights.mostTrades}
                    tooltip="Most historical trades among eligible strategies."
                    metric={(r) => `${fmtInt(r.historicalTrades)} trades`}
                  />
                  <StatCard
                    label="Average Score"
                    value={result.averageScore !== null ? fmtNumber(result.averageScore, 1) : '—'}
                    tooltip="Mean overall score across ranked strategies."
                  />
                </div>
              </section>

              {/* Export */}
              <section className="flex flex-wrap gap-2">
                <button type="button" onClick={() => downloadExport(rankingCsv(result))} className="btn flex items-center gap-1.5 px-3 py-1.5 text-sm">
                  <DownloadIcon className="text-sm" /> Export CSV
                </button>
                <button type="button" onClick={() => downloadExport(rankingJson(result, stamp()))} className="btn flex items-center gap-1.5 px-3 py-1.5 text-sm">
                  <DownloadIcon className="text-sm" /> Export JSON
                </button>
              </section>

              {/* Charts */}
              <RankingCharts result={result} />

              {/* Ranking table */}
              <RankingTable ranked={result.ranked} expanded={expanded} onToggle={toggle} onOpen={openDossier} />
            </>
          )}
        </>
      )}
    </div>
  );
}

function RankingTable({
  ranked,
  expanded,
  onToggle,
  onOpen,
}: {
  ranked: RankedStrategy[];
  expanded: Set<string>;
  onToggle: (key: string) => void;
  onOpen: (s: RankedStrategy) => void;
}) {
  const comparison = useComparison();
  return (
    <section className="card overflow-hidden">
      <header className="flex items-center gap-2 border-b border-panel-border px-5 py-3">
        <TableIcon className="text-base text-accent" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink">Ranked Strategies</h2>
        <span className="ml-auto text-xs text-ink-faint">{fmtInt(ranked.length)} ranked · Details for the dossier · Compare to add to comparison</span>
      </header>
      <div className="max-h-[40rem] overflow-auto">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 z-10 bg-panel text-xs uppercase tracking-wide text-ink-faint">
            <tr>
              <th className="px-3 py-2 font-medium">Rank</th>
              <th className="px-3 py-2 font-medium">ID</th>
              <th className="px-3 py-2 text-right font-medium">Entry</th>
              <th className="px-3 py-2 text-right font-medium">Recovery</th>
              <th className="px-3 py-2 text-right font-medium">Stop Loss</th>
              <th className="px-3 py-2 text-right font-medium">Rec. Before %</th>
              <th className="px-3 py-2 text-right font-medium">Rec. Ignoring %</th>
              <th className="px-3 py-2 text-right font-medium">SL Hit %</th>
              <th className="px-3 py-2 text-right font-medium">Trades</th>
              <th className="px-3 py-2 text-right font-medium">Avg Recovery</th>
              <th className="px-3 py-2 text-right font-medium">Worst Gap</th>
              <th className="px-3 py-2 font-medium">Confidence</th>
              <th className="px-3 py-2 text-right font-medium">Overall</th>
              <th className="px-3 py-2 text-right font-medium">Dossier</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-panel-border font-mono text-xs">
            {ranked.map((s) => {
              const r = s.record;
              const open = expanded.has(r.key);
              return (
                <Fragment key={r.key}>
                  <tr
                    onClick={() => onToggle(r.key)}
                    className={['cursor-pointer hover:bg-panel/50', open ? 'bg-panel/40' : ''].join(' ')}
                  >
                    <td className="px-3 py-1.5 text-ink">
                      <span className="inline-flex items-center gap-1">
                        <span className="text-ink-faint">{open ? '▾' : '▸'}</span>#{s.rank}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-ink-muted">{r.id}</td>
                    <td className="px-3 py-1.5 text-right text-ink">{fmtNumber(r.entryGap, 2)}</td>
                    <td className="px-3 py-1.5 text-right text-ink-muted">{fmtNumber(r.recoveryGap, 2)}</td>
                    <td className="px-3 py-1.5 text-right text-ink-muted">{fmtNumber(r.stopLoss, 2)}</td>
                    <td className="px-3 py-1.5 text-right text-positive">{fmtPercent(r.recoveryBeforeSlPct)}</td>
                    <td className="px-3 py-1.5 text-right text-accent">{fmtPercent(r.recoveryIgnoringSlPct)}</td>
                    <td className="px-3 py-1.5 text-right text-negative">{fmtPercent(r.slHitPct)}</td>
                    <td className="px-3 py-1.5 text-right text-ink-muted">{fmtInt(r.historicalTrades)}</td>
                    <td className="px-3 py-1.5 text-right text-ink-muted">{fmtDuration(r.avgRecoverySec)}</td>
                    <td className="px-3 py-1.5 text-right text-negative">{fmtNumber(r.worstMaxGap, 3)}</td>
                    <td className="px-3 py-1.5 font-sans text-ink-muted">{r.confidenceLabel}</td>
                    <td className={['px-3 py-1.5 text-right font-semibold', scoreTone(s.scores.overall)].join(' ')}>
                      {fmtNumber(s.scores.overall, 1)}
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            comparison.toggle(r.key);
                          }}
                          disabled={!comparison.isSelected(r.key) && comparison.full}
                          className={['btn px-2 py-0.5 text-[11px]', comparison.isSelected(r.key) ? 'btn-active' : ''].join(' ')}
                          title="Add or remove from Strategy Comparison"
                        >
                          {comparison.isSelected(r.key) ? '✓' : '⇄'}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpen(s);
                          }}
                          className="btn px-2 py-0.5 text-[11px]"
                        >
                          Details →
                        </button>
                      </div>
                    </td>
                  </tr>
                  {open && (
                    <tr className="bg-panel/20">
                      <td colSpan={14} className="px-5 py-3">
                        <div className="mb-2 stat-label">Score Breakdown</div>
                        <div className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2 xl:grid-cols-3">
                          <ScoreBar label="Recovery Score" value={s.scores.recovery} />
                          <ScoreBar label="SL Safety Score" value={s.scores.slSafety} />
                          <ScoreBar label="Confidence Score" value={s.scores.confidence} />
                          <ScoreBar label="Trade Count Score" value={s.scores.tradeCount} />
                          <ScoreBar label="Recovery Time Score" value={s.scores.recoveryTime} />
                          <ScoreBar label="Worst Gap Risk Score" value={s.scores.worstGapRisk} />
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <footer className="border-t border-panel-border px-5 py-2 text-[11px] text-ink-faint">
        Deterministic 0–100 score from normalized historical components. Ranking
        reflects historical statistics only — not a recommendation or signal.
      </footer>
    </section>
  );
}
