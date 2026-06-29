/**
 * Zone event list table (Phase R4).
 *
 * Columns: Event ID · Date · Entry time · Entry gap · Zone · Session ·
 * SyncStatus · Start index · Day boundary index · Quality.
 * Sortable headers (TanStack) with an optional quality filter.
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
import type { ZoneEvent } from '@/utils/events';
import { fmtInt, fmtNumber } from '@/utils/format';
import { isSynced } from '@/utils/statistics';
import { EventQualityBadge } from '@/components/events/EventQualityBadge';
import { TableIcon } from '@/components/common/icons';

interface EventTableProps {
  events: ZoneEvent[];
  /** Caption describing the active zone scope. */
  scopeLabel: string;
}

function SortIndicator({ dir }: { dir: false | 'asc' | 'desc' }) {
  return (
    <span className="ml-1 inline-block w-2 text-ink-faint">
      {dir === 'asc' ? '▲' : dir === 'desc' ? '▼' : ''}
    </span>
  );
}

export function EventTable({ events, scopeLabel }: EventTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'startIndex', desc: false },
  ]);

  const columns = useMemo<ColumnDef<ZoneEvent>[]>(
    () => [
      {
        header: 'Event ID',
        accessorKey: 'id',
        cell: (c) => <span className="text-ink">{String(c.getValue())}</span>,
      },
      { header: 'Date', accessorKey: 'date' },
      { header: 'Entry Time', accessorKey: 'entryTime' },
      {
        header: 'Entry Gap',
        accessorKey: 'entryGap',
        cell: (c) => (
          <span className="text-accent">
            {fmtNumber(c.getValue() as number, 3)}
          </span>
        ),
      },
      {
        id: 'zone',
        header: 'Zone',
        accessorFn: (e) => e.zoneLow,
        cell: (c) => {
          const e = c.row.original;
          return `${fmtNumber(e.zoneLow, 2)} – ${fmtNumber(e.zoneHigh, 2)}`;
        },
      },
      { header: 'Session', accessorKey: 'session' },
      {
        header: 'Sync',
        accessorKey: 'syncStatus',
        cell: (c) => {
          const v = String(c.getValue());
          return (
            <span className={isSynced(v) ? 'text-positive' : 'text-warning'}>
              {v}
            </span>
          );
        },
      },
      {
        header: 'Start Idx',
        accessorKey: 'startIndex',
        cell: (c) => fmtInt(c.getValue() as number),
      },
      {
        header: 'Day Bound Idx',
        accessorKey: 'dayBoundaryIndex',
        cell: (c) => fmtInt(c.getValue() as number),
      },
      {
        header: 'Quality',
        accessorKey: 'quality',
        cell: (c) => <EventQualityBadge quality={c.row.original.quality} />,
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
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-panel-border px-5 py-3">
        <div className="flex items-center gap-2">
          <TableIcon className="text-base text-accent" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink">
            Event List
          </h2>
        </div>
        <span className="text-xs text-ink-faint">
          {scopeLabel} · {fmtInt(events.length)} event
          {events.length === 1 ? '' : 's'}
        </span>
      </header>

      {events.length === 0 ? (
        <div className="p-6 text-center text-sm text-ink-muted">
          No events for the current zone selection.
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
                        {canSort && (
                          <SortIndicator dir={h.column.getIsSorted()} />
                        )}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-panel-border font-mono text-xs">
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="hover:bg-panel/50">
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="whitespace-nowrap px-3 py-1.5 text-ink-muted"
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
