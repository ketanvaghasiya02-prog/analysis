/**
 * Time Analysis — historical Spot / Future / Gap movement over user-selected
 * date + time windows (new module).
 *
 * Read-only and descriptive: it slices the already-parsed CSV samples for each
 * selected window and reports simple movement statistics + charts. It never
 * re-parses CSV, never calls the Research / Probability engines, and never
 * predicts or recommends. Multiple independent windows can be analysed and
 * compared on the same page.
 */

import { useMemo, useRef, useState } from 'react';
import { useData } from '@/context/DataContext';
import type { GapSample } from '@/types/gap';
import {
  analyzeTimeRange,
  hhmm,
  parseClock,
  type TimeRangeResult,
} from '@/utils/timeAnalysis';
import { TimeChartGroup } from '@/components/timeanalysis/TimeChartGroup';
import { StatCard } from '@/components/overview/StatCard';
import { EmptyState } from '@/components/common/EmptyState';
import { fmtInt, fmtNumber, fmtPercent } from '@/utils/format';
import { AlertIcon, CalendarIcon, ChevronIcon, ClockIcon, TableIcon, TrashIcon } from '@/components/common/icons';

interface Block {
  id: number;
  date: string;
  start: string;
  end: string;
  committed: { date: string; start: string; end: string } | null;
  collapsed: boolean;
}

function uniqueDayKeys(samples: GapSample[]): string[] {
  return [...new Set(samples.map((s) => s.dayKey))].filter((d) => d && d !== 'unknown').sort();
}

function dayBounds(samples: GapSample[], date: string): { start: string; end: string } | null {
  const day = samples
    .filter((s) => s.dayKey === date)
    .sort((a, b) => (parseClock(a.time) ?? 0) - (parseClock(b.time) ?? 0));
  if (day.length === 0) return null;
  return { start: hhmm(day[0]!.time), end: hhmm(day[day.length - 1]!.time) };
}

function delta(v: number | null): { text: string; tone: 'positive' | 'negative' | 'default' } {
  if (v === null || Number.isNaN(v)) return { text: '—', tone: 'default' };
  const tone = v > 1e-9 ? 'positive' : v < -1e-9 ? 'negative' : 'default';
  return { text: `${v >= 0 ? '+' : ''}${fmtNumber(v, 2)}`, tone };
}

// --- summary + description ----------------------------------------------------

