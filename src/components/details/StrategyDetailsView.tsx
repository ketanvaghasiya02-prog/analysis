/**
 * Historical Strategy Details — the "Strategy Dossier" (Phase 11E).
 *
 * A READ-ONLY investigation of one strategy selected from the ranking. Every
 * figure is read or aggregated from the Research Repository — the Research
 * Engine is never rerun. This is historical evidence only, never a
 * recommendation or signal.
 */

import { useMemo, useState } from 'react';
import { useData } from '@/context/DataContext';
import { useRepository } from '@/context/RepositoryContext';
import { useStrategyFocus } from '@/context/StrategyFocusContext';
import { buildDossier, dossierCsv, dossierJson, printDossierPdf } from '@/utils/strategyDossier';
import type { OccurrenceRecord } from '@/utils/strategyExecution';
import { OUTCOME_LABELS, type ScenarioOutcome } from '@/utils/scenario';
import { downloadExport } from '@/utils/reports';
import { fmtDuration, fmtInt, fmtNumber, fmtPercent } from '@/utils/format';
import { AlertIcon, DownloadIcon, LayersIcon, TableIcon } from '@/components/common/icons';
import { StatCard } from '@/components/overview/StatCard';
import {
  MonthlyBarChart,
  OutcomePieChart,
  RecoveryHistogramChart,
  SessionBarChart,
  SessionPieChart,
} from '@/components/details/DossierCharts';

function Card({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={['card p-5', className ?? ''].join(' ')}>
      <h2 className="stat-label mb-3">{title}</h2>
      {children}
    </section>
  );
}

function Metric({ label, value, tone }: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-panel-border/60 py-1.5 last:border-0">
      <span className="text-xs text-ink-faint">{label}</span>
      <span className={['font-mono text-sm', tone ?? 'text-ink'].join(' ')}>{value}</span>
    </div>
  );
}

function ChartBox({ title, subtitle, children, height = 'h-60' }: { title: string; subtitle?: string; children: React.ReactNode; height?: string }) {
  return (
    <div className="rounded-lg border border-panel-border p-3">
      <div className="mb-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-ink">{title}</div>
        {subtitle ? <div className="text-[11px] text-ink-faint">{subtitle}</div> : null}
      </div>
      <div className={['w-full', height].join(' ')}>{children}</div>
    </div>
  );
}

/** Objective historical status chips (descriptive, never advice). */
function statusChips(recoveryBefore: number, recoveryIgnoring: number, slHit: number, confidence: string): string[] {
  const chips: string[] = [];
  if (recoveryBefore >= 70) chips.push('Historically Strong');
  else if (recoveryBefore >= 50) chips.push('Historically Moderate');
  if (recoveryIgnoring >= 80 && slHit <= 40) chips.push('Historically Consistent');
  if (confidence === 'High' || confidence === 'Very High') chips.push('Historically High Confidence');
  if (chips.length === 0) chips.push('Limited Historical Evidence');
  return chips;
}

type OccSortKey = 'date' | 'maxGap' | 'recoveryTimeSec' | 'holdingSec' | 'entryGap';

