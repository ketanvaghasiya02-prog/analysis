/**
 * Event Explorer page (Phase R9).
 *
 *  - Zone selector + stop-loss level control (with percentile presets)
 *  - Filters: recovered/failed, session, SL hit/not hit, max-adverse range,
 *    recovery-time range
 *  - Event table (row → replay)
 *  - Event replay chart for the selected event
 *
 * Derived from the shared events / zones / filteredSamples — no CSV is re-parsed.
 */

import { useEffect, useMemo, useState } from 'react';
import { useData } from '@/context/DataContext';
import {
  buildExplorerEvents,
  wouldStopAt,
  type ExplorerEvent,
} from '@/utils/explorer';
import { percentile } from '@/utils/statistics';
import { ExplorerEventTable } from '@/components/explorer/ExplorerEventTable';
import { ReplayChart } from '@/components/explorer/ReplayChart';
import { ChipMultiSelect } from '@/components/filters/ChipMultiSelect';
import { fmtInt, fmtNumber } from '@/utils/format';
import { LayersIcon } from '@/components/common/icons';

type RecoveryFilter = 'all' | 'recovered' | 'failed';
type SlFilter = 'all' | 'hit' | 'not-hit';

interface ExplorerFilters {
  recovery: RecoveryFilter;
  sessions: string[];
  slHit: SlFilter;
  maxGapMin: number | null;
  maxGapMax: number | null;
  recTimeMinMin: number | null; // recovery time, minutes
  recTimeMaxMin: number | null;
}

