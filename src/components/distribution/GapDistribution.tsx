/**
 * Gap distribution module container (Phase R3).
 *
 * Owns the bin-size setting and the selected-zone state, derives the gap zones
 * from the shared `filteredSamples`, and composes the histogram, selected-zone
 * panel and zone summary table so they stay in sync.
 */

import { useEffect, useMemo, useState } from 'react';
import { useData } from '@/context/DataContext';
import {
  buildGapZones,
  DEFAULT_BIN_SIZE,
  findZone,
} from '@/utils/histogram';
import { GapHistogram } from '@/components/distribution/GapHistogram';
import { SelectedZonePanel } from '@/components/distribution/SelectedZonePanel';
import { GapZoneTable } from '@/components/distribution/GapZoneTable';

const BIN_PRESETS = [0.1, 0.25, 0.5, 1, 2, 5];

export function GapDistribution() {
  const { filteredSamples } = useData();
  const [binSize, setBinSize] = useState(DEFAULT_BIN_SIZE);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const zones = useMemo(
    () => buildGapZones(filteredSamples, binSize),
    [filteredSamples, binSize],
  );

  // Drop a stale selection when the zone set changes (bin size / filters) and
  // the previously selected zone no longer exists.
  useEffect(() => {
    if (selectedId !== null && !findZone(zones, selectedId)) {
      setSelectedId(null);
    }
  }, [zones, selectedId]);

  const selectedZone = findZone(zones, selectedId);

  const toggleZone = (id: string) =>
    setSelectedId((cur) => (cur === id ? null : id));

  const updateBinSize = (value: number) => {
    if (Number.isFinite(value) && value > 0) {
      setBinSize(value);
      setSelectedId(null);
    }
  };

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
            value={binSize}
            onChange={(e) => updateBinSize(Number(e.target.value))}
            className="w-28 rounded-md border border-panel-border bg-panel px-3 py-1.5 text-sm text-ink focus:border-accent focus:outline-none"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {BIN_PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => updateBinSize(p)}
              className={[
                'btn px-2 py-1',
                binSize === p ? 'btn-active' : '',
              ].join(' ')}
            >
              {p}
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs text-ink-faint">
          {zones.length} zone{zones.length === 1 ? '' : 's'} across{' '}
          {filteredSamples.filter((s) => s.gap !== null).length.toLocaleString()}{' '}
          gap samples
        </span>
      </section>

      <GapHistogram
        zones={zones}
        selectedId={selectedId}
        onSelect={toggleZone}
      />
      <SelectedZonePanel zone={selectedZone} onClear={() => setSelectedId(null)} />
      <GapZoneTable
        zones={zones}
        selectedId={selectedId}
        onSelect={toggleZone}
      />
    </div>
  );
}
