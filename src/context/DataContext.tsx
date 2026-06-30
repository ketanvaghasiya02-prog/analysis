/**
 * Application-wide data store implemented with React Context.
 *
 * Holds the combined dataset, derived validation report and the active
 * analysis selection. Keeps file parsing off the render path.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  type AnalysisMode,
  type AnalysisSelection,
  type CombinedDataset,
  type FilterOptions,
  type FilterState,
  type GapSample,
} from '@/types/gap';
import { mergeDataset, parseFiles } from '@/utils/csvParser';
import {
  buildValidationReport,
  type ValidationReport,
} from '@/utils/validation';
import { selectSamples } from '@/utils/selection';
import {
  applyFilters,
  buildFilterOptions,
  EMPTY_FILTERS,
} from '@/utils/filters';
import {
  buildGapZones,
  findZone,
  type GapZone,
} from '@/utils/histogram';
import { detectZoneEvents, type EventDetectionResult } from '@/utils/events';
import {
  DEFAULT_RECOVERY_SETTINGS,
  type RecoverySettings,
} from '@/utils/recovery';
import {
  DEFAULT_SL_SETTINGS,
  type StopLossSettings,
} from '@/utils/stoploss';
import { loadSettings, saveSettings } from '@/utils/settings';

export type AppView =
  | 'overview'
  | 'events'
  | 'recovery'
  | 'mae'
  | 'stoploss'
  | 'failed'
  | 'explorer'
  | 'session'
  | 'lab'
  | 'sl-optimizer'
  | 'strategy-finder'
  | 'repository'
  | 'ranking'
  | 'strategy-details'
  | 'replay'
  | 'comparison'
  | 'gap-explorer'
  | 'gap-lifecycle'
  | 'gap-distribution'
  | 'gap-statistics'
  | 'settings';

interface DataContextValue {
  dataset: CombinedDataset | null;
  validation: ValidationReport | null;
  selection: AnalysisSelection;
  /** Samples after the analysis-mode selection only (pre-filters). */
  activeSamples: GapSample[];
  /** Samples after analysis mode AND global filters — the canonical view set. */
  filteredSamples: GapSample[];
  filters: FilterState;
  filterOptions: FilterOptions | null;
  isParsing: boolean;
  hasData: boolean;

  // Gap-zone state (shared by the distribution module and the events page).
  gapBinSize: number;
  gapZones: GapZone[];
  selectedZoneId: string | null;
  selectedZone: GapZone | null;
  events: EventDetectionResult;

  // Recovery analysis settings (Phase R5).
  recoverySettings: RecoverySettings;

  // Stop-loss research settings (Phase R7).
  slSettings: StopLossSettings;

  // Default session filter (Phase R12 setting).
  defaultSessions: string[];

  // Navigation.
  view: AppView;

  addFiles: (files: File[]) => Promise<void>;
  reset: () => void;

  setMode: (mode: AnalysisMode) => void;
  setSingleDay: (day: string) => void;
  setCustomRange: (start: string | null, end: string | null) => void;

  setFilters: (next: FilterState) => void;
  updateFilters: (patch: Partial<FilterState>) => void;
  resetFilters: () => void;

  setGapBinSize: (size: number) => void;
  selectZone: (id: string | null) => void;
  toggleZone: (id: string) => void;

  updateRecoverySettings: (patch: Partial<RecoverySettings>) => void;
  resetRecoverySettings: () => void;

  updateSlSettings: (patch: Partial<StopLossSettings>) => void;
  resetSlSettings: () => void;

  setDefaultSessions: (sessions: string[]) => void;

  setView: (view: AppView) => void;
}

