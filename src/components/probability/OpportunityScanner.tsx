/**
 * Historical Opportunity Scanner (Phase 12B).
 *
 * Reads the already-computed Probability Matrix and surfaces the statistically
 * strongest historical opportunities. Presentation only — no probability is
 * recomputed, and nothing here is a trading signal or recommendation.
 */

import { useMemo, useState } from 'react';
import type { ProbabilityResult } from '@/utils/probability';
import {
  DEFAULT_OPPORTUNITY_FILTERS,
  opportunityCsv,
  opportunityJson,
  probabilityBand,
  scanOpportunities,
  type MinConfidence,
  type OpportunityFilters,
  type OpportunityRow,
} from '@/utils/opportunity';
import { downloadExport } from '@/utils/reports';
import { StatCard } from '@/components/overview/StatCard';
import { fmtDuration, fmtInt, fmtNumber, fmtPercent } from '@/utils/format';
import { AlertIcon, BulbIcon, DownloadIcon, TableIcon } from '@/components/common/icons';

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

type SortKey = 'rank' | 'targetGap' | 'probabilityPct' | 'avgTimeSec' | 'totalEvents' | 'worstMaxGap' | 'p95MaxGap' | 'score';

function sortValue(o: OpportunityRow, key: SortKey): number {
  switch (key) {
    case 'rank':
      return o.rank;
    case 'score':
      return o.score;
    case 'targetGap':
      return o.row.targetGap;
    case 'probabilityPct':
      return o.row.probabilityPct;
    case 'avgTimeSec':
      return o.row.avgTimeSec ?? Infinity;
    case 'totalEvents':
      return o.row.totalEvents;
    case 'worstMaxGap':
      return o.row.worstMaxGap ?? Infinity;
    case 'p95MaxGap':
      return o.row.p95MaxGap ?? Infinity;
  }
}

