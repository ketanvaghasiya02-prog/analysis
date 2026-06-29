/**
 * Gap distribution module container (Phase R3 + R4).
 *
 * Bin-size and selected-zone state now live in the data store so the Events
 * page can share them. This container composes the histogram, selected-zone
 * panel and zone summary table over the shared `gapZones`.
 */

import { useData } from '@/context/DataContext';
import { GapHistogram } from '@/components/distribution/GapHistogram';
import { SelectedZonePanel } from '@/components/distribution/SelectedZonePanel';
import { GapZoneTable } from '@/components/distribution/GapZoneTable';

const BIN_PRESETS = [0.1, 0.25, 0.5, 1, 2, 5];

export function GapDistribution() {
  const {
    filteredSamples,
    gapBinSize,
    setGapBinSize,
    gapZones,
    selectedZoneId,
    selectedZone,
    toggleZone,
    selectZone,
    events,
  } = useData();

  const gapSampleCount = filteredSamples.filter((s) => s.gap !== null).length;

  return (
    <div className="space-y-5">
      {/* Bin settings */}
      <section className="card flex flex-wrap items-center gap-x-6 gap-y-3 p-4">
        <div className="flex items-center gap-3">
          <span className="stat-label">Gap Bin Size</span>
          <input
            type="number"
            min={0.01}
            step="any"
            value={gapBinSize}
            onChange={(e) => setGapBinSize(Number(e.target.value))}
            className="w-28 rounded-md border border-panel-border bg-panel px-3 py-1.5 text-sm text-ink focus:border-accent focus:outline-none"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {BIN_PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setGapBinSize(p)}
              className={[
                'btn px-2 py-1',
                gapBinSize === p ? 'btn-active' : '',
              ].join(' ')}
            >
              {p}
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs text-ink-faint">
          {gapZones.length} zone{gapZones.length === 1 ? '' : 's'} ·{' '}
          {events.events.length.toLocaleString()} events across{' '}
          {gapSampleCount.toLocaleString()} gap samples
        </span>
      </section>

      <GapHistogram
        zones={gapZones}
        selectedId={selectedZoneId}
        onSelect={toggleZone}
      />
      <SelectedZonePanel zone={selectedZone} onClear={() => selectZone(null)} />
      <GapZoneTable
        zones={gapZones}
        selectedId={selectedZoneId}
        onSelect={toggleZone}
        eventCounts={events.countByZone}
      />
    </div>
  );
}
