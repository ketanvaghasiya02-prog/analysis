/**
 * Analysis-mode selector with mode-specific controls
 * (single-day picker and custom date-range inputs).
 */

import { useData } from '@/context/DataContext';
import type { AnalysisMode } from '@/types/gap';

const MODES: Array<{ id: AnalysisMode; label: string }> = [
  { id: 'combined', label: 'Combined Analysis' },
  { id: 'day-wise', label: 'Day Wise Analysis' },
  { id: 'single-day', label: 'Single Day' },
  { id: 'custom-range', label: 'Custom Date Range' },
];

export function AnalysisModeSelector() {
  const { dataset, selection, setMode, setSingleDay, setCustomRange } = useData();
  if (!dataset) return null;

  const realDays = dataset.dayKeys.filter((d) => d !== 'unknown');
  const minDay = realDays[0];
  const maxDay = realDays[realDays.length - 1];

  return (
    <section className="card p-4">
      <div className="stat-label mb-3">Analysis Mode</div>

      <div className="flex flex-wrap gap-2">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMode(m.id)}
            className={[
              'btn',
              selection.mode === m.id ? 'btn-active' : '',
            ].join(' ')}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Single-day picker */}
      {selection.mode === 'single-day' && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs text-ink-muted">Day:</span>
          <select
            value={selection.singleDay ?? ''}
            onChange={(e) => setSingleDay(e.target.value)}
            className="rounded-md border border-panel-border bg-panel px-3 py-1.5 text-sm text-ink focus:border-accent focus:outline-none"
          >
            {dataset.dayKeys.map((d) => (
              <option key={d} value={d}>
                {d} ({dataset.byDay[d]?.length ?? 0} samples)
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Custom date range */}
      {selection.mode === 'custom-range' && (
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1 text-xs text-ink-muted">
            Start
            <input
              type="date"
              value={selection.customRange.start ?? ''}
              min={minDay}
              max={maxDay}
              onChange={(e) =>
                setCustomRange(e.target.value || null, selection.customRange.end)
              }
              className="rounded-md border border-panel-border bg-panel px-3 py-1.5 text-sm text-ink focus:border-accent focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-ink-muted">
            End
            <input
              type="date"
              value={selection.customRange.end ?? ''}
              min={minDay}
              max={maxDay}
              onChange={(e) =>
                setCustomRange(
                  selection.customRange.start,
                  e.target.value || null,
                )
              }
              className="rounded-md border border-panel-border bg-panel px-3 py-1.5 text-sm text-ink focus:border-accent focus:outline-none"
            />
          </label>
          <button
            type="button"
            className="btn"
            onClick={() => setCustomRange(minDay ?? null, maxDay ?? null)}
          >
            Full range
          </button>
        </div>
      )}
    </section>
  );
}
