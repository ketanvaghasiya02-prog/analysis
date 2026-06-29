/**
 * Historical Strategy Finder — execution controls, progress panel and summary
 * cards (Phase 11B). Presentation only; all numbers come from the execution
 * controller. No ranking, scoring or comparison.
 */

import type { ExecutionProgress } from '@/components/strategyfinder/useStrategyExecution';
import { StatCard } from '@/components/overview/StatCard';
import { fmtInt, fmtNumber } from '@/utils/format';
import { TargetIcon } from '@/components/common/icons';

/** mm:ss clock from milliseconds. */
export function fmtClock(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms)) return '—';
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Compact ms / s label for a single execution time. */
export function fmtExecMs(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms)) return '—';
  if (ms < 1000) return `${fmtNumber(ms, 0)} ms`;
  return `${fmtNumber(ms / 1000, 2)} s`;
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'positive' | 'warning' | 'negative' | 'accent' }) {
  const toneClass =
    tone === 'positive'
      ? 'text-positive'
      : tone === 'warning'
        ? 'text-warning'
        : tone === 'negative'
          ? 'text-negative'
          : tone === 'accent'
            ? 'text-accent'
            : 'text-ink';
  return (
    <div className="rounded-lg border border-panel-border bg-panel px-3 py-2">
      <div className="stat-label">{label}</div>
      <div className={['mt-0.5 font-mono text-sm font-semibold', toneClass].join(' ')}>{value}</div>
    </div>
  );
}

export function StrategyExecutionPanel({
  progress,
  running,
  paused,
  canStart,
  onStart,
  onPause,
  onResume,
  onStop,
  onReset,
}: {
  progress: ExecutionProgress;
  running: boolean;
  paused: boolean;
  canStart: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onReset: () => void;
}) {
  const pct =
    progress.total > 0 ? Math.round((progress.processed / progress.total) * 100) : 0;

  return (
    <section className="card p-4">
      <header className="mb-3 flex flex-wrap items-center gap-2">
        <TargetIcon className="text-base text-accent" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink">
          Research Execution
        </h2>
        {running && (
          <span className="flex items-center gap-1.5 text-[11px] text-accent">
            <span className={['h-2 w-2 rounded-full bg-accent', paused ? '' : 'animate-pulse'].join(' ')} />
            {paused ? 'Paused' : 'Running'}
          </span>
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          {!running && (
            <button
              type="button"
              onClick={onStart}
              disabled={!canStart}
              className="btn btn-active px-3 py-1.5 text-sm"
            >
              {progress.processed > 0 ? 'Continue' : 'Start Research'}
            </button>
          )}
          {running && !paused && (
            <button type="button" onClick={onPause} className="btn px-3 py-1.5 text-sm">
              Pause
            </button>
          )}
          {running && paused && (
            <button type="button" onClick={onResume} className="btn btn-active px-3 py-1.5 text-sm">
              Resume
            </button>
          )}
          {running && (
            <button type="button" onClick={onStop} className="btn px-3 py-1.5 text-sm">
              Stop
            </button>
          )}
          {!running && progress.processed > 0 && (
            <button type="button" onClick={onReset} className="btn px-3 py-1.5 text-sm">
              Reset
            </button>
          )}
        </div>
      </header>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="mb-1 flex justify-between text-[11px] text-ink-faint">
          <span>
            {fmtInt(progress.processed)} / {fmtInt(progress.total)} processed
          </span>
          <span>{pct}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-panel-border">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-200"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Progress panel */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
        <Stat label="Total Strategies" value={fmtInt(progress.total)} />
        <Stat label="Completed" value={fmtInt(progress.completed)} tone="positive" />
        <Stat label="Running" value={fmtInt(progress.running)} tone="accent" />
        <Stat label="Remaining" value={fmtInt(progress.remaining)} />
        <Stat label="Cached" value={fmtInt(progress.cached)} tone="warning" />
        <Stat label="Failed" value={fmtInt(progress.failed)} tone="negative" />
        <Stat label="Elapsed Time" value={fmtClock(progress.elapsedMs)} />
        <Stat label="Est. Remaining" value={fmtClock(progress.etaMs)} />
        <Stat
          label="Research Speed"
          value={`${fmtNumber(progress.speed, 2)}/s`}
          tone="accent"
        />
      </div>
    </section>
  );
}

/** Execution summary cards (separate from the live progress panel). */
export function StrategyExecutionSummary({ progress }: { progress: ExecutionProgress }) {
  return (
    <section>
      <h2 className="stat-label mb-2">Execution Summary</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-7">
        <StatCard label="Strategies Tested" value={fmtInt(progress.total)} tooltip="READY combinations under research." />
        <StatCard label="Completed" tone="positive" value={fmtInt(progress.completed)} />
        <StatCard label="Running" tone="accent" value={fmtInt(progress.running)} />
        <StatCard label="Cached" tone="warning" value={fmtInt(progress.cached)} tooltip="Loaded from cache — identical strategy already executed." />
        <StatCard label="Failed" tone="negative" value={fmtInt(progress.failed)} />
        <StatCard label="Avg Execution Time" value={fmtExecMs(progress.avgExecMs)} tooltip="Mean Research Engine time per completed strategy." />
        <StatCard label="Est. Remaining Time" value={fmtClock(progress.etaMs)} />
      </div>
    </section>
  );
}
