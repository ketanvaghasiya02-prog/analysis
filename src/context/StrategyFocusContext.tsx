/**
 * Strategy Focus context (Phase 11E).
 *
 * Carries the currently-selected strategy (by repository key) plus its ranking
 * context from the Strategy Ranking page to the read-only Strategy Dossier.
 * Pure navigation state — no calculation.
 */

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export interface StrategyFocus {
  key: string;
  rank: number | null;
  overall: number | null;
  modeLabel: string | null;
}

interface StrategyFocusContextValue {
  focus: StrategyFocus | null;
  setFocus: (focus: StrategyFocus) => void;
  clear: () => void;
}

const StrategyFocusContext = createContext<StrategyFocusContextValue | null>(null);

export function StrategyFocusProvider({ children }: { children: ReactNode }) {
  const [focus, setFocusState] = useState<StrategyFocus | null>(null);
  const setFocus = useCallback((f: StrategyFocus) => setFocusState(f), []);
  const clear = useCallback(() => setFocusState(null), []);
  const value = useMemo(() => ({ focus, setFocus, clear }), [focus, setFocus, clear]);
  return <StrategyFocusContext.Provider value={value}>{children}</StrategyFocusContext.Provider>;
}

export function useStrategyFocus(): StrategyFocusContextValue {
  const ctx = useContext(StrategyFocusContext);
  if (!ctx) throw new Error('useStrategyFocus must be used within a StrategyFocusProvider');
  return ctx;
}
