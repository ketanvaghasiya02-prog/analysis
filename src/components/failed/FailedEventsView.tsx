/**
 * Failed Events page (Phase R8).
 *
 *  - Zone selector
 *  - Failed summary (count, %, max-gap distribution stats, post-failure recovery)
 *  - Failed event table (row → details drawer)
 *  - Failed max-gap distribution chart + failed-by-session chart
 *
 * Derived from the shared events / zones / filteredSamples — no CSV is re-parsed.
 */

import { useMemo, useState } from 'react';
import { useData } from '@/context/DataContext';
import {
  buildFailedAnalysis,
  POST_RECOVERY_LABELS,
  POST_RECOVERY_ORDER,
  type FailedEvent,
  type FailedZoneAnalysis,
} from '@/utils/failed';
import { FailedEventTable } from '@/components/failed/FailedEventTable';
import { FailedMaxGapChart } from '@/components/failed/FailedMaxGapChart';
import { FailedBySessionChart } from '@/components/failed/FailedBySessionChart';
import { FailedEventDrawer } from '@/components/failed/FailedEventDrawer';
import { fmtInt, fmtNumber, fmtPercent } from '@/utils/format';
import { LayersIcon } from '@/components/common/icons';

function Stat({
  label,
  value,
  tone = 'text-ink',
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="card p-4">
      <div className="stat-label">{label}</div>
      <div className={['stat-value mt-1', tone].join(' ')}>{value}</div>
    </div>
  );
}

export function FailedEventsView() {
  const {
    filteredSamples,
    gapZones,
    events,
    selectedZoneId,
    toggleZone,
    selectZone,
  } = useData();

  const [drawerEvent, setDrawerEvent] = useState<FailedEvent | null>(null);

  const analysis = useMemo(
    () => buildFailedAnalysis(filteredSamples, gapZones, events.events),
    [filteredSamples, gapZones, events.events],
  );

  const selected: FailedZoneAnalysis | undefined = useMemo(
    () => analysis.zones.find((z) => z.zoneId === selectedZoneId),
    [analysis.zones, selectedZoneId],
  );

  return (
    <div className="space-y-5">
      {/* Zone selector */}
      <section className="card p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="stat-label">Select Zone</span>
          {selectedZoneId && (
            <button
              type="button"
              onClick={() => selectZone(null)}
              className="text-xs text-ink-faint transition-colors hover:text-accent"
            >
              clear
            </button>
          )}
        </div>
        {analysis.zones.length === 0 ? (
          <p className="text-sm text-ink-muted">
            No gap zones for the current selection.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {analysis.zones.map((z) => {
              const active = z.zoneId === selectedZoneId;
              return (
                <button
                  key={z.zoneId}
                  type="button"
                  onClick={() => toggleZone(z.zoneId)}
                  className={[
                    'flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs transition-colors',
                    active
                      ? 'border-accent/70 bg-accent/10'
                      : 'border-panel-border bg-panel hover:border-accent/40',
                  ].join(' ')}
                  title={`${fmtInt(z.totalEvents)} events`}
                >
                  <span className="font-mono text-ink">{z.label}</span>
                  <span className="font-mono text-negative">
                    {fmtInt(z.failedCount)}
                  </span>
                  <span className="text-ink-faint">failed</span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {selected ? (
        <>
          {/* Summary */}
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            <Stat label="Total Events" value={fmtInt(selected.totalEvents)} />
            <Stat
              label="Failed Events"
              value={fmtInt(selected.failedCount)}
              tone="text-negative"
            />
            <Stat
              label="Failed %"
              value={fmtPercent(selected.failedPct)}
              tone="text-warning"
            />
            <Stat
              label="Avg Max Gap"
              value={fmtNumber(selected.maxGapStats.avg, 3)}
            />
            <Stat
              label="P95 Max Gap"
              value={fmtNumber(selected.maxGapStats.p95, 3)}
            />
            <Stat
              label="Worst Failed Gap"
              value={fmtNumber(selected.maxGapStats.worst, 3)}
              tone="text-negative"
            />
          </section>

          {/* Max gap percentiles + post-failure recovery */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <section className="card p-5">
              <h2 className="stat-label mb-3">Failed Max Gap Percentiles</h2>
              <div className="grid grid-cols-3 gap-3 font-mono text-sm">
                {(
                  [
                    ['Median', selected.maxGapStats.median],
                    ['P90', selected.maxGapStats.p90],
                    ['P95', selected.maxGapStats.p95],
                    ['P99', selected.maxGapStats.p99],
                    ['Worst', selected.maxGapStats.worst],
                    ['Average', selected.maxGapStats.avg],
                  ] as const
                ).map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-md border border-panel-border bg-panel p-3"
                  >
                    <div className="stat-label">{label}</div>
                    <div className="mt-1 text-ink">{fmtNumber(value, 3)}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="card p-5">
              <h2 className="stat-label mb-3">Recovery After Failure</h2>
              <div className="space-y-2">
                {POST_RECOVERY_ORDER.map((bucket) => {
                  const count = selected.postRecoveryCounts[bucket];
                  const pct =
                    selected.failedCount > 0
                      ? (count / selected.failedCount) * 100
                      : 0;
                  return (
                    <div key={bucket}>
                      <div className="mb-0.5 flex items-center justify-between text-xs">
                        <span className="text-ink-muted">
                          {POST_RECOVERY_LABELS[bucket]}
                        </span>
                        <span className="font-mono text-ink">
                          {fmtInt(count)} · {fmtPercent(pct)}
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-panel">
                        <div
                          className={[
                            'h-full rounded-full',
                            bucket === 'never'
                              ? 'bg-negative'
                              : bucket === 'within-2-days' || bucket === 'later'
                                ? 'bg-warning'
                                : 'bg-positive',
                          ].join(' ')}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <FailedMaxGapChart events={selected.events} />
            <FailedBySessionChart bySession={selected.bySession} />
          </div>

          {/* Table */}
          <FailedEventTable
            events={selected.events}
            selectedId={drawerEvent?.eventId ?? null}
            onSelect={setDrawerEvent}
          />
        </>
      ) : (
        <section className="card flex items-center justify-center gap-2 p-8 text-center text-sm text-ink-muted">
          <LayersIcon className="text-base text-ink-faint" />
          Select a zone above to analyse its failed events.
        </section>
      )}

      <FailedEventDrawer
        event={drawerEvent}
        zoneLabel={selected?.label ?? ''}
        onClose={() => setDrawerEvent(null)}
      />
    </div>
  );
}
