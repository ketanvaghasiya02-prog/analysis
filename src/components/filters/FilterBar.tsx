/**
 * Global filter bar (Phase R2).
 *
 * Date range · Session · SyncStatus · Symbol pair · Gap min/max.
 * Writes through to the data store; every chart and table reads the resulting
 * `filteredSamples`, so the whole dashboard updates in lock-step.
 */

import { useMemo } from 'react';
import { useData } from '@/context/DataContext';
import { ChipMultiSelect } from '@/components/filters/ChipMultiSelect';
import { activeFilterCount } from '@/utils/filters';
import { fmtInt, fmtNumber } from '@/utils/format';
import { sessionCounts, syncStatusCounts } from '@/utils/statistics';
import { symbolPairKey } from '@/utils/filters';
import { AlertIcon } from '@/components/common/icons';

export function FilterBar() {
  const {
    dataset,
    filters,
    filterOptions,
    updateFilters,
    resetFilters,
    activeSamples,
    filteredSamples,
  } = useData();

  // Facet counts reflect the current mode's base set (pre-filter) so the user
  // can see how many samples each option would match.
  const facetCounts = useMemo(() => {
    const pairCounts: Record<string, number> = {};
    for (const s of activeSamples) {
      const k = symbolPairKey(s);
      pairCounts[k] = (pairCounts[k] ?? 0) + 1;
    }
    return {
      sessions: sessionCounts(activeSamples),
      sync: syncStatusCounts(activeSamples),
      pairs: pairCounts,
    };
  }, [activeSamples]);

  if (!dataset || !filterOptions) return null;

  const count = activeFilterCount(filters);
  const { dayBounds, gapBounds } = filterOptions;

  return (
    <section className="card p-4">
      <header className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="stat-label">Global Filters</span>
          {count > 0 && (
            <span className="chip border-accent/50 text-accent">
              {count} active
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-ink-muted">
          <span>
            <span className="font-mono text-ink">
              {fmtInt(filteredSamples.length)}
            </span>{' '}
            / {fmtInt(activeSamples.length)} samples
          </span>
          <button
            type="button"
            onClick={resetFilters}
            disabled={count === 0}
            className="btn px-2 py-1"
          >
            Reset
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {/* Date range */}
        <div>
          <span className="stat-label mb-1.5 block">Date Range</span>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={filters.dateRange.start ?? ''}
              min={dayBounds.min ?? undefined}
              max={dayBounds.max ?? undefined}
              onChange={(e) =>
                updateFilters({
                  dateRange: {
                    ...filters.dateRange,
                    start: e.target.value || null,
                  },
                })
              }
              className="w-full rounded-md border border-panel-border bg-panel px-2 py-1.5 text-sm text-ink focus:border-accent focus:outline-none"
            />
            <span className="text-ink-faint">→</span>
            <input
              type="date"
              value={filters.dateRange.end ?? ''}
              min={dayBounds.min ?? undefined}
              max={dayBounds.max ?? undefined}
              onChange={(e) =>
                updateFilters({
                  dateRange: {
                    ...filters.dateRange,
                    end: e.target.value || null,
                  },
                })
              }
              className="w-full rounded-md border border-panel-border bg-panel px-2 py-1.5 text-sm text-ink focus:border-accent focus:outline-none"
            />
          </div>
        </div>

        {/* Gap min/max */}
        <div>
          <span className="stat-label mb-1.5 block">
            Gap Range
            {gapBounds.min !== null && gapBounds.max !== null && (
              <span className="ml-2 font-normal normal-case text-ink-faint">
                data: {fmtNumber(gapBounds.min, 3)} … {fmtNumber(gapBounds.max, 3)}
              </span>
            )}
          </span>
          <div className="flex items-center gap-2">
            <input
              type="number"
              step="any"
              placeholder="min"
              value={filters.gapMin ?? ''}
              onChange={(e) =>
                updateFilters({
                  gapMin: e.target.value === '' ? null : Number(e.target.value),
                })
              }
              className="w-full rounded-md border border-panel-border bg-panel px-2 py-1.5 text-sm text-ink focus:border-accent focus:outline-none"
            />
            <span className="text-ink-faint">–</span>
            <input
              type="number"
              step="any"
              placeholder="max"
              value={filters.gapMax ?? ''}
              onChange={(e) =>
                updateFilters({
                  gapMax: e.target.value === '' ? null : Number(e.target.value),
                })
              }
              className="w-full rounded-md border border-panel-border bg-panel px-2 py-1.5 text-sm text-ink focus:border-accent focus:outline-none"
            />
          </div>
        </div>

        {/* Symbol pair */}
        <ChipMultiSelect
          label="Symbol Pair"
          options={filterOptions.symbolPairs}
          selected={filters.symbolPairs}
          onChange={(symbolPairs) => updateFilters({ symbolPairs })}
          counts={facetCounts.pairs}
        />

        {/* Session */}
        <ChipMultiSelect
          label="Session"
          options={filterOptions.sessions}
          selected={filters.sessions}
          onChange={(sessions) => updateFilters({ sessions })}
          counts={facetCounts.sessions}
        />

        {/* SyncStatus */}
        <ChipMultiSelect
          label="Sync Status"
          options={filterOptions.syncStatuses}
          selected={filters.syncStatuses}
          onChange={(syncStatuses) => updateFilters({ syncStatuses })}
          counts={facetCounts.sync}
        />
      </div>

      {filteredSamples.length === 0 && activeSamples.length > 0 && (
        <div className="mt-3 flex items-center gap-2 rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning">
          <AlertIcon className="text-sm" />
          No samples match the current filters. Adjust or reset to see data.
        </div>
      )}
    </section>
  );
}
