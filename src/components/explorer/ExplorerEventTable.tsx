/**
 * Event explorer table (Phase R9). Sortable; click a row to replay the event.
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
import { wouldStopAt, type ExplorerEvent } from '@/utils/explorer';
import { fmtDuration, fmtInt, fmtNumber } from '@/utils/format';
import { isSynced } from '@/utils/statistics';
import { TableIcon } from '@/components/common/icons';

interface ExplorerEventTableProps {
  events: ExplorerEvent[];
  slLevel: number;
  selectedId: string | null;
  onSelect: (event: ExplorerEvent) => void;
}

function YesNo({ value, goodWhenTrue = true }: { value: boolean; goodWhenTrue?: boolean }) {
  const good = goodWhenTrue ? value : !value;
  return (
    <span className={good ? 'text-positive' : 'text-negative'}>
      {value ? 'Yes' : 'No'}
    </span>
  );
}

function SortIndicator({ dir }: { dir: false | 'asc' | 'desc' }) {
  return (
    <span className="ml-1 inline-block w-2 text-ink-faint">
      {dir === 'asc' ? '▲' : dir === 'desc' ? '▼' : ''}
    </span>
  );
}

export function ExplorerEventTable({
  events,
  slLevel,
  selectedId,
  onSelect,
}: ExplorerEventTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'startIndex', desc: false },
  ]);

  const columns = useMemo<ColumnDef<ExplorerEvent>[]>(
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
          <span className="text-accent">
            {fmtNumber(c.getValue() as number, 3)}
          </span>
        ),
      },
      {
        header: 'Recovered',
        accessorKey: 'recovered',
        cell: (c) => <YesNo value={c.getValue() as boolean} />,
      },
      {
        header: 'Rec. Target',
        accessorKey: 'recoveryTarget',
        cell: (c) => fmtNumber(c.getValue() as number | null, 2),
      },
      {
        header: 'Rec. Time',
        accessorKey: 'recoveryTimeSec',
        cell: (c) => fmtDuration(c.getValue() as number | null),
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
        id: 'stopAtSl',
        header: 'Stop @ SL?',
        accessorFn: (e) => wouldStopAt(e, slLevel),
        cell: (c) => (
          <YesNo value={c.getValue() as boolean} goodWhenTrue={false} />
        ),
      },
    ],
    [slLevel],
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
          Event Explorer
        </h2>
        <span className="ml-auto text-xs text-ink-faint">
          {fmtInt(events.length)} events · click a row to replay
        </span>
      </header>

      {events.length === 0 ? (
        <div className="p-6 text-center text-sm text-ink-muted">
          No events match the current filters.
        </div>
      ) : (
        <div className="max-h-[28rem] overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 z-10 bg-panel text-xs uppercase tracking-wide text-ink-faint">
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
