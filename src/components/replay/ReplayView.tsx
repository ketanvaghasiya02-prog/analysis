/**
 * Historical Evidence Replay (Phase 11F).
 *
 * Replays ONE stored occurrence exactly as it happened, by reading the uploaded
 * CSV samples for that occurrence's window. It never reruns the Research Engine,
 * never simulates and never predicts — it only steps a cursor across historical
 * samples and highlights the events that already occurred.
 */

import { useMemo, useRef, useState } from 'react';
import { useData } from '@/context/DataContext';
import { useRepository } from '@/context/RepositoryContext';
import { useStrategyFocus } from '@/context/StrategyFocusContext';
import { buildReplay, replayCsv, printReplayPdf } from '@/utils/replay';
import { type ScenarioOutcome } from '@/utils/scenario';
import { useReplayPlayer } from '@/components/replay/useReplayPlayer';
import { ReplayChart } from '@/components/replay/ReplayChart';
import { exportChartPng } from '@/utils/chartExport';
import { downloadExport } from '@/utils/reports';
import { fmtNumber } from '@/utils/format';
import { AlertIcon, DownloadIcon, ImageIcon, LayersIcon } from '@/components/common/icons';

const SPEEDS = [0.5, 1, 2, 4, 8];

const OUTCOME_DISPLAY: Array<{ key: ScenarioOutcome; label: string }> = [
  { key: 'RECOVERED_BEFORE_SL', label: 'Recovered Before SL' },
  { key: 'RECOVERED_AFTER_SL', label: 'Recovered After SL' },
  { key: 'SL_NOT_RECOVERED', label: 'SL Hit' },
  { key: 'DATASET_END', label: 'Dataset End' },
  { key: 'HOLDING_TIME_EXPIRED', label: 'Holding Expired' },
];