function ResultBody({ result, id }: { result: TimeRangeResult; id: number }) {
  if (result.status !== 'ok' || !result.stats) {
    return (
      <div className="p-4">
        <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm text-warning">
          <AlertIcon className="mt-0.5 text-base" />
          <div>
            <div>{result.message ?? 'No data.'}</div>
            {result.status === 'empty' && result.availableStart && (
              <div className="mt-1 text-[12px] text-ink-muted">
                Nearest available range for {result.input.date}: {result.availableStart} – {result.availableEnd}.
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const s = result.stats;
  const spotD = delta(s.spotChange);
  const futureD = delta(s.futureChange);
  const gapD = delta(s.gapChange);

  return (
    <div className="space-y-5 p-4">
      {/* Interactive, synchronized charts */}
      <TimeChartGroup series={result.series} id={id} />

      {/* Summary cards */}
      <div>
        <h4 className="stat-label mb-2">Summary</h4>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          <StatCard label="Window" value={`${s.startTime} – ${s.endTime}`} hint={`${fmtInt(s.totalSamples)} samples`} />
          <StatCard label="Spot" value={`${fmtNumber(s.startSpot, 2)} → ${fmtNumber(s.endSpot, 2)}`} hint={`change ${spotD.text}`} tone={spotD.tone} />
          <StatCard label="Future" value={`${fmtNumber(s.startFuture, 2)} → ${fmtNumber(s.endFuture, 2)}`} hint={`change ${futureD.text}`} tone={futureD.tone} />
          <StatCard label="Gap" value={`${fmtNumber(s.startGap, 2)} → ${fmtNumber(s.endGap, 2)}`} hint={`change ${gapD.text}`} tone={gapD.tone} />
          <StatCard label="Maximum Gap" tone="negative" value={fmtNumber(s.maxGap, 2)} hint={s.maxGapTime ? `at ${s.maxGapTime}` : undefined} />
          <StatCard label="Minimum Gap" tone="positive" value={fmtNumber(s.minGap, 2)} hint={s.minGapTime ? `at ${s.minGapTime}` : undefined} />
          <StatCard label="Average Gap" value={fmtNumber(s.avgGap, 2)} hint={`median ${fmtNumber(s.medianGap, 2)}`} />
          <StatCard label="Gap Range" value={fmtNumber(s.gapRange, 2)} tooltip="Maximum gap − minimum gap over the window." />
          <StatCard label="Total Samples" value={fmtInt(s.totalSamples)} />
          <StatCard label="Session" value={s.sessions.length ? s.sessions.join(', ') : '—'} />
          <StatCard label="Sync Quality" value={s.syncQualityPct === null ? '—' : fmtPercent(s.syncQualityPct)} tone={s.syncQualityPct !== null && s.syncQualityPct >= 95 ? 'positive' : 'warning'} />
        </div>
      </div>

      {/* Description */}
      <div className="rounded-lg border border-panel-border bg-panel-raised/40 p-4">
        <div className="stat-label mb-1">Description</div>
        <p className="text-sm leading-relaxed text-ink-muted">{result.description}</p>
      </div>
    </div>
  );
}

// --- page ---------------------------------------------------------------------

export function TimeAnalysisView() {
  const { dataset } = useData();
  const samples = dataset?.samples ?? [];

  const dayKeys = useMemo(() => uniqueDayKeys(samples), [samples]);

  const [blocks, setBlocks] = useState<Block[]>(() => {
    const date = dayKeys[0] ?? uniqueDayKeys(samples)[0] ?? '';
    const b = date ? dayBounds(samples, date) : null;
    return [
      {
        id: 0,
        date,
        start: b?.start ?? '',
        end: b?.end ?? '',
        committed: date && b ? { date, start: b.start, end: b.end } : null,
        collapsed: false,
      },
    ];
  });
  const nextId = useRef(1);

  const results = useMemo<Array<TimeRangeResult | null>>(
    () => blocks.map((b) => (b.committed ? analyzeTimeRange(samples, b.committed) : null)),
    [blocks, samples],
  );

  const update = (id: number, patch: Partial<Block>) =>
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));

  const analyze = (id: number) =>
    setBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, committed: { date: b.date, start: b.start, end: b.end }, collapsed: false } : b)),
    );

  const addBlock = () => {
    const date = dayKeys[0] ?? '';
    const b = date ? dayBounds(samples, date) : null;
    const id = nextId.current;
    nextId.current += 1;
    setBlocks((prev) => [...prev, { id, date, start: b?.start ?? '', end: b?.end ?? '', committed: null, collapsed: false }]);
  };

  const removeBlock = (id: number) => setBlocks((prev) => (prev.length > 1 ? prev.filter((b) => b.id !== id) : prev));

  if (samples.length === 0) {
    return (
      <EmptyState
        title="No uploaded data"
        description="Upload one or more GapMonitor CSV exports to analyse Spot, Future and Gap movement across custom time windows."
      />
    );
  }

  // Comparison rows for OK ranges (only when 2+).
  const okRanges = results
    .map((r, i) => ({ r, n: i + 1 }))
    .filter((x): x is { r: TimeRangeResult; n: number } => x.r !== null && x.r.status === 'ok' && x.r.stats !== null);

  return (
    <div className="space-y-5">
      {/* Header */}
      <section className="card flex flex-wrap items-start gap-3 border-accent/30 bg-accent/5 p-4">
        <ClockIcon className="mt-0.5 text-base text-accent" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-ink">Time Analysis</p>
            <span className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
              Historical Windows
            </span>
          </div>
          <p className="mt-1 text-sm leading-relaxed text-ink-muted">
            Select one or more date + time windows and see exactly what Spot, Future and Gap did
            during each period. Descriptive historical analysis only — no prediction, no recommendation.
          </p>
        </div>
        <button
          type="button"
          onClick={addBlock}
          className="shrink-0 rounded-md border border-accent/50 bg-accent/15 px-3 py-1.5 text-xs font-semibold text-accent transition-colors hover:bg-accent/25"
        >
          + Add Another Time Range
        </button>
      </section>

      {/* Comparison summary */}
      {okRanges.length >= 2 && (
        <section className="card overflow-hidden">
          <header className="flex items-center gap-2 border-b border-panel-border px-5 py-3">
            <TableIcon className="text-base text-accent" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink">Comparison Summary</h2>
            <span className="ml-auto text-[11px] text-ink-faint">{okRanges.length} ranges</span>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-panel uppercase tracking-wide text-ink-faint">
                <tr>
                  <th className="px-3 py-2 font-medium">Range</th>
                  <th className="px-3 py-2 font-medium">Date · Window</th>
                  <th className="px-3 py-2 text-right font-medium">Start Gap</th>
                  <th className="px-3 py-2 text-right font-medium">End Gap</th>
                  <th className="px-3 py-2 text-right font-medium">Max Gap</th>
                  <th className="px-3 py-2 text-right font-medium">Min Gap</th>
                  <th className="px-3 py-2 text-right font-medium">Gap Change</th>
                  <th className="px-3 py-2 text-right font-medium">Samples</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-panel-border font-mono">
                {okRanges.map(({ r, n }) => {
                  const st = r.stats!;
                  const d = delta(st.gapChange);
                  return (
                    <tr key={n} className="hover:bg-panel/40">
                      <td className="px-3 py-1.5 font-sans text-ink">#{n}</td>
                      <td className="px-3 py-1.5 font-sans text-ink-muted">{r.input.date} · {st.startTime}–{st.endTime}</td>
                      <td className="px-3 py-1.5 text-right text-ink">{fmtNumber(st.startGap, 2)}</td>
                      <td className="px-3 py-1.5 text-right text-ink">{fmtNumber(st.endGap, 2)}</td>
                      <td className="px-3 py-1.5 text-right text-negative">{fmtNumber(st.maxGap, 2)}</td>
                      <td className="px-3 py-1.5 text-right text-positive">{fmtNumber(st.minGap, 2)}</td>
                      <td className={['px-3 py-1.5 text-right', d.tone === 'positive' ? 'text-positive' : d.tone === 'negative' ? 'text-negative' : 'text-ink-muted'].join(' ')}>{d.text}</td>
                      <td className="px-3 py-1.5 text-right text-ink-muted">{fmtInt(st.totalSamples)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Blocks */}
      {blocks.map((block, i) => {
        const result = results[i] ?? null;
        return (
          <section key={block.id} className="card overflow-hidden p-0">
            {/* Block header */}
            <header className="flex flex-wrap items-center gap-2 border-b border-panel-border px-4 py-3">
              <button
                type="button"
                onClick={() => update(block.id, { collapsed: !block.collapsed })}
                className="flex items-center gap-2 text-sm font-semibold text-ink"
              >
                <ChevronIcon className={['text-sm text-ink-faint transition-transform', block.collapsed ? '-rotate-90' : ''].join(' ')} />
                Time Analysis #{i + 1}
              </button>
              {block.committed && (
                <span className="text-[11px] text-ink-faint">
                  {block.committed.date} · {block.committed.start}–{block.committed.end}
                </span>
              )}
              {blocks.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeBlock(block.id)}
                  className="ml-auto flex items-center gap-1 text-xs text-ink-faint transition-colors hover:text-negative"
                  title="Remove this time range"
                >
                  <TrashIcon className="text-sm" /> Remove
                </button>
              )}
            </header>

            {!block.collapsed && (
              <>
                {/* Inputs */}
                <div className="flex flex-wrap items-end gap-3 border-b border-panel-border px-4 py-3">
                  <label className="flex flex-col gap-1">
                    <span className="stat-label flex items-center gap-1"><CalendarIcon className="text-xs" /> Date</span>
                    <input
                      type="date"
                      value={block.date}
                      min={dayKeys[0]}
                      max={dayKeys[dayKeys.length - 1]}
                      onChange={(e) => update(block.id, { date: e.target.value })}
                      className="rounded-md border border-panel-border bg-panel px-3 py-1.5 text-sm text-ink focus:border-accent focus:outline-none"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="stat-label">Start Time</span>
                    <input
                      type="time"
                      value={block.start}
                      onChange={(e) => update(block.id, { start: e.target.value })}
                      className="rounded-md border border-panel-border bg-panel px-3 py-1.5 text-sm text-ink focus:border-accent focus:outline-none"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="stat-label">End Time</span>
                    <input
                      type="time"
                      value={block.end}
                      onChange={(e) => update(block.id, { end: e.target.value })}
                      className="rounded-md border border-panel-border bg-panel px-3 py-1.5 text-sm text-ink focus:border-accent focus:outline-none"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => analyze(block.id)}
                    className="rounded-md border border-accent/50 bg-accent/15 px-4 py-1.5 text-sm font-semibold text-accent transition-colors hover:bg-accent/25"
                  >
                    Analyze
                  </button>
                  <span className="text-[11px] text-ink-faint">
                    Available: {dayKeys[0]} → {dayKeys[dayKeys.length - 1]}
                  </span>
                </div>

                {/* Result */}
                {result ? (
                  <ResultBody result={result} id={block.id} />
                ) : (
                  <div className="p-6 text-center text-sm text-ink-faint">
                    Configure a date and time window, then click <span className="text-ink-muted">Analyze</span>.
                  </div>
                )}
              </>
            )}
          </section>
        );
      })}

      <p className="text-[11px] text-ink-faint">
        Historical time-window analysis from uploaded CSV data only. Descriptive — never a
        prediction, signal or trading recommendation.
      </p>
    </div>
  );
}
