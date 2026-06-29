/**
 * Global filter engine (Phase R2).
 *
 * Pure functions that derive filter facets from a dataset and apply an active
 * FilterState to a sample array. Filters compose on top of the analysis-mode
 * selection — they never re-parse the source CSV.
 */

import type {
  FilterOptions,
  FilterState,
  GapSample,
} from '@/types/gap';

export const EMPTY_FILTERS: FilterState = {
  dateRange: { start: null, end: null },
  sessions: [],
  syncStatuses: [],
  symbolPairs: [],
  gapMin: null,
  gapMax: null,
};

/** Canonical "SPOT/FUTURE" identity for a sample's symbol pair. */
export function symbolPairKey(sample: GapSample): string {
  return `${sample.spotSymbol || '?'}/${sample.futureSymbol || '?'}`;
}

/** True when at least one constraint is active. */
export function isFilterActive(filters: FilterState): boolean {
  return (
    filters.dateRange.start !== null ||
    filters.dateRange.end !== null ||
    filters.sessions.length > 0 ||
    filters.syncStatuses.length > 0 ||
    filters.symbolPairs.length > 0 ||
    filters.gapMin !== null ||
    filters.gapMax !== null
  );
}

/** Counts how many distinct constraints are active (for UI badges). */
export function activeFilterCount(filters: FilterState): number {
  let n = 0;
  if (filters.dateRange.start !== null || filters.dateRange.end !== null) n += 1;
  if (filters.sessions.length > 0) n += 1;
  if (filters.syncStatuses.length > 0) n += 1;
  if (filters.symbolPairs.length > 0) n += 1;
  if (filters.gapMin !== null || filters.gapMax !== null) n += 1;
  return n;
}

/** Applies the active filters to a sample array. */
export function applyFilters(
  samples: GapSample[],
  filters: FilterState,
): GapSample[] {
  const { dateRange, sessions, syncStatuses, symbolPairs, gapMin, gapMax } =
    filters;

  const sessionSet = sessions.length ? new Set(sessions) : null;
  const syncSet = syncStatuses.length ? new Set(syncStatuses) : null;
  const pairSet = symbolPairs.length ? new Set(symbolPairs) : null;

  return samples.filter((s) => {
    if (dateRange.start) {
      if (s.dayKey === 'unknown' || s.dayKey < dateRange.start) return false;
    }
    if (dateRange.end) {
      if (s.dayKey === 'unknown' || s.dayKey > dateRange.end) return false;
    }
    if (sessionSet && !sessionSet.has(s.currentSession)) return false;
    if (syncSet && !syncSet.has(s.syncStatus)) return false;
    if (pairSet && !pairSet.has(symbolPairKey(s))) return false;
    if (gapMin !== null && (s.gap === null || s.gap < gapMin)) return false;
    if (gapMax !== null && (s.gap === null || s.gap > gapMax)) return false;
    return true;
  });
}

/** Derives the facet options for filter controls from the full sample set. */
export function buildFilterOptions(samples: GapSample[]): FilterOptions {
  const sessions = new Set<string>();
  const syncStatuses = new Set<string>();
  const symbolPairs = new Set<string>();

  let gapMin = Number.POSITIVE_INFINITY;
  let gapMax = Number.NEGATIVE_INFINITY;
  let dayMin: string | null = null;
  let dayMax: string | null = null;

  for (const s of samples) {
    if (s.currentSession) sessions.add(s.currentSession);
    if (s.syncStatus) syncStatuses.add(s.syncStatus);
    symbolPairs.add(symbolPairKey(s));

    if (s.gap !== null && Number.isFinite(s.gap)) {
      if (s.gap < gapMin) gapMin = s.gap;
      if (s.gap > gapMax) gapMax = s.gap;
    }
    if (s.dayKey !== 'unknown') {
      if (dayMin === null || s.dayKey < dayMin) dayMin = s.dayKey;
      if (dayMax === null || s.dayKey > dayMax) dayMax = s.dayKey;
    }
  }

  return {
    sessions: [...sessions].sort(),
    syncStatuses: [...syncStatuses].sort(),
    symbolPairs: [...symbolPairs].sort(),
    gapBounds: {
      min: Number.isFinite(gapMin) ? gapMin : null,
      max: Number.isFinite(gapMax) ? gapMax : null,
    },
    dayBounds: { min: dayMin, max: dayMax },
  };
}
