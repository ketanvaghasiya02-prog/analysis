/**
 * Failed event table (Phase R8). Sortable; click a row to open its detail drawer.
 */

import { useMemo, useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import {
  POST_RECOVERY_LABELS,
  type FailedEvent,
  type PostFailureRecovery,
} from '@/utils/failed';
import { fmtInt, fmtNumber } from '@/utils/format';
import { TableIcon } from '@/components/common/icons';

interface FailedEventTableProps {
  events: FailedEvent[];
  selectedId: string | null;
  onSelect: (event: FailedEvent) => void;
}

const POST_TONE: Record<PostFailureRecovery, string> = {
  'same-day': 'text-positive',
  'next-day': 'text-positive',
  'within-2-days': 'text-warning',
  later: 'text-warning',
  never: 'text-negative',
};

function SortIndicator({ dir }: { dir: false | 'asc' | 'desc' }) {
  return (
    <span className="ml-1 inline-block w-2 text-ink-faint">
      {dir === 'asc' ? '▲' : dir === 'desc' ? '▼' : ''}
    </span>
  );
}

export function FailedEventTable({
  events,
  selectedId,
  onSelect,
}: FailedEventTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'maxGap', desc: true },
  ]);

  const columns = useMemo<ColumnDef<FailedEvent>[]>(
    () => [
      { header: 'Event ID', accessorKey: 'eventId' },
      { header: 'Date', accessorKey: 'date' },
      { header: 'Entry Time', accessorKey: 'entryTime' },
      {
        header: 'Entry Gap',
        accessorKey: 'entryGap',
        cell: (c) => fmtNumber(c.getValue() as number, 3),
      },
      {
        header: 'Max Gap',
        accessorKey: 'maxGap',
        cell: (c) => (
          <span className="font-semibold text-negative">
            {fmtNumber(c.getValue() as number, 3)}
          </span>
        ),
      },
      {
        header: 'Adverse Exp.',
        accessorKey: 'adverseExpansion',
        cell: (c) => fmtNumber(c.getValue() as number, 3),
      },
      { header: 'Session', accessorKey: 'session' },
      {
        header: 'Recovered After',
        accessorKey: 'postRecovery',
        cell: (c) => {
          const v = c.getValue() as PostFailureRecovery;
          return (
            <span className={POST_TONE[v]}>{POST_RECOVERY_LABELS[v]}</span>
          );
        },
      },
    ],
    [],
  );

  const table = useReactTable({
    data: events,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <section className="card overflow-hidden">
      <header className="flex items-center gap-2 border-b border-panel-border px-5 py-3">
        <TableIcon className="text-base text-accent" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink">
          Failed Events
        </h2>
        <span className="ml-auto text-xs text-ink-faint">
          {fmtInt(events.length)} failed · click a row for details
        </span>
      </header>

      {events.length === 0 ? (
        <div className="p-6 text-center text-sm text-ink-muted">
          No failed events for the selected zone — every event recovered to its
          zone low within its day.
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
                        onClick={
                          canSort ? h.column.getToggleSortingHandler() : undefined
                        }
                        className={[
                          'whitespace-nowrap px-3 py-2 font-medium',
                          canSort ? 'cursor-pointer select-none' : '',
                        ].join(' ')}
                      >
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        {canSort && <SortIndicator dir={h.column.getIsSorted()} />}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-panel-border font-mono text-xs">
              {table.getRowModel().rows.map((row) => {
                const selected = row.original.eventId === selectedId;
                return (
                  <tr
                    key={row.id}
                    onClick={() => onSelect(row.original)}
                    className={[
                      'cursor-pointer transition-colors',
                      selected
                        ? 'bg-accent/10 ring-1 ring-inset ring-accent/30'
                        : 'hover:bg-panel/50',
                    ].join(' ')}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className="whitespace-nowrap px-3 py-1.5 text-ink-muted"
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
