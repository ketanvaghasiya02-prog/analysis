/**
 * Research Repository context (Phase 11C).
 *
 * Holds the centralized, de-duplicated store of COMPLETED strategy results in
 * memory (a Map keyed by the stable strategy key). It is independent of the
 * dataset/analysis state so any current or future module can read research
 * results without rerunning the Research Engine.
 *
 * Storage only — no ranking, scoring or recommendations.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  toRepositoryRecord,
  type RepositoryIngestItem,
  type RepositoryRecord,
} from '@/utils/researchRepository';

interface RepositoryContextValue {
  records: RepositoryRecord[];
  createdAt: number | null;
  updatedAt: number | null;
  /** Stores COMPLETED results, de-duplicating by strategy key. */
  ingest: (items: RepositoryIngestItem[]) => void;
  clear: () => void;
}

const RepositoryContext = createContext<RepositoryContextValue | null>(null);

export function RepositoryProvider({ children }: { children: ReactNode }) {
  const storeRef = useRef<Map<string, RepositoryRecord>>(new Map());
  const [records, setRecords] = useState<RepositoryRecord[]>([]);
  const [createdAt, setCreatedAt] = useState<number | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  const ingest = useCallback((items: RepositoryIngestItem[]) => {
    if (items.length === 0) return;
    const store = storeRef.current;
    const now = Date.now();
    let changed = false;

    for (const item of items) {
      const candidate = toRepositoryRecord(item, now);
      const existing = store.get(candidate.key);
      if (!existing) {
        store.set(candidate.key, candidate);
        changed = true;
      } else if (existing.id !== candidate.id ||
        existing.recoveryBeforeSlPct !== candidate.recoveryBeforeSlPct ||
        existing.totalPositions !== candidate.totalPositions ||
        existing.executionMs !== candidate.executionMs) {
        // Update in place but preserve the original createdAt (no duplicates).
        store.set(candidate.key, { ...candidate, createdAt: existing.createdAt });
        changed = true;
      }
    }

    if (!changed) return;
    setCreatedAt((prev) => prev ?? now);
    setUpdatedAt(now);
    setRecords([...store.values()]);
  }, []);

  const clear = useCallback(() => {
    storeRef.current = new Map();
    setRecords([]);
    setCreatedAt(null);
    setUpdatedAt(null);
  }, []);

  const value = useMemo<RepositoryContextValue>(
    () => ({ records, createdAt, updatedAt, ingest, clear }),
    [records, createdAt, updatedAt, ingest, clear],
  );

  return <RepositoryContext.Provider value={value}>{children}</RepositoryContext.Provider>;
}

export function useRepository(): RepositoryContextValue {
  const ctx = useContext(RepositoryContext);
  if (!ctx) throw new Error('useRepository must be used within a RepositoryProvider');
  return ctx;
}