const DEFAULT_SELECTION: AnalysisSelection = {
  mode: 'combined',
  singleDay: null,
  customRange: { start: null, end: null },
};

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  // Hydrate user-tunable settings from localStorage (once).
  const [persisted] = useState(loadSettings);

  const [dataset, setDataset] = useState<CombinedDataset | null>(null);
  const [selection, setSelection] = useState<AnalysisSelection>(DEFAULT_SELECTION);
  const [filters, setFiltersState] = useState<FilterState>(() => ({
    ...EMPTY_FILTERS,
    sessions: persisted.defaultSessions,
  }));
  const [isParsing, setIsParsing] = useState(false);
  const [gapBinSize, setGapBinSizeState] = useState(persisted.gapBinSize);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [recoverySettings, setRecoverySettings] = useState<RecoverySettings>(
    persisted.recoverySettings,
  );
  const [slSettings, setSlSettings] = useState<StopLossSettings>(() => ({
    ...DEFAULT_SL_SETTINGS,
    step: persisted.slStep,
  }));
  const [defaultSessions, setDefaultSessionsState] = useState<string[]>(
    persisted.defaultSessions,
  );
  const [view, setView] = useState<AppView>('overview');

  // Persist settings whenever a tunable value changes.
  useEffect(() => {
    saveSettings({
      gapBinSize,
      recoverySettings,
      slStep: slSettings.step,
      defaultSessions,
    });
  }, [gapBinSize, recoverySettings, slSettings.step, defaultSessions]);

  const setDefaultSessions = useCallback((sessions: string[]) => {
    setDefaultSessionsState(sessions);
    // Apply the new default to the live session filter immediately.
    setFiltersState((prev) => ({ ...prev, sessions }));
  }, []);

  const addFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      setIsParsing(true);
      try {
        const parsed = await parseFiles(files);
        setDataset((prev) => {
          // Merge with any previously loaded files, de-duplicating by name.
          const existing = prev?.files ?? [];
          const byName = new Map(existing.map((f) => [f.fileName, f]));
          for (const p of parsed) byName.set(p.fileName, p);
          return mergeDataset([...byName.values()]);
        });
        // Default the single-day picker to the first available day.
        setSelection((prev) => {
          if (prev.singleDay) return prev;
          return prev;
        });
      } finally {
        setIsParsing(false);
      }
    },
    [],
  );

  const reset = useCallback(() => {
    // Clears the loaded dataset and view state, but keeps the user's persisted
    // analysis settings (bin size, recovery/SL parameters, default sessions).
    setDataset(null);
    setSelection(DEFAULT_SELECTION);
    setFiltersState({ ...EMPTY_FILTERS, sessions: defaultSessions });
    setSelectedZoneId(null);
    setView('overview');
  }, [defaultSessions]);

  const updateSlSettings = useCallback((patch: Partial<StopLossSettings>) => {
    setSlSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const resetSlSettings = useCallback(() => {
    setSlSettings(DEFAULT_SL_SETTINGS);
  }, []);

  const updateRecoverySettings = useCallback(
    (patch: Partial<RecoverySettings>) => {
      setRecoverySettings((prev) => ({ ...prev, ...patch }));
    },
    [],
  );

  const resetRecoverySettings = useCallback(() => {
    setRecoverySettings(DEFAULT_RECOVERY_SETTINGS);
  }, []);

  const setGapBinSize = useCallback((size: number) => {
    if (Number.isFinite(size) && size > 0) {
      setGapBinSizeState(size);
      // Zone identities change with the bin size; drop any stale selection.
      setSelectedZoneId(null);
    }
  }, []);

  const selectZone = useCallback((id: string | null) => {
    setSelectedZoneId(id);
  }, []);

  const toggleZone = useCallback((id: string) => {
    setSelectedZoneId((cur) => (cur === id ? null : id));
  }, []);

  const setFilters = useCallback((next: FilterState) => {
    setFiltersState(next);
  }, []);

  const updateFilters = useCallback((patch: Partial<FilterState>) => {
    setFiltersState((prev) => ({ ...prev, ...patch }));
  }, []);

  const resetFilters = useCallback(() => {
    setFiltersState(EMPTY_FILTERS);
  }, []);

  const setMode = useCallback(
    (mode: AnalysisMode) => {
      setSelection((prev) => {
        const next: AnalysisSelection = { ...prev, mode };
        // When entering single-day mode without a day chosen, default to first.
        if (mode === 'single-day' && !next.singleDay && dataset) {
          next.singleDay = dataset.dayKeys[0] ?? null;
        }
        // When entering custom-range without bounds, default to full range.
        if (mode === 'custom-range' && dataset) {
          const realDays = dataset.dayKeys.filter((d) => d !== 'unknown');
          if (!next.customRange.start && !next.customRange.end) {
            next.customRange = {
              start: realDays[0] ?? null,
              end: realDays[realDays.length - 1] ?? null,
            };
          }
        }
        return next;
      });
    },
    [dataset],
  );

  const setSingleDay = useCallback((day: string) => {
    setSelection((prev) => ({ ...prev, singleDay: day }));
  }, []);

  const setCustomRange = useCallback(
    (start: string | null, end: string | null) => {
      setSelection((prev) => ({ ...prev, customRange: { start, end } }));
    },
    [],
  );

  const validation = useMemo(
    () => (dataset ? buildValidationReport(dataset) : null),
    [dataset],
  );

  const activeSamples = useMemo(
    () => (dataset ? selectSamples(dataset, selection) : []),
    [dataset, selection],
  );

  // Filter facets are derived from the full dataset so options stay stable
  // regardless of the active mode/filter narrowing.
  const filterOptions = useMemo(
    () => (dataset ? buildFilterOptions(dataset.samples) : null),
    [dataset],
  );

  // Canonical view set: analysis-mode selection refined by global filters.
  const filteredSamples = useMemo(
    () => applyFilters(activeSamples, filters),
    [activeSamples, filters],
  );

  // Gap zones and zone events are derived once here and shared by the
  // distribution module (Overview) and the Events page.
  const gapZones = useMemo(
    () => buildGapZones(filteredSamples, gapBinSize),
    [filteredSamples, gapBinSize],
  );

  const selectedZone = useMemo(
    () => findZone(gapZones, selectedZoneId),
    [gapZones, selectedZoneId],
  );

  const events = useMemo(
    () => detectZoneEvents(filteredSamples, gapZones),
    [filteredSamples, gapZones],
  );

  const value = useMemo<DataContextValue>(
    () => ({
      dataset,
      validation,
      selection,
      activeSamples,
      filteredSamples,
      filters,
      filterOptions,
      isParsing,
      hasData: !!dataset && dataset.samples.length > 0,
      gapBinSize,
      gapZones,
      selectedZoneId,
      selectedZone,
      events,
      recoverySettings,
      slSettings,
      defaultSessions,
      view,
      addFiles,
      reset,
      setMode,
      setSingleDay,
      setCustomRange,
      setFilters,
      updateFilters,
      resetFilters,
      setGapBinSize,
      selectZone,
      toggleZone,
      updateRecoverySettings,
      resetRecoverySettings,
      updateSlSettings,
      resetSlSettings,
      setDefaultSessions,
      setView,
    }),
    [
      dataset,
      validation,
      selection,
      activeSamples,
      filteredSamples,
      filters,
      filterOptions,
      isParsing,
      gapBinSize,
      gapZones,
      selectedZoneId,
      selectedZone,
      events,
      recoverySettings,
      slSettings,
      defaultSessions,
      view,
      addFiles,
      reset,
      setMode,
      setSingleDay,
      setCustomRange,
      setFilters,
      updateFilters,
      resetFilters,
      setGapBinSize,
      selectZone,
      toggleZone,
      updateRecoverySettings,
      resetRecoverySettings,
      updateSlSettings,
      resetSlSettings,
      setDefaultSessions,
    ],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

/** Hook to access the data store. Throws when used outside the provider. */
export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within a DataProvider');
  return ctx;
}
