/**
 * Universal Search — the official navigation/discovery layer of GRT.
 *
 * Instantly locates any indexed research object (stored Repository records) and
 * any registered module. It is a discovery tool only: it NEVER performs
 * calculations and NEVER modifies research — it queries the pre-built index and
 * provides Quick Open navigation.
 */

import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useData } from '@/context/DataContext';
import { useRepository } from '@/context/RepositoryContext';
import { useStrategyFocus } from '@/context/StrategyFocusContext';
import { buildSearchIndex } from '@/utils/searchRegistry';
import {
  MODULE_LABELS,
  parseQuery,
  runSearch,
  searchResultsCsv,
  searchResultsJson,
  type SearchEntity,
  type SearchModule,
} from '@/utils/searchEngine';
import { downloadExport } from '@/utils/reports';
import { EmptyState } from '@/components/common/EmptyState';
import {
  ChevronIcon,
  DownloadIcon,
  PinIcon,
  SearchIcon,
  TrashIcon,
} from '@/components/common/icons';

// --- search history persistence ----------------------------------------------

const RECENT_KEY = 'grt.search.recent.v1';
const PINNED_KEY = 'grt.search.pinned.v1';
const MAX_RECENT = 8;

function loadList(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}
function saveList(key: string, list: string[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch {
    /* ignore persistence errors */
  }
}

// --- presentation helpers -----------------------------------------------------

const MODULE_TONE: Record<SearchModule, string> = {
  repository: 'border-accent/40 bg-accent/10 text-accent',
  ranking: 'border-positive/40 bg-positive/10 text-positive',
  probability: 'border-accent/40 bg-accent/10 text-accent',
  opportunity: 'border-warning/40 bg-warning/10 text-warning',
  reliability: 'border-positive/40 bg-positive/10 text-positive',
  'walk-forward': 'border-warning/40 bg-warning/10 text-warning',
  replay: 'border-accent/40 bg-accent/10 text-accent',
  market: 'border-accent/40 bg-accent/10 text-accent',
  reports: 'border-ink-faint/30 bg-panel-raised text-ink-muted',
};

const EXAMPLES = [
  'recovery > 90',
  'events > 100',
  'sl < 30',
  'holding < 20',
  'worst expansion < 19.2',
  'session = London',
  'confidence = HIGH',
  'entry between 40 and 60',
];

function relativeTime(ms: number | null): string {
  if (ms == null) return '—';
  const diff = Date.now() - ms;
  const s = Math.round(diff / 1000);
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(ms).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const PER_GROUP_STEP = 25;

export function UniversalSearchView() {
  const { setView } = useData();
  const { records } = useRepository();
  const { setFocus } = useStrategyFocus();

  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const inputRef = useRef<HTMLInputElement>(null);

  const [recent, setRecent] = useState<string[]>(() => loadList(RECENT_KEY));
  const [pinned, setPinned] = useState<string[]>(() => loadList(PINNED_KEY));
  const [visible, setVisible] = useState<Record<string, number>>({});
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  useEffect(() => saveList(RECENT_KEY, recent), [recent]);
  useEffect(() => saveList(PINNED_KEY, pinned), [pinned]);

  // Index is memoized over the stored records — rebuilt only when they change.
  const index = useMemo(() => buildSearchIndex(records), [records]);
  const parsed = useMemo(() => parseQuery(deferredQuery), [deferredQuery]);
  const outcome = useMemo(() => runSearch(index, parsed), [index, parsed]);

  const commitRecent = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setRecent((prev) => [trimmed, ...prev.filter((p) => p !== trimmed)].slice(0, MAX_RECENT));
  };

  const togglePin = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setPinned((prev) => (prev.includes(trimmed) ? prev.filter((p) => p !== trimmed) : [trimmed, ...prev]));
  };

  const openEntity = (e: SearchEntity) => {
    commitRecent(query);
    if (e.focusKey && (e.view === 'strategy-details' || e.view === 'replay')) {
      setFocus({ key: e.focusKey, rank: null, overall: null, modeLabel: null, occurrenceIndex: e.occurrenceIndex ?? 0 });
    }
    setView(e.view);
  };

  const exportCsv = () => downloadExport(searchResultsCsv(outcome.results));
  const exportJson = () => downloadExport(searchResultsJson(outcome.results, query, new Date().toISOString()));

  const isPinned = pinned.includes(query.trim());
  const showMore = (module: string, max: number) =>
    setVisible((prev) => ({ ...prev, [module]: Math.min(max, (prev[module] ?? PER_GROUP_STEP) + PER_GROUP_STEP) }));

  return (
    <div className="space-y-5">
      {/* Header + disclaimer */}
      <section className="card flex flex-wrap items-start gap-3 border-accent/30 bg-accent/5 p-4">
        <SearchIcon className="mt-0.5 text-base text-accent" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-ink">Universal Search</p>
            <span className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
              Navigation Layer
            </span>
          </div>
          <p className="mt-1 text-sm leading-relaxed text-ink-muted">
            Instantly locate any stored research result or module. Search is a
            discovery tool only — it retrieves existing indexed data and never
            recalculates or modifies research.
          </p>
        </div>
      </section>

      {/* Search box */}
      <section className="card p-4">
        <div className="flex items-center gap-3 rounded-lg border border-panel-border bg-panel px-3 py-2 focus-within:border-accent">
          <SearchIcon className="shrink-0 text-base text-ink-faint" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRecent(query);
              if (e.key === 'Escape') setQuery('');
            }}
            placeholder="Search strategies and modules — e.g. recovery > 90, session = London, walk forward"
            className="min-w-0 flex-1 bg-transparent text-sm text-ink placeholder:text-ink-faint focus:outline-none"
          />
          {query && (
            <>
              <button
                type="button"
                onClick={() => togglePin(query)}
                title={isPinned ? 'Unpin search' : 'Pin search'}
                className={['shrink-0 transition-colors', isPinned ? 'text-accent' : 'text-ink-faint hover:text-accent'].join(' ')}
              >
                <PinIcon className="text-base" />
              </button>
              <button type="button" onClick={() => setQuery('')} className="shrink-0 text-xs text-ink-faint hover:text-ink">
                clear
              </button>
            </>
          )}
        </div>

        {/* Parsed conditions + errors */}
        {(parsed.conditions.length > 0 || parsed.errors.length > 0) && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {parsed.conditions.map((c, i) => (
              <span key={i} className="rounded-md border border-accent/30 bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent">
                {c.raw}
              </span>
            ))}
            {parsed.errors.map((err, i) => (
              <span key={`e${i}`} className="rounded-md border border-warning/40 bg-warning/10 px-2 py-0.5 text-[11px] font-medium text-warning">
                {err}
              </span>
            ))}
          </div>
        )}

        {/* Examples / auto-complete hints */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-ink-faint">Try:</span>
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setQuery(ex)}
              className="rounded-md border border-panel-border bg-panel px-2 py-0.5 text-[11px] text-ink-muted transition-colors hover:border-accent hover:text-accent"
            >
              {ex}
            </button>
          ))}
        </div>
      </section>

      {/* Search history */}
      {(recent.length > 0 || pinned.length > 0) && (
        <section className="card p-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="stat-label">Pinned Searches</span>
                {pinned.length > 0 && (
                  <button type="button" onClick={() => setPinned([])} className="text-[10px] text-ink-faint hover:text-negative">
                    clear
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {pinned.length === 0 ? (
                  <span className="text-xs text-ink-faint">Pin a search with the pin icon to keep it here.</span>
                ) : (
                  pinned.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setQuery(p)}
                      className="flex items-center gap-1 rounded-md border border-accent/30 bg-accent/10 px-2 py-0.5 text-[11px] text-accent transition-colors hover:bg-accent/20"
                    >
                      <PinIcon className="text-[10px]" /> {p}
                    </button>
                  ))
                )}
              </div>
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="stat-label">Recent Searches</span>
                {recent.length > 0 && (
                  <button type="button" onClick={() => setRecent([])} className="flex items-center gap-1 text-[10px] text-ink-faint hover:text-negative">
                    <TrashIcon className="text-[11px]" /> clear history
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {recent.length === 0 ? (
                  <span className="text-xs text-ink-faint">Your recent searches will appear here.</span>
                ) : (
                  recent.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setQuery(r)}
                      className="rounded-md border border-panel-border bg-panel px-2 py-0.5 text-[11px] text-ink-muted transition-colors hover:border-accent hover:text-accent"
                    >
                      {r}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Results */}
      {records.length === 0 ? (
        <EmptyState
          title="Empty research repository"
          description="No research results have been stored yet. Run the Historical Strategy Finder to populate the repository — then Universal Search can locate every result instantly. Modules remain searchable below."
        />
      ) : (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-sm font-semibold text-ink">
              {parsed.isEmpty ? 'All indexed objects' : 'Results'}
              <span className="ml-2 font-mono text-ink-faint">{outcome.total}</span>
            </h2>
            <span className="text-[11px] text-ink-faint">
              {records.length} stored {records.length === 1 ? 'record' : 'records'} · indexed search · no calculations performed
            </span>
            <div className="ml-auto flex gap-2">
              <button
                type="button"
                onClick={exportCsv}
                disabled={outcome.total === 0}
                className="flex items-center gap-1.5 rounded-md border border-panel-border bg-panel px-3 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
              >
                <DownloadIcon className="text-sm" /> CSV
              </button>
              <button
                type="button"
                onClick={exportJson}
                disabled={outcome.total === 0}
                className="flex items-center gap-1.5 rounded-md border border-panel-border bg-panel px-3 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
              >
                <DownloadIcon className="text-sm" /> JSON
              </button>
            </div>
          </div>

          {outcome.total === 0 ? (
            <div className="card p-8 text-center">
              <SearchIcon className="mx-auto mb-2 text-2xl text-ink-faint" />
              <p className="text-sm font-medium text-ink">No matches</p>
              <p className="mt-1 text-xs text-ink-muted">
                Nothing matched “{query}”. Try removing a filter, widening a range, or searching by keyword.
              </p>
            </div>
          ) : (
            outcome.grouped.map((group) => {
              const isCollapsed = collapsed[group.module] ?? false;
              const max = visible[group.module] ?? PER_GROUP_STEP;
              const shown = group.items.slice(0, max);
              return (
                <div key={group.module} className="card overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setCollapsed((prev) => ({ ...prev, [group.module]: !isCollapsed }))}
                    className="flex w-full items-center gap-2 border-b border-panel-border px-4 py-2.5 text-left"
                  >
                    <span className={['rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide', MODULE_TONE[group.module]].join(' ')}>
                      {MODULE_LABELS[group.module]}
                    </span>
                    <span className="font-mono text-xs text-ink-faint">{group.items.length}</span>
                    <ChevronIcon className={['ml-auto text-sm text-ink-faint transition-transform', isCollapsed ? '-rotate-90' : ''].join(' ')} />
                  </button>

                  {!isCollapsed && (
                    <div className="divide-y divide-panel-border">
                      {shown.map((e) => (
                        <div key={e.id} className="flex flex-col gap-2 px-4 py-3 transition-colors hover:bg-panel-raised/40 sm:flex-row sm:items-center">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="truncate text-sm font-semibold text-ink">{e.title}</span>
                              {e.kind === 'module' && (
                                <span className="rounded border border-panel-border px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-ink-faint">module</span>
                              )}
                            </div>
                            <p className="mt-0.5 truncate text-xs text-ink-muted">{e.summary}</p>
                            {e.keyStats.length > 0 && (
                              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                                {e.keyStats.map((s, i) => (
                                  <span key={i} className="text-[11px] text-ink-faint">
                                    {s.label}: <span className="font-mono text-ink-muted">{s.value}</span>
                                  </span>
                                ))}
                              </div>
                            )}
                            <div className="mt-1 flex flex-wrap gap-x-3 text-[10px] text-ink-faint">
                              <span>Window: {e.researchWindow}</span>
                              {e.lastGenerated != null && <span>Generated {relativeTime(e.lastGenerated)}</span>}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => openEntity(e)}
                            className="shrink-0 rounded-md border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent/20"
                          >
                            Open →
                          </button>
                        </div>
                      ))}
                      {group.items.length > shown.length && (
                        <button
                          type="button"
                          onClick={() => showMore(group.module, group.items.length)}
                          className="w-full px-4 py-2.5 text-center text-xs font-medium text-accent transition-colors hover:bg-panel-raised/40"
                        >
                          Show {Math.min(PER_GROUP_STEP, group.items.length - shown.length)} more
                          <span className="ml-1 text-ink-faint">({shown.length}/{group.items.length})</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </section>
      )}

      <p className="text-[11px] text-ink-faint">
        Universal Search is the official navigation layer of GRT. It only retrieves
        indexed results — it never changes research and never performs calculations.
      </p>
    </div>
  );
}