function mmss(sec: number | null): string {
  if (sec === null || !Number.isFinite(sec)) return '—';
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function BackBar({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <div className="flex items-center gap-3">
      <button type="button" onClick={onBack} className="btn px-2.5 py-1 text-sm">
        ← Back to Strategy Details
      </button>
      <h1 className="text-sm font-semibold uppercase tracking-wide text-ink">{title}</h1>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-panel-border bg-panel px-3 py-2">
      <div className="stat-label">{label}</div>
      <div className={['mt-0.5 font-mono text-sm font-semibold', tone ?? 'text-ink'].join(' ')}>{value}</div>
    </div>
  );
}

export function ReplayView() {
  const { setView, dataset } = useData();
  const { records } = useRepository();
  const { focus } = useStrategyFocus();

  const record = useMemo(
    () => (focus ? records.find((r) => r.key === focus.key) ?? null : null),
    [records, focus],
  );
  const occurrences = record?.occurrences ?? [];

  const [occIndex, setOccIndex] = useState(() => {
    const i = focus?.occurrenceIndex ?? 0;
    return Number.isFinite(i) ? (i as number) : 0;
  });
  const [occSearch, setOccSearch] = useState('');

  const clampedIndex = Math.max(0, Math.min(occurrences.length - 1, occIndex));
  const occurrence = occurrences[clampedIndex] ?? null;

  const samples = dataset?.samples ?? [];
  const timeline = useMemo(
    () => (record && occurrence ? buildReplay(samples, record, occurrence) : null),
    [samples, record, occurrence],
  );

  const emptyTimeline = useMemo(
    () => ({ found: false, samples: [], markers: { entryPos: null, maxExpansionPos: null, recoveryStartPos: null, recoveryPos: null, slPos: null, exitPos: null }, levels: { entry: 0, recovery: 0, stopLoss: 0 }, outcome: 'DATASET_END' as ScenarioOutcome, outcomeLabel: '', durationSec: 0, occurrence: occurrence ?? ({} as never) }),
    [occurrence],
  );
  const player = useReplayPlayer(timeline ?? emptyTimeline);
  const chartRef = useRef<HTMLDivElement>(null);

  // --- guard states -----------------------------------------------------------
  if (!focus || !record) {
    return (
      <div className="space-y-5">
        <BackBar onBack={() => setView('ranking')} title="Historical Evidence Replay" />
        <EmptyCard title="No strategy selected" text="Open a strategy from the ranking, then choose an occurrence to replay." onAction={() => setView('ranking')} actionLabel="Go to Strategy Ranking" />
      </div>
    );
  }
  if (occurrences.length === 0) {
    return (
      <div className="space-y-5">
        <BackBar onBack={() => setView('strategy-details')} title="Historical Evidence Replay" />
        <EmptyCard title="No occurrences to replay" text="This strategy has no stored per-occurrence evidence." onAction={() => setView('strategy-details')} actionLabel="Back to Strategy Details" />
      </div>
    );
  }

  const filteredOcc = occurrences
    .map((o, i) => ({ o, i }))
    .filter(({ o }) => {
      const q = occSearch.trim().toLowerCase();
      if (!q) return true;
      return `${o.date} ${o.time} ${o.session} ${o.outcome}`.toLowerCase().includes(q);
    });

  const tl = timeline;
  const dataMissing = !tl || !tl.found || tl.samples.length === 0;

  const pos = player.pos;
  const cur = tl?.samples[pos] ?? null;
  const entryPos = tl?.markers.entryPos ?? 0;

  let maxGapSoFar = -Infinity;
  let minGapSoFar = Infinity;
  if (tl) {
    for (let p = entryPos; p <= pos && p < tl.samples.length; p += 1) {
      const g = tl.samples[p]!.gap;
      if (g > maxGapSoFar) maxGapSoFar = g;
      if (g < minGapSoFar) minGapSoFar = g;
    }
  }
  const maxCompression = tl && Number.isFinite(minGapSoFar) ? tl.levels.entry - minGapSoFar : null;
  const elapsed = cur ? Math.max(0, cur.elapsedSec) : 0;
  const remaining = tl ? Math.max(0, tl.durationSec - elapsed) : 0;
  const resolvePos = tl ? (tl.markers.recoveryPos ?? tl.markers.slPos ?? tl.markers.exitPos ?? 0) : 0;
  const currentOutcome = tl && pos >= resolvePos ? tl.outcomeLabel : 'In progress';

  const eventLog = tl
    ? ([
        { label: 'Entry Triggered', pos: tl.markers.entryPos, color: 'text-warning' },
        { label: 'Maximum Expansion', pos: tl.markers.maxExpansionPos, color: 'text-negative' },
        { label: 'Recovery Started', pos: tl.markers.recoveryStartPos, color: 'text-accent' },
        { label: 'Recovery Completed', pos: tl.markers.recoveryPos, color: 'text-positive' },
        { label: 'Stop Loss Hit', pos: tl.markers.slPos, color: 'text-negative' },
        { label: 'Window End', pos: tl.markers.exitPos, color: 'text-ink-muted' },
      ].filter((e) => e.pos !== null) as Array<{ label: string; pos: number; color: string }>)
        .sort((a, b) => a.pos - b.pos)
    : [];

  const last = tl ? Math.max(0, tl.samples.length - 1) : 0;
  const stamp = () => new Date().toISOString();

  const setOcc = (i: number) => {
    setOccIndex(Math.max(0, Math.min(occurrences.length - 1, i)));
  };

  return (
    <div className="space-y-5">
      <BackBar onBack={() => setView('strategy-details')} title={`Replay — ${record.id}`} />

      <section className="card flex items-start gap-3 border-accent/30 bg-accent/5 p-3">
        <AlertIcon className="mt-0.5 text-base text-accent" />
        <p className="text-xs leading-relaxed text-ink-muted">
          This replays one historical occurrence exactly as recorded in the
          uploaded CSV. It is not a simulation and not a prediction — every value
          and every event time is read directly from stored history.
        </p>
      </section>

      {/* Occurrence navigation + export */}
      <section className="card flex flex-wrap items-center gap-2 p-3">
        <button type="button" onClick={() => setOcc(clampedIndex - 1)} disabled={clampedIndex <= 0} className="btn px-2.5 py-1 text-sm">
          ← Prev
        </button>
        <span className="text-xs text-ink-faint">
          Occurrence {clampedIndex + 1} / {occurrences.length}
        </span>
        <button type="button" onClick={() => setOcc(clampedIndex + 1)} disabled={clampedIndex >= occurrences.length - 1} className="btn px-2.5 py-1 text-sm">
          Next →
        </button>
        <input
          type="text"
          value={occSearch}
          onChange={(e) => setOccSearch(e.target.value)}
          placeholder="Search occurrence"
          className="ml-2 w-48 rounded-md border border-panel-border bg-panel px-2 py-1 text-xs text-ink focus:border-accent focus:outline-none"
        />
        <select
          value={clampedIndex}
          onChange={(e) => setOcc(Number(e.target.value))}
          className="rounded-md border border-panel-border bg-panel px-2 py-1 text-xs text-ink focus:border-accent focus:outline-none"
        >
          {filteredOcc.map(({ o, i }) => (
            <option key={i} value={i}>
              {o.date} {o.time} · {o.session} · {o.outcome}
            </option>
          ))}
        </select>
        <div className="ml-auto flex flex-wrap gap-2">
          <button type="button" onClick={() => tl && exportChartPng(chartRef.current, `Replay_${occurrence?.date}`)} className="btn flex items-center gap-1.5 px-2.5 py-1 text-sm" disabled={dataMissing}>
            <ImageIcon className="text-sm" /> PNG
          </button>
          <button type="button" onClick={() => tl && downloadExport(replayCsv(tl))} className="btn flex items-center gap-1.5 px-2.5 py-1 text-sm" disabled={dataMissing}>
            <DownloadIcon className="text-sm" /> CSV
          </button>
          <button type="button" onClick={() => tl && printReplayPdf(tl, record, stamp())} className="btn flex items-center gap-1.5 px-2.5 py-1 text-sm" disabled={dataMissing}>
            <DownloadIcon className="text-sm" /> PDF
          </button>
        </div>
      </section>

      {dataMissing ? (
        <EmptyCard
          title="Samples not available for this occurrence"
          text={
            dataset
              ? 'The loaded dataset does not contain the samples for this occurrence. Load the same CSV the research was run on to replay it.'
              : 'Load the CSV dataset this research was generated from to replay the occurrence sample-by-sample.'
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[280px_1fr]">
          {/* Side panel */}
          <aside className="space-y-3">
            <div className="card p-4">
              <h2 className="stat-label mb-2">Strategy</h2>
              <SideRow label="Strategy" value={record.id} />
              <SideRow label="Entry" value={fmtNumber(record.entryGap, 2)} />
              <SideRow label="Recovery" value={fmtNumber(record.recoveryGap, 2)} />
              <SideRow label="Stop Loss" value={fmtNumber(record.stopLoss, 2)} />
              <SideRow label="Session" value={occurrence?.session ?? '—'} />
              <SideRow label="Date" value={occurrence?.date ?? '—'} />
              <SideRow label="Historical Rank" value={focus.rank !== null ? `#${focus.rank}` : '—'} />
              <SideRow label="Confidence" value={record.confidenceLabel} />
            </div>

            {/* Event log */}
            <div className="card p-4">
              <h2 className="stat-label mb-2">Event Log</h2>
              <ul className="space-y-1.5 font-mono text-xs">
                {eventLog.map((e) => {
                  const reached = pos >= e.pos;
                  const t = tl?.samples[e.pos];
                  return (
                    <li key={e.label} className={['flex items-center justify-between rounded px-2 py-1', reached ? 'bg-panel/60' : 'opacity-50'].join(' ')}>
                      <span className="text-ink-faint">{t ? t.time.slice(-8) : '—'}</span>
                      <span className={['font-sans', e.color].join(' ')}>{e.label}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </aside>

          {/* Main */}
          <div className="space-y-4">
            {/* Live statistics */}
            <section className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
              <Stat label="Current Time" value={cur ? cur.time.slice(-8) : '—'} />
              <Stat label="Current Gap" value={cur ? fmtNumber(cur.gap, 3) : '—'} tone="text-accent" />
              <Stat label="Max Gap So Far" value={Number.isFinite(maxGapSoFar) ? fmtNumber(maxGapSoFar, 3) : '—'} tone="text-negative" />
              <Stat label="Max Compression" value={maxCompression !== null ? fmtNumber(maxCompression, 3) : '—'} tone="text-positive" />
              <Stat label="Elapsed" value={mmss(elapsed)} />
              <Stat label="Remaining" value={mmss(remaining)} />
              <Stat label="Current Outcome" value={currentOutcome} tone="text-warning" />
            </section>

            {/* Chart */}
            <section className="card p-4">
              <div ref={chartRef} className="h-72 w-full">
                <ReplayChart timeline={tl!} pos={pos} />
              </div>

              {/* Timeline panel */}
              <div className="mt-3">
                <div className="relative h-2 w-full rounded-full bg-panel-border">
                  <div className="absolute left-0 top-0 h-full rounded-full bg-accent/40" style={{ width: `${last > 0 ? (pos / last) * 100 : 0}%` }} />
                  {eventLog.map((e) => (
                    <button
                      key={e.label}
                      type="button"
                      title={e.label}
                      onClick={() => player.jumpTo(e.pos)}
                      className="absolute -top-1 h-4 w-4 -translate-x-1/2 rounded-full border-2 border-panel bg-accent hover:scale-125"
                      style={{ left: `${last > 0 ? (e.pos / last) * 100 : 0}%` }}
                    />
                  ))}
                </div>
                <input
                  type="range"
                  min={0}
                  max={last}
                  value={pos}
                  onChange={(e) => player.jumpTo(Number(e.target.value))}
                  className="mt-2 w-full accent-accent"
                />
              </div>

              {/* Controls */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {!player.playing ? (
                  <button type="button" onClick={player.play} className="btn btn-active px-3 py-1.5 text-sm">▶ Play</button>
                ) : (
                  <button type="button" onClick={player.pause} className="btn px-3 py-1.5 text-sm">⏸ Pause</button>
                )}
                <button type="button" onClick={player.resume} className="btn px-3 py-1.5 text-sm" disabled={player.playing || player.atEnd}>Resume</button>
                <button type="button" onClick={player.stop} className="btn px-3 py-1.5 text-sm">⏹ Stop</button>
                <button type="button" onClick={player.restart} className="btn px-3 py-1.5 text-sm">↺ Restart</button>
                <button type="button" onClick={player.prev} className="btn px-2.5 py-1.5 text-sm">⏮ Prev</button>
                <button type="button" onClick={player.next} className="btn px-2.5 py-1.5 text-sm">Next ⏭</button>
                <div className="ml-2 flex items-center gap-1">
                  <span className="stat-label mr-1">Speed</span>
                  {SPEEDS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => player.setSpeed(s)}
                      className={['btn px-2 py-1 text-xs', player.speed === s ? 'btn-active' : ''].join(' ')}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
                <span className="ml-auto text-xs text-ink-faint">
                  Sample {pos + 1} / {tl!.samples.length}
                </span>
              </div>
            </section>

            {/* Outcome */}
            <section className="card p-4">
              <h2 className="stat-label mb-2">Outcome</h2>
              <div className="mb-3 text-sm text-ink">
                Historical outcome: <span className="font-semibold text-accent">{tl!.outcomeLabel}</span>
                {pos < resolvePos ? <span className="ml-2 text-xs text-ink-faint">(reached at the highlighted event)</span> : null}
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
                {OUTCOME_DISPLAY.map((o) => {
                  const active = o.key === tl!.outcome;
                  return (
                    <div
                      key={o.key}
                      className={[
                        'rounded-lg border px-3 py-2 text-center text-xs',
                        active ? 'border-accent bg-accent/15 text-accent' : 'border-panel-border bg-panel text-ink-faint',
                      ].join(' ')}
                    >
                      {o.label}
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}

function SideRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-panel-border/60 py-1.5 last:border-0">
      <span className="text-xs text-ink-faint">{label}</span>
      <span className="font-mono text-sm text-ink">{value}</span>
    </div>
  );
}

function EmptyCard({ title, text, onAction, actionLabel }: { title: string; text: string; onAction?: () => void; actionLabel?: string }) {
  return (
    <section className="card flex flex-col items-center gap-3 p-10 text-center">
      <LayersIcon className="text-3xl text-ink-faint" />
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      <p className="max-w-md text-sm text-ink-muted">{text}</p>
      {onAction && actionLabel ? (
        <button type="button" onClick={onAction} className="btn btn-active px-3 py-1.5">{actionLabel}</button>
      ) : null}
    </section>
  );
}
