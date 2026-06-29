/**
 * Comparison selection context (Phase 11G).
 *
 * Holds the set of repository keys the user has marked for side-by-side
 * comparison (2–5). Selection can be fed from Ranking, Strategy Details, the
 * Repository or the comparison page's own search. Pure selection state.
 */

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { MAX_COMPARE } from '@/utils/strategyComparison';

interface ComparisonContextValue {
  selected: string[];
  isSelected: (key: string) => boolean;
  toggle: (key: string) => void;
  add: (key: string) => void;
  remove: (key: string) => void;
  clear: () => void;
  full: boolean;
}

const ComparisonContext = createContext<ComparisonContextValue | null>(null);

export function ComparisonProvider({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<string[]>([]);

  const add = useCallback((key: string) => {
    setSelected((prev) => (prev.includes(key) || prev.length >= MAX_COMPARE ? prev : [...prev, key]));
  }, []);
  const remove = useCallback((key: string) => {
    setSelected((prev) => prev.filter((k) => k !== key));
  }, []);
  const toggle = useCallback((key: string) => {
    setSelected((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : prev.length >= MAX_COMPARE ? prev : [...prev, key],
    );
  }, []);
  const clear = useCallback(() => setSelected([]), []);

  const value = useMemo<ComparisonContextValue>(
    () => ({
      selected,
      isSelected: (key) => selected.includes(key),
      toggle,
      add,
      remove,
      clear,
      full: selected.length >= MAX_COMPARE,
    }),
    [selected, toggle, add, remove, clear],
  );

  return <ComparisonContext.Provider value={value}>{children}</ComparisonContext.Provider>;
}

export function useComparison(): ComparisonContextValue {
  const ctx = useContext(ComparisonContext);
  if (!ctx) throw new Error('useComparison must be used within a ComparisonProvider');
  return ctx;
}
