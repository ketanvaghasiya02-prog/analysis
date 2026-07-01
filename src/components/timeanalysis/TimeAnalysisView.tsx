/**
 * Time Analysis — Spot / Future / Gap movement over custom date/time windows,
 * timezone-aware (new module).
 *
 * The user thinks and enters times in their chosen timezone (Indian Time by
 * default). The Timezone Engine converts those to the broker SERVER clock (which
 * the CSV stores) purely for filtering, and re-labels charts/summaries on the
 * fly. The original CSV timestamps are never modified. Descriptive only.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useData } from '@/context/DataContext';
import type { GapSample } from '@/types/gap';
import { analyzeTimeRange, type TimeRangeResult } from '@/utils/timeAnalysis';
import {
  absSecToHHMM,
  fmtDeltaHM,
  fmtUtcOffset,
  hhmm,
  offsetOf,
  parseClock,
  serverAbsSec,
  tzLabelFull,
  TZ_LABEL,
  DEFAULT_SERVER_OFFSET_MIN,
  type TzConfig,
  type TzKind,
} from '@/utils/timezone';
import { TimeChartGroup } from '@/components/timeanalysis/TimeChartGroup';
import { StatCard } from '@/components/overview/StatCard';
import { EmptyState } from '@/components/common/EmptyState';
import { fmtInt, fmtNumber, fmtPercent } from '@/utils/format';
import { AlertIcon, CalendarIcon, ChevronIcon, ClockIcon, TableIcon, TrashIcon } from '@/components/common/icons';

const TZ_KINDS: TzKind[] = ['ist', 'server', 'utc', 'custom'];
const TZ_KEY = 'grt.ta.tz.v1';

interface TzSettings {
  serverOffsetMin: number;
  customOffsetMin: number;
  defaultTz: TzKind;
}
const DEFAULT_TZ_SETTINGS: TzSettings = { serverOffsetMin: DEFAULT_SERVER_OFFSET_MIN, customOffsetMin: 0, defaultTz: 'ist' };

function loadTz(): TzSettings {
  try {
    const raw = localStorage.getItem(TZ_KEY);
    return raw ? { ...DEFAULT_TZ_SETTINGS, ...(JSON.parse(raw) as Partial<TzSettings>) } : { ...DEFAULT_TZ_SETTINGS };
  } catch {
    return { ...DEFAULT_TZ_SETTINGS };
  }
}
function saveTz(s: TzSettings): void {
  try { localStorage.setItem(TZ_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

interface Block {
  id: number;
  date: string;
  start: string;
  end: string;
  inputTz: TzKind;
  displayTz: TzKind;
  committed: { date: string; start: string; end: string; inputTz: TzKind } | null;
  collapsed: boolean;
}

function uniqueDayKeys(samples: GapSample[]): string[] {
  return [...new Set(samples.map((s) => s.dayKey))].filter((d) => d && d !== 'unknown').sort();
}

function durationLabel(min: number): string {
  const m = Math.max(0, Math.round(min));
  if (m < 60) return `${m} Minute${m === 1 ? '' : 's'}`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return mm ? `${h}h ${mm}m` : `${h}h`;
}

const num = (v: number | null) => (v === null || Number.isNaN(v) ? '—' : fmtNumber(v, 2));

function buildDescription(result: TimeRangeResult, displayTz: TzKind, cfg: TzConfig): string {
  const s = result.stats!;
  const rs = result.reqStartAbsSec!;
  const re = result.reqEndAbsSec!;
  const srv = `${absSecToHHMM(rs, 'server', cfg)}–${absSecToHHMM(re, 'server', cfg)}`;
  const at = (abs: number | null) => {
    if (abs === null) return '';
    return displayTz === 'server'
      ? ` at ${absSecToHHMM(abs, 'server', cfg)}`
      : ` at ${absSecToHHMM(abs, displayTz, cfg)} (Server ${absSecToHHMM(abs, 'server', cfg)})`;
  };
  const window =
    displayTz === 'server'
      ? `Analysis window Server Time ${srv} on ${result.input.date}.`
      : `Analysis window ${TZ_LABEL[displayTz]} ${absSecToHHMM(rs, displayTz, cfg)}–${absSecToHHMM(re, displayTz, cfg)} (Server Time ${srv}) on ${result.input.date}.`;
  return (
    `${window} Spot moved from ${num(s.startSpot)} to ${num(s.endSpot)}, ` +
    `Future moved from ${num(s.startFuture)} to ${num(s.endFuture)}, ` +
    `and Gap changed from ${num(s.startGap)} to ${num(s.endGap)}. ` +
    `The maximum gap during this period was ${num(s.maxGap)}${at(s.maxGapAbsSec)}, ` +
    `while the minimum gap was ${num(s.minGap)}${at(s.minGapAbsSec)}.`
  );
}

// --- result body --------------------------------------------------------------

function ResultBody({
  result,
  block,
  cfg,
  onDisplayTzChange,
}: {
  result: TimeRangeResult;
  block: Block;
  cfg: TzConfig;
  onDisplayTzChange: (tz: TzKind) => void;
}) {
  const { displayTz } = block;

  if (result.status !== 'ok' || !result.stats) {
    const ds = result.datasetStartAbsSec;
    const de = result.datasetEndAbsSec;
    return (
      <div className="p-4">
        <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm text-warning">
          <AlertIcon className="mt-0.5 text-base" />
          <div>
            <div>{result.message ?? 'No data.'}</div>
            {result.status === 'empty' && ds !== null && de !== null && (
              <div className="mt-1 text-[12px] text-ink-muted">
                Available data:{' '}
                {block.inputTz !== 'server' && (
                  <span>{TZ_LABEL[block.inputTz]} {absSecToHHMM(ds, block.inputTz, cfg)} – {absSecToHHMM(de, block.inputTz, cfg)} · </span>
                )}
                Server {absSecToHHMM(ds, 'server', cfg)} – {absSecToHHMM(de, 'server', cfg)}.
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const s = result.stats;
  const rs = result.reqStartAbsSec!;
  const re = result.reqEndAbsSec!;
  const durMin = (re - rs) / 60;

  return (
    <div className="space-y-5 p-4">
      {/* Window summary (both timezones) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-md border border-panel-border bg-panel px-3 py-2">
          <div className="stat-label">Server Time</div>
          <div className="font-mono text-sm font-semibold text-ink">{absSecToHHMM(rs, 'server', cfg)} → {absSecToHHMM(re, 'server', cfg)}</div>
        </div>
        {displayTz !== 'server' && (
          <div className="rounded-md border border-accent/30 bg-accent/5 px-3 py-2">
            <div className="stat-label">{TZ_LABEL[displayTz]}</div>
            <div className="font-mono text-sm font-semibold text-accent">{absSecToHHMM(rs, displayTz, cfg)} → {absSecToHHMM(re, displayTz, cfg)}</div>
          </div>
        )}
        <div className="rounded-md border border-panel-border bg-panel px-3 py-2">
          <div className="stat-label">Duration</div>
          <div className="font-mono text-sm font-semibold text-ink">{durationLabel(durMin)}</div>
        </div>
        <div className="rounded-md border border-panel-border bg-panel px-3 py-2">
          <div className="stat-label">Samples</div>
          <div className="font-mono text-sm font-semibold text-ink">{fmtInt(s.totalSamples)}</div>
        </div>
      </div>

      {/* Interactive charts + display-time toggle */}
      <TimeChartGroup series={result.series} id={block.id} displayTz={displayTz} cfg={cfg} onDisplayTzChange={onDisplayTzChange} />

      {/* Summary cards */}
      <div>
        <h4 className="stat-label mb-2">Summary</h4>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          <StatCard label="Spot" value={`${num(s.startSpot)} → ${num(s.endSpot)}`} hint={`change ${num(s.spotChange)}`} tone={s.spotChange !== null && s.spotChange > 0 ? 'positive' : s.spotChange !== null && s.spotChange < 0 ? 'negative' : 'default'} />
          <StatCard label="Future" value={`${num(s.startFuture)} → ${num(s.endFuture)}`} hint={`change ${num(s.futureChange)}`} tone={s.futureChange !== null && s.futureChange > 0 ? 'positive' : s.futureChange !== null && s.futureChange < 0 ? 'negative' : 'default'} />
          <StatCard label="Gap" value={`${num(s.startGap)} → ${num(s.endGap)}`} hint={`change ${num(s.gapChange)}`} tone={s.gapChange !== null && s.gapChange > 0 ? 'positive' : s.gapChange !== null && s.gapChange < 0 ? 'negative' : 'default'} />
          <StatCard label="Maximum Gap" tone="negative" value={num(s.maxGap)} hint={s.maxGapAbsSec !== null ? `at ${absSecToHHMM(s.maxGapAbsSec, displayTz, cfg)}` : undefined} />
          <StatCard label="Minimum Gap" tone="positive" value={num(s.minGap)} hint={s.minGapAbsSec !== null ? `at ${absSecToHHMM(s.minGapAbsSec, displayTz, cfg)}` : undefined} />
          <StatCard label="Average Gap" value={num(s.avgGap)} hint={`median ${num(s.medianGap)}`} />
          <StatCard label="Gap Range" value={num(s.gapRange)} tooltip="Maximum gap − minimum gap over the window." />
          <StatCard label="Session" value={s.sessions.length ? s.sessions.join(', ') : '—'} />
          <StatCard label="Sync Quality" value={s.syncQualityPct === null ? '—' : fmtPercent(s.syncQualityPct)} tone={s.syncQualityPct !== null && s.syncQualityPct >= 95 ? 'positive' : 'warning'} />
        </div>
      </div>

      {/* Description */}
      <div className="rounded-lg border border-panel-border bg-panel-raised/40 p-4">
        <div className="stat-label mb-1">Description</div>
        <p className="text-sm leading-relaxed text-ink-muted">{buildDescription(result, displayTz, cfg)}</p>
      </div>
    </div>
  );
}

