/**
 * Events page (Phase R4).
 *
 * Detects zone-entry events across all gap zones and presents:
 *  - a zone selector with per-zone event counts (item 2 + selecting a zone
 *    scopes the list to that zone)
 *  - an event-quality summary
 *  - the event list table
 *
 * Reads the shared gap zones / events from the data store — no re-parsing.
 */

import { useMemo } from 'react';
import { useData } from '@/context/DataContext';
import { EventTable } from '@/components/events/EventTable';
import {
  EVENT_QUALITY_LABELS,
  type EventQuality,
} from '@/utils/events';
import { fmtInt } from '@/utils/format';
import { LayersIcon } from '@/components/common/icons';

const QUALITY_ORDER: EventQuality[] = [
  'valid',
  'invalid',
  'day-ended-before-recovery',
  'dataset-ended-before-recovery',
];

const QUALITY_TONE: Record<EventQuality, string> = {
  valid: 'text-positive',
  invalid: 'text-negative',
  'day-ended-before-recovery': 'text-warning',
  'dataset-ended-before-recovery': 'text-accent',
};

export function EventsView() {
  const {
    gapZones,
    events,
    selectedZoneId,
    selectedZone,
    toggleZone,
    selectZone,
    gapBinSize,
  } = useData();

  const { events: allEvents, countByZone, countByQuality } = events;

  // Scope the list to the selected zone, if any.
  const scopedEvents = useMemo(
    () =>
      selectedZoneId
        ? allEvents.filter((e) => e.zoneId === selectedZoneId)
        : allEvents,
    [allEvents, selectedZoneId],
  );

  const scopeLabel = selectedZone
    ? `Zone ${selectedZone.label}`
    : 'All zones';

  return (
    <div className="space-y-5">
      {/* Summary header */}
      <section className="card p-5">
        <header className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LayersIcon className="text-base text-accent" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink">
              Zone Event Detection
            </h2>
          </div>
          <span className="text-xs text-ink-faint">
            bin size {gapBinSize} · {gapZones.length} zones ·{' '}
            {fmtInt(allEvents.length)} total events
          </span>
        </header>

        {/* Quality summary */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {QUALITY_ORDER.map((q) => (
            <div
              key={q}
              className="rounded-md border border-panel-border bg-panel p-3"
            >
              <div className="stat-label">{EVENT_QUALITY_LABELS[q]}</div>
              <div
                className={[
                  'mt-1 font-mono text-xl font-semibold',
                  QUALITY_TONE[q],
                ].join(' ')}
              >
                {fmtInt(countByQuality[q])}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Zone selector with per-zone counts */}
      <section className="card p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="stat-label">Event Count per Zone</span>
          {selectedZoneId && (
            <button
              type="button"
              onClick={() => selectZone(null)}
              className="text-xs text-ink-faint transition-colors hover:text-accent"
            >
              show all zones
            </button>
          )}
        </div>

        {gapZones.length === 0 ? (
          <p className="text-sm text-ink-muted">
            No gap zones for the current selection.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => selectZone(null)}
              className={[
                'rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
                selectedZoneId === null
                  ? 'border-accent/70 bg-accent/10 text-accent'
                  : 'border-panel-border bg-panel text-ink-muted hover:border-accent/40 hover:text-ink',
              ].join(' ')}
            >
              All zones
              <span className="ml-1.5 font-mono text-ink-faint">
                {fmtInt(allEvents.length)}
              </span>
            </button>
            {gapZones.map((z) => {
              const active = z.id === selectedZoneId;
              return (
                <button
                  key={z.id}
                  type="button"
                  onClick={() => toggleZone(z.id)}
                  className={[
                    'rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
                    active
                      ? 'border-accent/70 bg-accent/10 text-accent'
                      : 'border-panel-border bg-panel text-ink-muted hover:border-accent/40 hover:text-ink',
                  ].join(' ')}
                >
                  <span className="font-mono">{z.label}</span>
                  <span className="ml-1.5 font-mono text-ink-faint">
                    {fmtInt(countByZone[z.id] ?? 0)}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <EventTable events={scopedEvents} scopeLabel={scopeLabel} />
    </div>
  );
}
