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
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  type AnalysisMode,
  type AnalysisSelection,
  type CombinedDataset,
  type GapSample,
} from '@/types/gap';
import { mergeDataset, parseFiles } from '@/utils/csvParser';
import {
  buildValidationReport,
  type ValidationReport,
} from '@/utils/validation';
import { selectSamples } from '@/utils/selection';

interface DataContextValue {
  dataset: CombinedDataset | null;
  validation: ValidationReport | null;
  selection: AnalysisSelection;
  activeSamples: GapSample[];
  isParsing: boolean;
  hasData: boolean;

  addFiles: (files: File[]) => Promise<void>;
  reset: () => void;

  setMode: (mode: AnalysisMode) => void;
  setSingleDay: (day: string) => void;
  setCustomRange: (start: string | null, end: string | null) => void;
}

const DEFAULT_SELECTION: AnalysisSelection = {
  mode: 'combined',
  singleDay: null,
  customRange: { start: null, end: null },
};

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [dataset, setDataset] = useState<CombinedDataset | null>(null);
  const [selection, setSelection] = useState<AnalysisSelection>(DEFAULT_SELECTION);
  const [isParsing, setIsParsing] = useState(false);

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
    setDataset(null);
    setSelection(DEFAULT_SELECTION);
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

  const value = useMemo<DataContextValue>(
    () => ({
      dataset,
      validation,
      selection,
      activeSamples,
      isParsing,
      hasData: !!dataset && dataset.samples.length > 0,
      addFiles,
      reset,
      setMode,
      setSingleDay,
      setCustomRange,
    }),
    [
      dataset,
      validation,
      selection,
      activeSamples,
      isParsing,
      addFiles,
      reset,
      setMode,
      setSingleDay,
      setCustomRange,
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