// --- page ---------------------------------------------------------------------

export function TimeAnalysisView() {
  const { dataset } = useData();
  const samples = dataset?.samples ?? [];
  const dayKeys = useMemo(() => uniqueDayKeys(samples), [samples]);

  const [tz, setTz] = useState<TzSettings>(loadTz);
  useEffect(() => saveTz(tz), [tz]);
  const cfg = useMemo<TzConfig>(() => ({ serverOffsetMin: tz.serverOffsetMin, customOffsetMin: tz.customOffsetMin }), [tz.serverOffsetMin, tz.customOffsetMin]);

  const dataBounds = useMemo(() => {
    let mn: number | null = null;
    let mx: number | null = null;
    for (const s of samples) {
      const a = serverAbsSec(s.dayKey, s.time);
      if (a === null) continue;
      if (mn === null || a < mn) mn = a;
      if (mx === null || a > mx) mx = a;
    }
    return { min: mn, max: mx };
  }, [samples]);

  const [blocks, setBlocks] = useState<Block[]>(() => {
    const keys = uniqueDayKeys(samples);
    const date = keys[0] ?? '';
    const day = samples.filter((s) => s.dayKey === date).sort((a, b) => (parseClock(a.time) ?? 0) - (parseClock(b.time) ?? 0));
    const start = day.length ? hhmm(day[0]!.time) : '';
    const end = day.length ? hhmm(day[day.length - 1]!.time) : '';
    // First block: whole first day in SERVER time (safe, no midnight wrap);
    // charts display in the default timezone (IST).
    return [
      {
        id: 0,
        date,
        start,
        end,
        inputTz: 'server',
        displayTz: DEFAULT_TZ_SETTINGS.defaultTz,
        committed: date && start && end ? { date, start, end, inputTz: 'server' } : null,
        collapsed: false,
      },
    ];
  });
  const nextId = useRef(1);

  const results = useMemo<Array<TimeRangeResult | null>>(
    () => blocks.map((b) => (b.committed ? analyzeTimeRange(samples, b.committed, cfg) : null)),
    [blocks, samples, cfg],
  );

  const update = (id: number, patch: Partial<Block>) => setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  const analyze = (id: number) =>
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, committed: { date: b.date, start: b.start, end: b.end, inputTz: b.inputTz }, collapsed: false } : b)));
  const addBlock = () => {
    const date = dayKeys[0] ?? '';
    const id = nextId.current;
    nextId.current += 1;
    setBlocks((prev) => [...prev, { id, date, start: '', end: '', inputTz: tz.defaultTz, displayTz: tz.defaultTz, committed: null, collapsed: false }]);
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

  const serverOff = tz.serverOffsetMin;
  const dispOff = offsetOf(tz.defaultTz, cfg);

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
            <span className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">Historical Windows</span>
          </div>
          <p className="mt-1 text-sm leading-relaxed text-ink-muted">
            Enter time windows in your own timezone; the app converts them to the broker server clock to read the CSV and shows both times.
            The original CSV timestamps are never changed. Descriptive historical analysis only — no prediction, no recommendation.
          </p>
        </div>
        <button type="button" onClick={addBlock} className="shrink-0 rounded-md border border-accent/50 bg-accent/15 px-3 py-1.5 text-xs font-semibold text-accent transition-colors hover:bg-accent/25">
          + Add Another Time Range
        </button>
      </section>

      {/* Timezone settings / auto-detection */}
      <section className="card p-5">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="stat-label">Timezone</h2>
          <span className="text-[11px] text-ink-faint">The CSV stores broker server time with no timezone marker — set your broker's offset below.</span>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <label className="flex flex-col gap-1">
            <span className="stat-label">Broker Server UTC offset (hours)</span>
            <input
              type="number"
              step={0.25}
              value={tz.serverOffsetMin / 60}
              onChange={(e) => { const h = Number(e.target.value); if (Number.isFinite(h)) setTz((p) => ({ ...p, serverOffsetMin: Math.round(h * 60) })); }}
              className="rounded-md border border-panel-border bg-panel px-3 py-1.5 text-sm text-ink focus:border-accent focus:outline-none"
            />
            <span className="text-[10px] text-ink-faint">Assumed {fmtUtcOffset(serverOff)}. Common MT5 gold brokers use UTC+2 / UTC+3.</span>
          </label>
          <div className="flex flex-col gap-1">
            <span className="stat-label">Default Display Timezone</span>
            <div className="flex flex-wrap gap-1.5">
              {TZ_KINDS.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setTz((p) => ({ ...p, defaultTz: k }))}
                  className={['rounded-md border px-2.5 py-1 text-xs font-medium transition-colors', tz.defaultTz === k ? 'border-accent/70 bg-accent/10 text-accent' : 'border-panel-border bg-panel text-ink-muted hover:border-accent hover:text-accent'].join(' ')}
                >
                  {TZ_LABEL[k]}
                </button>
              ))}
            </div>
            <span className="text-[10px] text-ink-faint">Default for new analyses.</span>
          </div>
          <label className="flex flex-col gap-1">
            <span className="stat-label">Custom offset (hours)</span>
            <input
              type="number"
              step={0.25}
              value={tz.customOffsetMin / 60}
              onChange={(e) => { const h = Number(e.target.value); if (Number.isFinite(h)) setTz((p) => ({ ...p, customOffsetMin: Math.round(h * 60) })); }}
              className="rounded-md border border-panel-border bg-panel px-3 py-1.5 text-sm text-ink focus:border-accent focus:outline-none"
            />
            <span className="text-[10px] text-ink-faint">Used when a timezone is set to "Custom".</span>
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[11px] text-ink-muted">
          <span>Broker timezone: <span className="font-mono text-ink">{fmtUtcOffset(serverOff)}</span></span>
          <span>Display timezone: <span className="font-mono text-ink">{tzLabelFull(tz.defaultTz, cfg)}</span></span>
          <span>Offset (display − server): <span className="font-mono text-accent">{fmtDeltaHM(dispOff - serverOff)}</span></span>
        </div>
      </section>

      {/* Comparison summary */}
      {okRanges.length >= 2 && (
        <section className="card overflow-hidden">
          <header className="flex items-center gap-2 border-b border-panel-border px-5 py-3">
            <TableIcon className="text-base text-accent" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink">Comparison Summary</h2>
            <span className="ml-auto text-[11px] text-ink-faint">{okRanges.length} ranges · server time</span>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-panel uppercase tracking-wide text-ink-faint">
                <tr>
                  <th className="px-3 py-2 font-medium">Range</th>
                  <th className="px-3 py-2 font-medium">Date · Server Window</th>
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
                  const change = st.gapChange;
                  return (
                    <tr key={n} className="hover:bg-panel/40">
                      <td className="px-3 py-1.5 font-sans text-ink">#{n}</td>
                      <td className="px-3 py-1.5 font-sans text-ink-muted">{r.input.date} · {absSecToHHMM(r.reqStartAbsSec!, 'server', cfg)}–{absSecToHHMM(r.reqEndAbsSec!, 'server', cfg)}</td>
                      <td className="px-3 py-1.5 text-right text-ink">{num(st.startGap)}</td>
                      <td className="px-3 py-1.5 text-right text-ink">{num(st.endGap)}</td>
                      <td className="px-3 py-1.5 text-right text-negative">{num(st.maxGap)}</td>
                      <td className="px-3 py-1.5 text-right text-positive">{num(st.minGap)}</td>
                      <td className={['px-3 py-1.5 text-right', change !== null && change > 0 ? 'text-positive' : change !== null && change < 0 ? 'text-negative' : 'text-ink-muted'].join(' ')}>{num(change)}</td>
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
        const availHint = dataBounds.min !== null && dataBounds.max !== null;
        return (
          <section key={block.id} className="card overflow-hidden p-0">
            <header className="flex flex-wrap items-center gap-2 border-b border-panel-border px-4 py-3">
              <button type="button" onClick={() => update(block.id, { collapsed: !block.collapsed })} className="flex items-center gap-2 text-sm font-semibold text-ink">
                <ChevronIcon className={['text-sm text-ink-faint transition-transform', block.collapsed ? '-rotate-90' : ''].join(' ')} />
                Time Analysis #{i + 1}
              </button>
              {block.committed && (
                <span className="text-[11px] text-ink-faint">
                  {block.committed.date} · {block.committed.start}–{block.committed.end} · {TZ_LABEL[block.committed.inputTz]}
                </span>
              )}
              {blocks.length > 1 && (
                <button type="button" onClick={() => removeBlock(block.id)} className="ml-auto flex items-center gap-1 text-xs text-ink-faint transition-colors hover:text-negative" title="Remove this time range">
                  <TrashIcon className="text-sm" /> Remove
                </button>
              )}
            </header>

            {!block.collapsed && (
              <>
                <div className="flex flex-wrap items-end gap-3 border-b border-panel-border px-4 py-3">
                  <label className="flex flex-col gap-1">
                    <span className="stat-label flex items-center gap-1"><CalendarIcon className="text-xs" /> Date</span>
                    <input type="date" value={block.date} min={dayKeys[0]} max={dayKeys[dayKeys.length - 1]} onChange={(e) => update(block.id, { date: e.target.value })} className="rounded-md border border-panel-border bg-panel px-3 py-1.5 text-sm text-ink focus:border-accent focus:outline-none" />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="stat-label">Timezone</span>
                    <select value={block.inputTz} onChange={(e) => update(block.id, { inputTz: e.target.value as TzKind })} className="rounded-md border border-panel-border bg-panel px-3 py-1.5 text-sm text-ink focus:border-accent focus:outline-none">
                      {TZ_KINDS.map((k) => <option key={k} value={k}>{TZ_LABEL[k]}</option>)}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="stat-label">Start Time</span>
                    <input type="time" value={block.start} onChange={(e) => update(block.id, { start: e.target.value })} className="rounded-md border border-panel-border bg-panel px-3 py-1.5 text-sm text-ink focus:border-accent focus:outline-none" />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="stat-label">End Time</span>
                    <input type="time" value={block.end} onChange={(e) => update(block.id, { end: e.target.value })} className="rounded-md border border-panel-border bg-panel px-3 py-1.5 text-sm text-ink focus:border-accent focus:outline-none" />
                  </label>
                  <button type="button" onClick={() => analyze(block.id)} className="rounded-md border border-accent/50 bg-accent/15 px-4 py-1.5 text-sm font-semibold text-accent transition-colors hover:bg-accent/25">Analyze</button>
                  {availHint && (
                    <span className="text-[11px] text-ink-faint">
                      Available ({TZ_LABEL[block.inputTz]}): {absSecToHHMM(dataBounds.min!, block.inputTz, cfg)}–{absSecToHHMM(dataBounds.max!, block.inputTz, cfg)}
                    </span>
                  )}
                </div>

                {result ? (
                  <ResultBody result={result} block={block} cfg={cfg} onDisplayTzChange={(t) => update(block.id, { displayTz: t })} />
                ) : (
                  <div className="p-6 text-center text-sm text-ink-faint">
                    Configure a date, timezone and time window, then click <span className="text-ink-muted">Analyze</span>.
                  </div>
                )}
              </>
            )}
          </section>
        );
      })}

      <p className="text-[11px] text-ink-faint">
        Historical time-window analysis from uploaded CSV data only. Timezone conversion is display/filter only — the original CSV
        timestamps are never modified. Descriptive — never a prediction, signal or trading recommendation.
      </p>
    </div>
  );
}