const EMPTY_FILTERS: ExplorerFilters = {
  recovery: 'all',
  sessions: [],
  slHit: 'all',
  maxGapMin: null,
  maxGapMax: null,
  recTimeMinMin: null,
  recTimeMaxMin: null,
};

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ id: T; label: string }>;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={['btn px-2 py-1', value === o.id ? 'btn-active' : ''].join(' ')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function ExplorerView() {
  const {
    filteredSamples,
    gapZones,
    events,
    selectedZoneId,
    selectedZone,
    toggleZone,
    selectZone,
  } = useData();

  const [slLevel, setSlLevel] = useState(0);
  const [filters, setFilters] = useState<ExplorerFilters>(EMPTY_FILTERS);
  const [replayEvent, setReplayEvent] = useState<ExplorerEvent | null>(null);

  // All explorer records for the selected zone.
  const zoneEvents = useMemo(() => {
    if (!selectedZone) return [];
    const evs = events.events.filter((e) => e.zoneId === selectedZone.id);
    return buildExplorerEvents(
      filteredSamples,
      evs,
      selectedZone.low,
      selectedZone.high,
    );
  }, [filteredSamples, events.events, selectedZone]);

  // SL percentile presets from recovered events' max gap.
  const slPresets = useMemo(() => {
    const recoveredMax = zoneEvents
      .filter((e) => e.recovered)
      .map((e) => e.maxGap);
    return {
      p90: percentile(recoveredMax, 90),
      p95: percentile(recoveredMax, 95),
      p99: percentile(recoveredMax, 99),
      worst: recoveredMax.length ? Math.max(...recoveredMax) : null,
    };
  }, [zoneEvents]);

  // Default the SL level to recovered-P95 when the zone changes.
  useEffect(() => {
    const fallback = selectedZone?.high ?? 0;
    setSlLevel(slPresets.p95 ?? fallback);
    setReplayEvent(null);
    setFilters(EMPTY_FILTERS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedZoneId]);

  const sessionOptions = useMemo(
    () => [...new Set(zoneEvents.map((e) => e.session))].sort(),
    [zoneEvents],
  );

  const filtered = useMemo(() => {
    return zoneEvents.filter((e) => {
      if (filters.recovery === 'recovered' && !e.recovered) return false;
      if (filters.recovery === 'failed' && e.recovered) return false;
      if (filters.sessions.length && !filters.sessions.includes(e.session))
        return false;

      const hit = wouldStopAt(e, slLevel);
      if (filters.slHit === 'hit' && !hit) return false;
      if (filters.slHit === 'not-hit' && hit) return false;

      if (filters.maxGapMin !== null && e.maxGap < filters.maxGapMin) return false;
      if (filters.maxGapMax !== null && e.maxGap > filters.maxGapMax) return false;

      if (filters.recTimeMinMin !== null || filters.recTimeMaxMin !== null) {
        if (e.recoveryTimeSec === null) return false;
        const mins = e.recoveryTimeSec / 60;
        if (filters.recTimeMinMin !== null && mins < filters.recTimeMinMin)
          return false;
        if (filters.recTimeMaxMin !== null && mins > filters.recTimeMaxMin)
          return false;
      }
      return true;
    });
  }, [zoneEvents, filters, slLevel]);

  const num = (v: string): number | null => (v === '' ? null : Number(v));

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
        {gapZones.length === 0 ? (
          <p className="text-sm text-ink-muted">
            No gap zones for the current selection.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {gapZones.map((z) => {
              const active = z.id === selectedZoneId;
              const count = events.countByZone[z.id] ?? 0;
              return (
                <button
                  key={z.id}
                  type="button"
                  onClick={() => toggleZone(z.id)}
                  className={[
                    'flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs transition-colors',
                    active
                      ? 'border-accent/70 bg-accent/10'
                      : 'border-panel-border bg-panel hover:border-accent/40',
                  ].join(' ')}
                >
                  <span className="font-mono text-ink">{z.label}</span>
                  <span className="font-mono text-ink-faint">{fmtInt(count)}</span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {selectedZone ? (
        <>
          {/* SL level + filters */}
          <section className="card space-y-4 p-4">
            <div className="flex flex-wrap items-end gap-5">
              <label className="flex flex-col gap-1">
                <span className="stat-label">Stop-Loss Level</span>
                <input
                  type="number"
                  step="any"
                  value={slLevel}
                  onChange={(e) => setSlLevel(Number(e.target.value))}
                  className="w-32 rounded-md border border-panel-border bg-panel px-3 py-1.5 text-sm text-ink focus:border-accent focus:outline-none"
                />
              </label>
              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    ['P90', slPresets.p90],
                    ['P95', slPresets.p95],
                    ['P99', slPresets.p99],
                    ['Worst', slPresets.worst],
                  ] as const
                ).map(([label, value]) =>
                  value !== null ? (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setSlLevel(value)}
                      className={[
                        'btn px-2 py-1',
                        Math.abs(slLevel - value) < 1e-9 ? 'btn-active' : '',
                      ].join(' ')}
                    >
                      {label} {fmtNumber(value, 2)}
                    </button>
                  ) : null,
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
              <div>
                <span className="stat-label mb-1.5 block">Recovery</span>
                <Segmented
                  value={filters.recovery}
                  onChange={(recovery) => setFilters((f) => ({ ...f, recovery }))}
                  options={[
                    { id: 'all', label: 'All' },
                    { id: 'recovered', label: 'Recovered' },
                    { id: 'failed', label: 'Failed' },
                  ]}
                />
              </div>
              <div>
                <span className="stat-label mb-1.5 block">Stop @ SL</span>
                <Segmented
                  value={filters.slHit}
                  onChange={(slHit) => setFilters((f) => ({ ...f, slHit }))}
                  options={[
                    { id: 'all', label: 'All' },
                    { id: 'hit', label: 'SL hit' },
                    { id: 'not-hit', label: 'Not hit' },
                  ]}
                />
              </div>
              <ChipMultiSelect
                label="Session"
                options={sessionOptions}
                selected={filters.sessions}
                onChange={(sessions) => setFilters((f) => ({ ...f, sessions }))}
              />
              <div>
                <span className="stat-label mb-1.5 block">Max Gap Range</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="any"
                    placeholder="min"
                    value={filters.maxGapMin ?? ''}
                    onChange={(e) =>
                      setFilters((f) => ({ ...f, maxGapMin: num(e.target.value) }))
                    }
                    className="w-full rounded-md border border-panel-border bg-panel px-2 py-1.5 text-sm text-ink focus:border-accent focus:outline-none"
                  />
                  <span className="text-ink-faint">–</span>
                  <input
                    type="number"
                    step="any"
                    placeholder="max"
                    value={filters.maxGapMax ?? ''}
                    onChange={(e) =>
                      setFilters((f) => ({ ...f, maxGapMax: num(e.target.value) }))
                    }
                    className="w-full rounded-md border border-panel-border bg-panel px-2 py-1.5 text-sm text-ink focus:border-accent focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <span className="stat-label mb-1.5 block">
                  Recovery Time (min)
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="any"
                    placeholder="min"
                    value={filters.recTimeMinMin ?? ''}
                    onChange={(e) =>
                      setFilters((f) => ({
                        ...f,
                        recTimeMinMin: num(e.target.value),
                      }))
                    }
                    className="w-full rounded-md border border-panel-border bg-panel px-2 py-1.5 text-sm text-ink focus:border-accent focus:outline-none"
                  />
                  <span className="text-ink-faint">–</span>
                  <input
                    type="number"
                    step="any"
                    placeholder="max"
                    value={filters.recTimeMaxMin ?? ''}
                    onChange={(e) =>
                      setFilters((f) => ({
                        ...f,
                        recTimeMaxMin: num(e.target.value),
                      }))
                    }
                    className="w-full rounded-md border border-panel-border bg-panel px-2 py-1.5 text-sm text-ink focus:border-accent focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => setFilters(EMPTY_FILTERS)}
                  className="btn px-3 py-1.5"
                >
                  Reset filters
                </button>
              </div>
            </div>
          </section>

          {replayEvent && (
            <ReplayChart
              samples={filteredSamples}
              event={replayEvent}
              slLevel={slLevel}
            />
          )}

          <ExplorerEventTable
            events={filtered}
            slLevel={slLevel}
            selectedId={replayEvent?.eventId ?? null}
            onSelect={setReplayEvent}
          />
        </>
      ) : (
        <section className="card flex items-center justify-center gap-2 p-8 text-center text-sm text-ink-muted">
          <LayersIcon className="text-base text-ink-faint" />
          Select a zone above to explore and replay its events.
        </section>
      )}
    </div>
  );
}
