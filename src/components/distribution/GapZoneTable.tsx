/**
 * Gap zone summary table (Phase R3).
 *
 * Columns: Zone low · Zone high · Sample count · % of total · First seen ·
 * Last seen · Avg gap · Sessions present. Sortable headers, a zone search box,
 * and click-to-select rows that stay highlighted in sync with the histogram.
 */

import { useMemo, useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import type { GapZone } from '@/utils/histogram';
import { fmtInt, fmtNumber, fmtPercent } from '@/utils/format';
import { TableIcon } from '@/components/common/icons';

interface GapZoneTableProps {
  zones: GapZone[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const DECIMALS = 3;

function SortIndicator({ dir }: { dir: false | 'asc' | 'desc' }) {
  return (
    <span className="ml-1 inline-block w-2 text-ink-faint">
      {dir === 'asc' ? '▲' : dir === 'desc' ? '▼' : ''}
    </span>
  );
}

export function GapZoneTable({ zones, selectedId, onSelect }: GapZoneTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'low', desc: false },
  ]);
  const [query, setQuery] = useState('');

  const columns = useMemo<ColumnDef<GapZone>[]>(
    () => [
      {
        header: 'Zone Low',
        accessorKey: 'low',
        cell: (c) => fmtNumber(c.getValue() as number, DECIMALS),
      },
      {
        header: 'Zone High',
        accessorKey: 'high',
        cell: (c) => fmtNumber(c.getValue() as number, DECIMALS),
      },
      {
        header: 'Samples',
        accessorKey: 'count',
        cell: (c) => fmtInt(c.getValue() as number),
      },
      {
        header: '% of Total',
        accessorKey: 'percentage',
        cell: (c) => fmtPercent(c.getValue() as number),
      },
      {
        header: 'First Seen',
        accessorKey: 'firstSeen',
        cell: (c) => (c.getValue() as string | null) ?? '—',
        enableSorting: false,
      },
      {
        header: 'Last Seen',
        accessorKey: 'lastSeen',
        cell: (c) => (c.getValue() as string | null) ?? '—',
        enableSorting: false,
      },
      {
        header: 'Avg Gap',
        accessorKey: 'avgGap',
        cell: (c) => fmtNumber(c.getValue() as number | null, DECIMALS),
      },
      {
        header: 'Sessions',
        accessorKey: 'sessions',
        enableSorting: false,
        cell: (c) => {
          const sessions = c.getValue() as string[];
          return sessions.length === 0 ? (
            <span className="text-ink-faint">—</span>
          ) : (
            <span className="flex flex-wrap gap-1">
              {sessions.map((s) => (
                <span key={s} className="chip text-[10px]">
                  {s}
                </span>
              ))}
            </span>
          );
        },
      },
    ],
    [],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return zones;
    return zones.filter(
      (z) =>
        z.label.toLowerCase().includes(q) ||
        z.sessions.some((s) => s.toLowerCase().includes(q)),
    );
  }, [zones, query]);

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <section className="card overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-panel-border px-5 py-3">
        <div className="flex items-center gap-2">
          <TableIcon className="text-base text-accent" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink">
            Gap Zone Summary
          </h2>
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search zone or session…"
          className="w-56 rounded-md border border-panel-border bg-panel px-3 py-1.5 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
        />
      </header>

      {zones.length === 0 ? (
        <div className="p-6 text-center text-sm text-ink-muted">
          No gap zones for the current selection.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-panel text-xs uppercase tracking-wide text-ink-faint">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((h) => {
                    const canSort = h.column.getCanSort();
                    return (
                      <th
                        key={h.id}
                        className={[
                          'whitespace-nowrap px-3 py-2 font-medium',
                          canSort ? 'cursor-pointer select-none' : '',
                        ].join(' ')}
                        onClick={
                          canSort
                            ? h.column.getToggleSortingHandler()
                            : undefined
                        }
                      >
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        {canSort && (
                          <SortIndicator dir={h.column.getIsSorted()} />
                        )}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-panel-border text-xs">
              {table.getRowModel().rows.map((row) => {
                const zone = row.original;
                const selected = zone.id === selectedId;
                return (
                  <tr
                    key={row.id}
                    onClick={() => onSelect(zone.id)}
                    className={[
                      'cursor-pointer font-mono transition-colors',
                      selected
                        ? 'bg-accent/10 ring-1 ring-inset ring-accent/40'
                        : 'hover:bg-panel/50',
                    ].join(' ')}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className="whitespace-nowrap px-3 py-1.5 text-ink-muted"
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-3 py-6 text-center text-ink-faint"
                  >
                    No zones match “{query}”.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