export function StrategyDetailsView() {
  const { setView } = useData();
  const { records } = useRepository();
  const { focus } = useStrategyFocus();

  const record = useMemo(
    () => (focus ? records.find((r) => r.key === focus.key) ?? null : null),
    [records, focus],
  );

  const dossier = useMemo(() => (record ? buildDossier(record) : null), [record]);

  // Occurrence explorer state
  const [search, setSearch] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState<'ALL' | ScenarioOutcome>('ALL');
  const [sortKey, setSortKey] = useState<OccSortKey>('date');
  const [desc, setDesc] = useState(false);

  const occurrences = record?.occurrences ?? [];

  const filteredOcc = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = occurrences.filter((o) => {
      if (outcomeFilter !== 'ALL' && o.outcome !== outcomeFilter) return false;
      if (q) {
        const hay = `${o.date} ${o.time} ${o.session} ${OUTCOME_LABELS[o.outcome]}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    list = [...list].sort((a, b) => {
      let av: number | string;
      let bv: number | string;
      if (sortKey === 'date') {
        av = `${a.date} ${a.time}`;
        bv = `${b.date} ${b.time}`;
        return desc ? (av < bv ? 1 : av > bv ? -1 : 0) : av < bv ? -1 : av > bv ? 1 : 0;
      }
      av = (a[sortKey] as number | null) ?? -Infinity;
      bv = (b[sortKey] as number | null) ?? -Infinity;
      return desc ? (bv as number) - (av as number) : (av as number) - (bv as number);
    });
    return list;
  }, [occurrences, search, outcomeFilter, sortKey, desc]);

  const shownOcc = filteredOcc.slice(0, 500);
  const stamp = () => new Date().toISOString();

  const toggleSort = (k: OccSortKey) => {
    if (k === sortKey) setDesc((d) => !d);
    else {
      setSortKey(k);
      setDesc(k !== 'date');
    }
  };

  // --- empty states -----------------------------------------------------------
  if (!focus || !record || !dossier) {
    return (
      <div className="space-y-5">
        <BackBar onBack={() => setView('ranking')} title="Strategy Dossier" />
        <section className="card flex flex-col items-center gap-3 p-10 text-center">
          <LayersIcon className="text-3xl text-ink-faint" />
          <h2 className="text-base font-semibold text-ink">No strategy selected</h2>
          <p className="max-w-md text-sm text-ink-muted">
            Open the Strategy Ranking page and choose a ranked strategy to view
            its complete historical dossier.
          </p>
          <button type="button" onClick={() => setView('ranking')} className="btn btn-active px-3 py-1.5">
            Go to Strategy Ranking
          </button>
        </section>
      </div>
    );
  }

  const chips = statusChips(
    record.recoveryBeforeSlPct,
    record.recoveryIgnoringSlPct,
    record.slHitPct,
    record.confidenceLabel,
  );

  return (
    <div className="space-y-5">
      <BackBar onBack={() => setView('ranking')} title={`Strategy Dossier — ${record.id}`} />

      {/* Disclaimer */}
      <section className="card flex items-start gap-3 border-accent/30 bg-accent/5 p-3">
        <AlertIcon className="mt-0.5 text-base text-accent" />
        <p className="text-xs leading-relaxed text-ink-muted">
          Read-only historical evidence for one strategy, drawn entirely from
          stored research results. The Research Engine is never rerun. This is not
          a trading signal and is not a recommendation — past statistics do not
          guarantee future performance.
        </p>
      </section>

      {/* Export */}
      <section className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <span key={c} className="rounded-full border border-accent/40 bg-accent/10 px-2.5 py-0.5 text-[11px] font-medium text-accent">
              {c}
            </span>
          ))}
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <button type="button" onClick={() => printDossierPdf(record, dossier, stamp())} className="btn flex items-center gap-1.5 px-3 py-1.5 text-sm">
            <DownloadIcon className="text-sm" /> PDF
          </button>
          <button type="button" onClick={() => downloadExport(dossierCsv(record))} className="btn flex items-center gap-1.5 px-3 py-1.5 text-sm">
            <DownloadIcon className="text-sm" /> CSV
          </button>
          <button type="button" onClick={() => downloadExport(dossierJson(record, dossier, stamp()))} className="btn flex items-center gap-1.5 px-3 py-1.5 text-sm">
            <DownloadIcon className="text-sm" /> JSON
          </button>
        </div>
      </section>

      {/* Split layout: LEFT summary / RIGHT analytics */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,380px)_1fr]">
        {/* LEFT — Strategy Summary */}
        <div className="space-y-4">
          <Card title="Strategy Identity">
            <Metric label="Strategy ID" value={record.id} tone="text-ink-muted" />
            <Metric label="Entry Gap" value={fmtNumber(record.entryGap, 2)} />
            <Metric label="Recovery Gap" value={fmtNumber(record.recoveryGap, 2)} />
            <Metric label="Stop Loss" value={fmtNumber(record.stopLoss, 2)} />
            <Metric label="Ranking Position" value={focus.rank !== null ? `#${focus.rank}${focus.modeLabel ? ` · ${focus.modeLabel}` : ''}` : '—'} tone="text-accent" />
            <Metric label="Overall Score" value={focus.overall !== null ? fmtNumber(focus.overall, 1) : '—'} tone="text-accent" />
            <Metric label="Research Confidence" value={record.confidenceLabel} />
          </Card>

          <Card title="Historical Performance">
            <Metric label="Historical Trades" value={fmtInt(record.totalPositions)} />
            <Metric label="Recovered Before SL" value={fmtInt(dossier.counts.recoveredBefore)} tone="text-positive" />
            <Metric label="Recovered After SL" value={fmtInt(dossier.counts.recoveredAfter)} tone="text-warning" />
            <Metric label="SL Not Recovered" value={fmtInt(dossier.counts.slNotRecovered)} tone="text-negative" />
            <Metric label="Recovery Before %" value={fmtPercent(record.recoveryBeforeSlPct)} tone="text-positive" />
            <Metric label="Recovery After %" value={fmtPercent(record.recoveryAfterSlPct)} tone="text-warning" />
            <Metric label="Recovery Ignoring %" value={fmtPercent(record.recoveryIgnoringSlPct)} tone="text-accent" />
            <Metric label="SL Hit %" value={fmtPercent(record.slHitPct)} tone="text-negative" />
            <Metric label="Average Recovery Time" value={fmtDuration(record.avgRecoverySec)} />
            <Metric label="Median Recovery Time" value={fmtDuration(record.medianRecoverySec)} />
            <Metric label="Fastest Recovery" value={fmtDuration(dossier.recoveryTime.fastestSec)} />
            <Metric label="Slowest Recovery" value={fmtDuration(dossier.recoveryTime.slowestSec)} />
          </Card>

          <Card title="Gap Behaviour">
            <Metric label="Average Maximum Gap" value={fmtNumber(dossier.gaps.avg, 3)} />
            <Metric label="Median Maximum Gap" value={fmtNumber(dossier.gaps.median, 3)} />
            <Metric label="Worst Maximum Gap" value={fmtNumber(dossier.gaps.worst, 3)} tone="text-negative" />
            <Metric label="P90 Gap" value={fmtNumber(dossier.gaps.p90, 3)} />
            <Metric label="P95 Gap" value={fmtNumber(dossier.gaps.p95, 3)} />
            <Metric label="P99 Gap" value={fmtNumber(dossier.gaps.p99, 3)} />
            <Metric label="Average Compression" value={fmtNumber(dossier.gaps.avgCompression, 3)} tone="text-positive" />
            <Metric label="Maximum Compression" value={fmtNumber(dossier.gaps.maxCompression, 3)} tone="text-positive" />
          </Card>
        </div>

        {/* RIGHT — Historical Analytics */}
        <div className="space-y-4">
          {/* Section 4 — Session Distribution */}
          <Card title="Session Distribution">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <ChartBox title="Occurrences by Session">
                <SessionBarChart sessions={dossier.sessions} />
              </ChartBox>
              <ChartBox title="Session Share">
                <SessionPieChart sessions={dossier.sessions} />
              </ChartBox>
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-ink-faint">
                  <tr>
                    <th className="py-1 font-medium">Session</th>
                    <th className="py-1 text-right font-medium">Occurrences</th>
                    <th className="py-1 text-right font-medium">Recovery %</th>
                    <th className="py-1 text-right font-medium">Avg Holding</th>
                    <th className="py-1 text-right font-medium">SL Hit %</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {dossier.sessions.map((s) => (
                    <tr key={s.session} className="border-t border-panel-border/60">
                      <td className="py-1 font-sans text-ink">{s.session}</td>
                      <td className="py-1 text-right text-ink-muted">{fmtInt(s.occurrences)}</td>
                      <td className="py-1 text-right text-positive">{fmtPercent(s.recoveryPct)}</td>
                      <td className="py-1 text-right text-ink-muted">{fmtDuration(s.avgHoldingSec)}</td>
                      <td className="py-1 text-right text-negative">{fmtPercent(s.slHitPct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Section 5 — Monthly Distribution */}
          <Card title="Monthly Distribution">
            <ChartBox title="Occurrences by Month" height="h-52">
              <MonthlyBarChart months={dossier.months} />
            </ChartBox>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-ink-faint">
                  <tr>
                    <th className="py-1 font-medium">Month</th>
                    <th className="py-1 text-right font-medium">Occurrences</th>
                    <th className="py-1 text-right font-medium">Recovery %</th>
                    <th className="py-1 text-right font-medium">Avg Holding</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {dossier.months.filter((m) => m.occurrences > 0).map((m) => (
                    <tr key={m.month} className="border-t border-panel-border/60">
                      <td className="py-1 font-sans text-ink">{m.label}</td>
                      <td className="py-1 text-right text-ink-muted">{fmtInt(m.occurrences)}</td>
                      <td className="py-1 text-right text-positive">{fmtPercent(m.recoveryPct)}</td>
                      <td className="py-1 text-right text-ink-muted">{fmtDuration(m.avgHoldingSec)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Section 6 — Outcome Breakdown */}
            <Card title="Outcome Breakdown">
              <ChartBox title="Outcomes">
                <OutcomePieChart outcomes={dossier.outcomes} />
              </ChartBox>
            </Card>

            {/* Section 7 — Recovery Time Distribution */}
            <Card title="Recovery Time Distribution">
              <ChartBox title="Recovery Time Histogram">
                <RecoveryHistogramChart bins={dossier.histogram} />
              </ChartBox>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-ink-muted">
                <div>Average: <span className="font-mono text-ink">{fmtDuration(dossier.recoveryTime.avgSec)}</span></div>
                <div>Median: <span className="font-mono text-ink">{fmtDuration(dossier.recoveryTime.medianSec)}</span></div>
                <div>Fastest: <span className="font-mono text-ink">{fmtDuration(dossier.recoveryTime.fastestSec)}</span></div>
                <div>Slowest: <span className="font-mono text-ink">{fmtDuration(dossier.recoveryTime.slowestSec)}</span></div>
              </div>
            </Card>
          </div>

          {/* Section 8 — Historical Evidence */}
          <Card title="Historical Evidence">
            <ul className="space-y-2">
              {dossier.observations.map((o, i) => (
                <li key={i} className="flex items-start gap-2 text-sm leading-relaxed text-ink-muted">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent/70" />
                  <span>{o}</span>
                </li>
              ))}
            </ul>
          </Card>

          {/* Section 10 — Quick Statistics */}
          <section>
            <h2 className="stat-label mb-2">Quick Statistics</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <StatCard label="Highest Expansion" tone="negative" value={fmtNumber(dossier.quick.highestExpansion, 3)} />
              <StatCard label="Lowest Expansion" tone="positive" value={fmtNumber(dossier.quick.lowestExpansion, 3)} />
              <StatCard label="Fastest Recovery" value={fmtDuration(dossier.quick.fastestRecoverySec)} />
              <StatCard label="Longest Holding" value={fmtDuration(dossier.quick.longestHoldingSec)} />
              <StatCard label="Most Active Month" value={dossier.quick.mostActiveMonth ?? '—'} />
              <StatCard label="Most Active Session" value={dossier.quick.mostActiveSession ?? '—'} />
            </div>
          </section>
        </div>
      </div>

      {/* Section 9 — Occurrence Explorer (bottom, full width) */}
      <section className="card overflow-hidden">
        <header className="flex flex-wrap items-center gap-2 border-b border-panel-border px-5 py-3">
          <TableIcon className="text-base text-accent" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink">Occurrence Explorer</h2>
          <span className="text-xs text-ink-faint">
            {fmtInt(filteredOcc.length)} of {fmtInt(occurrences.length)}
            {filteredOcc.length > shownOcc.length ? ` (showing first ${fmtInt(shownOcc.length)})` : ''}
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-2 text-xs">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search date / session / outcome"
              className="w-56 rounded-md border border-panel-border bg-panel px-2 py-1 text-ink focus:border-accent focus:outline-none"
            />
            <select
              value={outcomeFilter}
              onChange={(e) => setOutcomeFilter(e.target.value as 'ALL' | ScenarioOutcome)}
              className="rounded-md border border-panel-border bg-panel px-2 py-1 text-ink focus:border-accent focus:outline-none"
            >
              <option value="ALL">All outcomes</option>
              {dossier.outcomes.map((o) => (
                <option key={o.outcome} value={o.outcome}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </header>
        <div className="max-h-[34rem] overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 z-10 bg-panel text-xs uppercase tracking-wide text-ink-faint">
              <tr>
                <OccTh label="Date" k="date" sortKey={sortKey} desc={desc} onSort={toggleSort} />
                <th className="px-3 py-2 font-medium">Time</th>
                <th className="px-3 py-2 font-medium">Session</th>
                <OccTh label="Entry Gap" k="entryGap" sortKey={sortKey} desc={desc} onSort={toggleSort} align="right" />
                <OccTh label="Max Gap" k="maxGap" sortKey={sortKey} desc={desc} onSort={toggleSort} align="right" />
                <th className="px-3 py-2 text-right font-medium">Recovery Gap</th>
                <OccTh label="Recovery Time" k="recoveryTimeSec" sortKey={sortKey} desc={desc} onSort={toggleSort} align="right" />
                <OccTh label="Holding Time" k="holdingSec" sortKey={sortKey} desc={desc} onSort={toggleSort} align="right" />
                <th className="px-3 py-2 font-medium">Outcome</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-panel-border font-mono text-xs">
              {shownOcc.map((o: OccurrenceRecord, i) => (
                <tr key={`${o.date}-${o.time}-${i}`} className="hover:bg-panel/50">
                  <td className="px-3 py-1.5 text-ink-muted">{o.date}</td>
                  <td className="px-3 py-1.5 text-ink-muted">{o.time}</td>
                  <td className="px-3 py-1.5 font-sans text-ink-muted">{o.session}</td>
                  <td className="px-3 py-1.5 text-right text-ink">{fmtNumber(o.entryGap, 2)}</td>
                  <td className="px-3 py-1.5 text-right text-negative">{fmtNumber(o.maxGap, 3)}</td>
                  <td className="px-3 py-1.5 text-right text-ink-muted">{fmtNumber(o.recoveryGap, 2)}</td>
                  <td className="px-3 py-1.5 text-right text-ink-muted">{fmtDuration(o.recoveryTimeSec)}</td>
                  <td className="px-3 py-1.5 text-right text-ink-muted">{fmtDuration(o.holdingSec)}</td>
                  <td className="px-3 py-1.5 font-sans text-ink-muted">{OUTCOME_LABELS[o.outcome]}</td>
                </tr>
              ))}
              {filteredOcc.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-6 text-center text-ink-faint">
                    {occurrences.length === 0
                      ? 'No per-occurrence evidence stored for this strategy.'
                      : 'No occurrences match the search / filter.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <footer className="border-t border-panel-border px-5 py-2 text-[11px] text-ink-faint">
          Every row is one historical occurrence captured from the stored research
          result. Read-only — the Research Engine is not rerun.
        </footer>
      </section>
    </div>
  );
}

function OccTh({
  label,
  k,
  sortKey,
  desc,
  onSort,
  align,
}: {
  label: string;
  k: OccSortKey;
  sortKey: OccSortKey;
  desc: boolean;
  onSort: (k: OccSortKey) => void;
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

function BackBar({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <div className="flex items-center gap-3">
      <button type="button" onClick={onBack} className="btn px-2.5 py-1 text-sm">
        ← Back to Ranking
      </button>
      <h1 className="text-sm font-semibold uppercase tracking-wide text-ink">{title}</h1>
    </div>
  );
}