export function OpportunityScanner({ result, currentGap }: { result: ProbabilityResult; currentGap: number }) {
  const [filters, setFilters] = useState<OpportunityFilters>(DEFAULT_OPPORTUNITY_FILTERS);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('rank');
  const [desc, setDesc] = useState(false);

  const patch = (p: Partial<OpportunityFilters>) => setFilters((prev) => ({ ...prev, ...p }));

  // Reads the existing matrix — no probability recalculation.
  const scan = useMemo(() => scanOpportunities(result, filters), [result, filters]);

  const tableRows = useMemo(() => {
    const q = search.trim();
    let rows = scan.ranked;
    if (q) rows = rows.filter((o) => fmtNumber(o.row.targetGap, 2).includes(q));
    return [...rows].sort((a, b) => {
      const av = sortValue(a, sortKey);
      const bv = sortValue(b, sortKey);
      return desc ? bv - av : av - bv;
    });
  }, [scan.ranked, search, sortKey, desc]);

  const toggleSort = (k: SortKey) => {
    if (k === sortKey) setDesc((d) => !d);
    else {
      setSortKey(k);
      setDesc(k === 'probabilityPct' || k === 'score' || k === 'totalEvents');
    }
  };

  const stamp = () => new Date().toISOString();
  const top10 = scan.ranked.slice(0, 10);
  const { highlights, best } = scan;

  return (
    <div className="space-y-5">
      <section className="card flex items-start gap-3 border-accent/30 bg-accent/5 p-4">
        <BulbIcon className="mt-0.5 text-base text-accent" />
        <div>
          <p className="text-sm font-semibold text-ink">Historical Opportunity Scanner</p>
          <p className="mt-0.5 text-sm leading-relaxed text-ink-muted">
            Automatically surfaces the statistically strongest historical
            compressions from the probability matrix above. These are historical
            observations only — never a trade, signal, entry or target.
          </p>
        </div>
      </section>

      {/* Filters */}
      <section className="card p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="stat-label">Opportunity Filters</span>
          <button type="button" onClick={() => setFilters(DEFAULT_OPPORTUNITY_FILTERS)} className="btn px-2 py-1">Reset</button>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
          <NumField label="Min Historical Probability %" value={filters.minProbability} step={1} onChange={(v) => patch({ minProbability: v ?? 0 })} />
          <NumField label="Min Historical Events" value={filters.minEvents} step={1} onChange={(v) => patch({ minEvents: v != null ? Math.max(0, Math.round(v)) : 0 })} />
          <NumField label="Max Avg Recovery (min)" value={filters.maxAvgRecoveryMin} step={1} placeholder="any" onChange={(v) => patch({ maxAvgRecoveryMin: v })} />
          <NumField label="Max Worst Expansion" value={filters.maxWorstExpansion} step={0.1} placeholder="any" onChange={(v) => patch({ maxWorstExpansion: v })} />
          <NumField label="Max P95 Expansion" value={filters.maxP95Expansion} step={0.1} placeholder="any" onChange={(v) => patch({ maxP95Expansion: v })} />
          <label className="flex flex-col gap-1">
            <span className="stat-label">Research Confidence</span>
            <select
              value={filters.minConfidence}
              onChange={(e) => patch({ minConfidence: e.target.value as MinConfidence })}
              className="w-full rounded-md border border-panel-border bg-panel px-3 py-1.5 text-sm text-ink focus:border-accent focus:outline-none"
            >
              <option value="ANY">Any</option>
              <option value="MEDIUM">Medium+</option>
              <option value="HIGH">High</option>
              <option value="VERY_HIGH">Very High</option>
            </select>
          </label>
        </div>
        <p className="mt-3 text-[11px] text-ink-faint">
          {fmtInt(scan.eligibleCount)} of {fmtInt(scan.totalRows)} targets satisfy these
          filters. The Opportunity Score is deterministic (fixed weights:
          probability, recovery time, expansion, event count, confidence).
        </p>
      </section>

      {scan.eligibleCount === 0 ? (
        <section className="card flex flex-col items-center gap-2 p-10 text-center">
          <AlertIcon className="text-2xl text-warning" />
          <h2 className="text-base font-semibold text-ink">No historical opportunities match the filters</h2>
          <p className="max-w-md text-sm text-ink-muted">Lower the minimum probability or relax the other filters to surface more targets.</p>
        </section>
      ) : (
        <>
          {/* Summary cards */}
          <section>
            <h2 className="stat-label mb-2">Opportunity Summary</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
              <StatCard label="Highest Historical Probability" tone="positive" value={highlights.highestProbability ? fmtPercent(highlights.highestProbability.probabilityPct) : '—'} hint={highlights.highestProbability ? `to ${fmtNumber(highlights.highestProbability.targetGap, 2)}` : undefined} />
              <StatCard label="Highest Confidence Opportunity" tone="accent" value={highlights.highestConfidence ? highlights.highestConfidence.confidenceLabel : '—'} hint={highlights.highestConfidence ? `to ${fmtNumber(highlights.highestConfidence.targetGap, 2)}` : undefined} />
              <StatCard label="Fastest Historical Recovery" value={highlights.fastestRecovery ? fmtDuration(highlights.fastestRecovery.avgTimeSec) : '—'} hint={highlights.fastestRecovery ? `to ${fmtNumber(highlights.fastestRecovery.targetGap, 2)}` : undefined} />
              <StatCard label="Safest Historical Expansion" tone="positive" value={highlights.safestExpansion ? fmtNumber(highlights.safestExpansion.worstMaxGap, 3) : '—'} hint={highlights.safestExpansion ? `to ${fmtNumber(highlights.safestExpansion.targetGap, 2)}` : undefined} />
              <StatCard label="Largest Historical Sample" value={highlights.largestSample ? fmtInt(highlights.largestSample.totalEvents) : '—'} hint="historical events" />
            </div>
          </section>

          {/* Best Historical Opportunity featured card */}
          {best && (
            <section className={['card border p-5', probabilityBand(best.row.probabilityPct).border, probabilityBand(best.row.probabilityPct).bg].join(' ')}>
              <div className="mb-3 flex items-center gap-2">
                <BulbIcon className="text-base text-accent" />
                <h2 className="text-sm font-semibold uppercase tracking-wide text-ink">Best Historical Opportunity</h2>
                <span className="ml-auto rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
                  Score {fmtNumber(best.score, 1)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-7">
                <Featured label="Current Gap" value={fmtNumber(currentGap, 2)} />
                <Featured label="Historical Target" value={fmtNumber(best.row.targetGap, 2)} tone="text-accent" />
                <Featured label="Historical Probability" value={fmtPercent(best.row.probabilityPct)} tone={probabilityBand(best.row.probabilityPct).text} />
                <Featured label="Average Recovery" value={fmtDuration(best.row.avgTimeSec)} />
                <Featured label="Historical Events" value={fmtInt(best.row.totalEvents)} />
                <Featured label="Worst Historical Expansion" value={fmtNumber(best.row.worstMaxGap, 2)} tone="text-negative" />
                <Featured label="Research Confidence" value={best.row.confidenceLabel} />
              </div>
              <p className="mt-3 text-[11px] text-ink-faint">
                Historical evidence only — this describes what happened historically, not a recommendation to act.
              </p>
            </section>
          )}

          {/* Top 10 ranking cards */}
          <section>
            <h2 className="stat-label mb-2">Top Historical Opportunities</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {top10.map((o) => {
                const band = probabilityBand(o.row.probabilityPct);
                return (
                  <div key={o.row.targetGap} className={['rounded-lg border p-3', band.border, band.bg].join(' ')}>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-ink-faint">#{o.rank}</span>
                      <span className={['inline-flex items-center gap-1 text-[11px]', band.text].join(' ')}>
                        <span className={['h-2 w-2 rounded-full', band.dot].join(' ')} />
                        {band.label}
                      </span>
                    </div>
                    <div className="font-mono text-lg font-semibold text-ink">{fmtNumber(o.row.targetGap, 2)}</div>
                    <div className={['font-mono text-sm font-semibold', band.text].join(' ')}>{fmtPercent(o.row.probabilityPct)}</div>
                    <div className="mt-1 space-y-0.5 text-[11px] text-ink-faint">
                      <div>Time {fmtDuration(o.row.avgTimeSec)}</div>
                      <div>Confidence {o.row.confidenceLabel}</div>
                      <div>Score <span className="font-mono text-ink-muted">{fmtNumber(o.score, 1)}</span></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Table */}
          <section className="card overflow-hidden">
            <header className="flex flex-wrap items-center gap-2 border-b border-panel-border px-5 py-3">
              <TableIcon className="text-base text-accent" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-ink">Opportunity Table</h2>
              <span className="text-xs text-ink-faint">{fmtInt(tableRows.length)} opportunities</span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search target gap"
                className="ml-auto w-44 rounded-md border border-panel-border bg-panel px-2 py-1 text-xs text-ink focus:border-accent focus:outline-none"
              />
              <button type="button" onClick={() => downloadExport(opportunityCsv(scan))} className="btn flex items-center gap-1.5 px-2.5 py-1 text-xs">
                <DownloadIcon className="text-sm" /> CSV
              </button>
              <button type="button" onClick={() => downloadExport(opportunityJson(scan, currentGap, stamp()))} className="btn flex items-center gap-1.5 px-2.5 py-1 text-xs">
                <DownloadIcon className="text-sm" /> JSON
              </button>
            </header>
            <div className="max-h-[32rem] overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 z-10 bg-panel text-xs uppercase tracking-wide text-ink-faint">
                  <tr>
                    <Th label="Rank" k="rank" sortKey={sortKey} desc={desc} onSort={toggleSort} />
                    <Th label="Target Gap" k="targetGap" sortKey={sortKey} desc={desc} onSort={toggleSort} align="right" />
                    <Th label="Historical Probability" k="probabilityPct" sortKey={sortKey} desc={desc} onSort={toggleSort} align="right" />
                    <Th label="Avg Recovery Time" k="avgTimeSec" sortKey={sortKey} desc={desc} onSort={toggleSort} align="right" />
                    <Th label="Historical Events" k="totalEvents" sortKey={sortKey} desc={desc} onSort={toggleSort} align="right" />
                    <Th label="Worst Expansion" k="worstMaxGap" sortKey={sortKey} desc={desc} onSort={toggleSort} align="right" />
                    <Th label="P95 Expansion" k="p95MaxGap" sortKey={sortKey} desc={desc} onSort={toggleSort} align="right" />
                    <th className="px-3 py-2 font-medium">Confidence</th>
                    <Th label="Opportunity Score" k="score" sortKey={sortKey} desc={desc} onSort={toggleSort} align="right" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-panel-border font-mono text-xs">
                  {tableRows.map((o) => {
                    const band = probabilityBand(o.row.probabilityPct);
                    return (
                      <tr key={o.row.targetGap} className="hover:bg-panel/50">
                        <td className="px-3 py-1.5 text-ink-muted">#{o.rank}</td>
                        <td className="px-3 py-1.5 text-right text-ink">{fmtNumber(o.row.targetGap, 2)}</td>
                        <td className={['px-3 py-1.5 text-right font-semibold', band.text].join(' ')}>{fmtPercent(o.row.probabilityPct)}</td>
                        <td className="px-3 py-1.5 text-right text-ink-muted">{fmtDuration(o.row.avgTimeSec)}</td>
                        <td className="px-3 py-1.5 text-right text-ink-muted">{fmtInt(o.row.totalEvents)}</td>
                        <td className="px-3 py-1.5 text-right text-negative">{fmtNumber(o.row.worstMaxGap, 3)}</td>
                        <td className="px-3 py-1.5 text-right text-ink-muted">{fmtNumber(o.row.p95MaxGap, 3)}</td>
                        <td className="px-3 py-1.5 font-sans text-ink-muted">{o.row.confidenceLabel}</td>
                        <td className="px-3 py-1.5 text-right font-semibold text-ink">{fmtNumber(o.score, 1)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <footer className="border-t border-panel-border px-5 py-2 text-[11px] text-ink-faint">
              Deterministic Opportunity Score from the existing probability matrix.
              Historical evidence only — not a signal, recommendation or strategy selector.
            </footer>
          </section>
        </>
      )}
    </div>
  );
}

function Featured({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <div className="stat-label">{label}</div>
      <div className={['mt-0.5 font-mono text-base font-semibold', tone ?? 'text-ink'].join(' ')}>{value}</div>
    </div>
  );
}

function Th({
  label,
  k,
  sortKey,
  desc,
  onSort,
  align,
}: {
  label: string;
  k: SortKey;
  sortKey: SortKey;
  desc: boolean;
  onSort: (k: SortKey) => void;
  align?: 'right';
}) {
  return (
    <th
      onClick={() => onSort(k)}
      className={['cursor-pointer select-none px-3 py-2 font-medium', align === 'right' ? 'text-right' : ''].join(' ')}
    >
      {label}
      {sortKey === k ? <span className="ml-1 text-ink-faint">{desc ? '▼' : '▲'}</span> : null}
    </th>
  );
}
