/**
 * Research Lab event list table (additive). Click a row to draw its path.
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
  OUTCOME_LABELS,
  type ScenarioEvent,
  type ScenarioOutcome,
} from '@/utils/scenario';
import { fmtDuration, fmtInt, fmtNumber } from '@/utils/format';
import { isSynced } from '@/utils/statistics';
import { TableIcon } from '@/components/common/icons';

const OUTCOME_TONE: Record<ScenarioOutcome, string> = {
  RECOVERED_BEFORE_SL: 'text-positive',
  RECOVERED_AFTER_SL: 'text-warning',
  SL_NOT_RECOVERED: 'text-negative',
  DAY_END: 'text-ink-muted',
  DATASET_END: 'text-ink-muted',
  HOLDING_TIME_EXPIRED: 'text-ink-muted',
};

function SortIndicator({ dir }: { dir: false | 'asc' | 'desc' }) {
  return (
    <span className="ml-1 inline-block w-2 text-ink-faint">
      {dir === 'asc' ? '▲' : dir === 'desc' ? '▼' : ''}
    </span>
  );
}

export function ScenarioEventTable({
  events,
  selectedId,
  onSelect,
}: {
  events: ScenarioEvent[];
  selectedId: string | null;
  onSelect: (event: ScenarioEvent) => void;
}) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'startIndex', desc: false },
  ]);

  const columns = useMemo<ColumnDef<ScenarioEvent>[]>(
    () => [
      { header: 'Position ID', accessorKey: 'id' },
      { header: 'Entry Date', accessorKey: 'date' },
      { header: 'Entry Time', accessorKey: 'entryTime' },
      {
        header: 'Entry Gap',
        accessorKey: 'entryGap',
        cell: (c) => fmtNumber(c.getValue() as number, 3),
      },
      { header: 'Exit Time', accessorKey: 'exitTime' },
      {
        header: 'Exit Gap',
        accessorKey: 'exitGap',
        cell: (c) => fmtNumber(c.getValue() as number | null, 3),
      },
      {
        header: 'Max Gap After Entry',
        accessorKey: 'maxGap',
        cell: (c) => (
          <span className="text-negative">
            {fmtNumber(c.getValue() as number, 3)}
          </span>
        ),
      },
      {
        header: 'Min Gap After Entry',
        accessorKey: 'minGap',
        cell: (c) => (
          <span className="text-positive">
            {fmtNumber(c.getValue() as number, 3)}
          </span>
        ),
      },
      {
        header: 'SL Hit',
        accessorKey: 'slHit',
        cell: (c) => {
          const v = c.getValue() as boolean;
          return (
            <span className={v ? 'text-negative' : 'text-ink-faint'}>
              {v ? 'Yes' : 'No'}
            </span>
          );
        },
      },
      {
        header: 'SL Time',
        accessorKey: 'slHitTimeSec',
        cell: (c) => fmtDuration(c.getValue() as number | null),
      },
      {
        header: 'Recovery Hit',
        accessorKey: 'recoveryHit',
        cell: (c) => {
          const v = c.getValue() as boolean;
          return (
            <span className={v ? 'text-positive' : 'text-ink-faint'}>
              {v ? 'Yes' : 'No'}
            </span>
          );
        },
      },
      {
        header: 'Recovery Time',
        accessorKey: 'recoveryTimeSec',
        cell: (c) => fmtDuration(c.getValue() as number | null),
      },
      {
        header: 'Holding Time',
        accessorKey: 'durationSec',
        cell: (c) => fmtDuration(c.getValue() as number | null),
      },
      {
        header: 'Outcome',
        accessorKey: 'outcome',
        cell: (c) => {
          const o = c.getValue() as ScenarioOutcome;
          return <span className={OUTCOME_TONE[o]}>{OUTCOME_LABELS[o]}</span>;
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
          Position Table
        </h2>
        <span className="ml-auto text-xs text-ink-faint">
          {fmtInt(events.length)} positions · click a row to view its path
        </span>
      </header>

      {events.length === 0 ? (
        <div className="p-6 text-center text-sm text-ink-muted">
          No positions match this scenario.
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
                const selected = row.original.id === selectedId;
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
