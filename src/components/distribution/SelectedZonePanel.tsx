/**
 * Selected gap-zone detail panel (Phase R3).
 *
 * Shows the focused zone's range, sample count, percentage, first/last seen
 * time, and average / max / min gap within the zone.
 */

import type { GapZone } from '@/utils/histogram';
import { fmtInt, fmtNumber, fmtPercent } from '@/utils/format';
import { LayersIcon } from '@/components/common/icons';

interface SelectedZonePanelProps {
  zone: GapZone | null;
  onClear: () => void;
}

function Metric({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'accent' | 'positive' | 'negative';
}) {
  const toneClass =
    tone === 'accent'
      ? 'text-accent'
      : tone === 'positive'
        ? 'text-positive'
        : tone === 'negative'
          ? 'text-negative'
          : 'text-ink';
  return (
    <div className="rounded-md border border-panel-border bg-panel p-3">
      <div className="stat-label">{label}</div>
      <div className={['mt-1 font-mono text-lg font-semibold', toneClass].join(' ')}>
        {value}
      </div>
    </div>
  );
}

export function SelectedZonePanel({ zone, onClear }: SelectedZonePanelProps) {
  return (
    <section className="card p-5">
      <header className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LayersIcon className="text-base text-accent" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink">
            Selected Zone
          </h2>
        </div>
        {zone && (
          <button type="button" onClick={onClear} className="btn px-2 py-1">
            Clear
          </button>
        )}
      </header>

      {!zone ? (
        <p className="py-6 text-center text-sm text-ink-muted">
          Select a zone from the histogram or the table to inspect it.
        </p>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-baseline gap-2">
            <span className="font-mono text-xl font-semibold text-accent">
              {zone.label}
            </span>
            <span className="text-xs text-ink-faint">gap zone</span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label="Samples" value={fmtInt(zone.count)} />
            <Metric
              label="Percentage"
              value={fmtPercent(zone.percentage)}
              tone="accent"
            />
            <Metric label="Avg Gap" value={fmtNumber(zone.avgGap, 3)} />
            <Metric
              label="Max Gap"
              value={fmtNumber(zone.maxGap, 3)}
              tone="positive"
            />
            <Metric
              label="Min Gap"
              value={fmtNumber(zone.minGap, 3)}
              tone="negative"
            />
            <div className="rounded-md border border-panel-border bg-panel p-3">
              <div className="stat-label">First Seen</div>
              <div className="mt-1 font-mono text-sm text-ink">
                {zone.firstSeen ?? '—'}
              </div>
            </div>
            <div className="rounded-md border border-panel-border bg-panel p-3">
              <div className="stat-label">Last Seen</div>
              <div className="mt-1 font-mono text-sm text-ink">
                {zone.lastSeen ?? '—'}
              </div>
            </div>
            <div className="rounded-md border border-panel-border bg-panel p-3">
              <div className="stat-label">Sessions</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {zone.sessions.length === 0 ? (
                  <span className="text-sm text-ink-faint">—</span>
                ) : (
                  zone.sessions.map((s) => (
                    <span key={s} className="chip text-[11px]">
                      {s}
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
