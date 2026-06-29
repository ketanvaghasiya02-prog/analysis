/**
 * Top Trade Finder table (additive). Historical opportunities only — not signals.
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
import type { TopTradeOpportunity } from '@/utils/topTrades';
import { fmtDuration, fmtInt, fmtNumber } from '@/utils/format';
import { isSynced } from '@/utils/statistics';
import { TableIcon } from '@/components/common/icons';

function SortIndicator({ dir }: { dir: false | 'asc' | 'desc' }) {
  return (
    <span className="ml-1 inline-block w-2 text-ink-faint">
      {dir === 'asc' ? '▲' : dir === 'desc' ? '▼' : ''}
    </span>
  );
}

export function TopTradeTable({
  trades,
  selectedId,
  onSelect,
}: {
  trades: TopTradeOpportunity[];
  selectedId: string | null;
  onSelect: (t: TopTradeOpportunity) => void;
}) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'rank', desc: false },
  ]);

  const columns = useMemo<ColumnDef<TopTradeOpportunity>[]>(
    () => [
      { header: 'Rank', accessorKey: 'rank' },
      { header: 'Date', accessorKey: 'date' },
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
        cell: (c) => fmtNumber(c.getValue() as number, 3),
      },
      {
        header: 'Compression',
        accessorKey: 'compression',
        cell: (c) => (
          <span className="font-semibold text-positive">
            {fmtNumber(c.getValue() as number, 3)}
          </span>
        ),
      },
      {
        header: 'Max Adverse',
        accessorKey: 'maxAdverseGap',
        cell: (c) => fmtNumber(c.getValue() as number, 3),
      },
      {
        header: 'Adverse Exp.',
        accessorKey: 'adverseExpansion',
        cell: (c) => (
          <span className="text-negative">
            {fmtNumber(c.getValue() as number, 3)}
          </span>
        ),
      },
      {
        header: 'Holding',
        accessorKey: 'holdingSec',
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
        header: 'Score',
        accessorKey: 'score',
        cell: (c) => (
          <span className="font-semibold text-accent">
            {fmtNumber(c.getValue() as number, 2)}
          </span>
        ),
      },
    ],
    [],
  );

  const table = useReactTable({
    data: trades,
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
          Top Trades
        </h2>
        <span className="ml-auto text-xs text-ink-faint">
          {fmtInt(trades.length)} shown · click a row to replay
        </span>
      </header>

      {trades.length === 0 ? (
        <div className="p-6 text-center text-sm text-ink-muted">
          No valid historical opportunities for these inputs.
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
