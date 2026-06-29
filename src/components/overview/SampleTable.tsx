/**
 * Paginated preview of the active sample set, built with TanStack Table.
 * Read-only — this is research data inspection, not order entry.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
  type ColumnDef,
  type PaginationState,
} from '@tanstack/react-table';
import { useData } from '@/context/DataContext';
import type { GapSample } from '@/types/gap';
import { fmtNumber } from '@/utils/format';
import { isSynced } from '@/utils/statistics';
import { TableIcon } from '@/components/common/icons';

const columns: ColumnDef<GapSample>[] = [
  { header: '#', accessorKey: 'sampleId', cell: (c) => <span className="text-ink-faint">{String(c.getValue())}</span> },
  { header: 'Server Time', accessorKey: 'serverTime' },
  { header: 'Spot', accessorKey: 'spotSymbol' },
  { header: 'Future', accessorKey: 'futureSymbol' },
  { header: 'Spot Mid', accessorKey: 'spotMid', cell: (c) => fmtNumber(c.getValue() as number | null, 3) },
  { header: 'Future Mid', accessorKey: 'futureMid', cell: (c) => fmtNumber(c.getValue() as number | null, 3) },
  {
    header: 'Gap',
    accessorKey: 'gap',
    cell: (c) => (
      <span className="font-semibold text-accent">
        {fmtNumber(c.getValue() as number | null, 3)}
      </span>
    ),
  },
  { header: 'Gap Mid', accessorKey: 'gapMid', cell: (c) => fmtNumber(c.getValue() as number | null, 3) },
  { header: 'Tick Δ (s)', accessorKey: 'tickAgeDifferenceSec', cell: (c) => fmtNumber(c.getValue() as number | null, 3) },
  {
    header: 'Sync',
    accessorKey: 'syncStatus',
    cell: (c) => {
      const v = String(c.getValue());
      return (
        <span
          className={[
            'rounded px-1.5 py-0.5 text-[11px] font-medium',
            isSynced(v)
              ? 'bg-positive/15 text-positive'
              : 'bg-warning/15 text-warning',
          ].join(' ')}
        >
          {v}
        </span>
      );
    },
  },
  { header: 'Session', accessorKey: 'currentSession' },
];

export function SampleTable() {
  const { filteredSamples } = useData();
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  });

  const data = useMemo(() => filteredSamples, [filteredSamples]);

  // Reset to the first page whenever the underlying set changes (mode/filters),
  // so a stale page index never lands the user on an empty page.
  useEffect(() => {
    setPagination((p) => (p.pageIndex === 0 ? p : { ...p, pageIndex: 0 }));
  }, [filteredSamples]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    state: { pagination },
    onPaginationChange: setPagination,
  });

  if (data.length === 0) {
    return (
      <section className="card p-6 text-center text-sm text-ink-muted">
        No samples in the current selection.
      </section>
    );
  }

  const { pageIndex, pageSize } = table.getState().pagination;
  const pageCount = table.getPageCount();

  return (
    <section className="card overflow-hidden">
      <header className="flex items-center justify-between border-b border-panel-border px-5 py-3">
        <div className="flex items-center gap-2">
          <TableIcon className="text-base text-accent" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink">
            Sample Inspector
          </h2>
        </div>
        <div className="flex items-center gap-2 text-xs text-ink-muted">
          <span>Rows per page</span>
          <select
            value={pageSize}
            onChange={(e) => table.setPageSize(Number(e.target.value))}
            className="rounded border border-panel-border bg-panel px-2 py-1 text-ink focus:border-accent focus:outline-none"
          >
            {[10, 25, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-panel text-xs uppercase tracking-wide text-ink-faint">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th key={h.id} className="whitespace-nowrap px-3 py-2 font-medium">
                    {h.isPlaceholder
                      ? null
                      : flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-panel-border font-mono text-xs">
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="hover:bg-panel/50">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="whitespace-nowrap px-3 py-1.5 text-ink-muted">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <footer className="flex items-center justify-between border-t border-panel-border px-5 py-2.5 text-xs text-ink-muted">
        <span>
          Showing {table.getRowModel().rows.length} of{' '}
          {data.length.toLocaleString()} samples
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn px-2 py-1"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Prev
          </button>
          <span className="font-mono">
            {pageIndex + 1} / {Math.max(1, pageCount)}
          </span>
          <button
            type="button"
            className="btn px-2 py-1"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </button>
        </div>
      </footer>
    </section>
  );
}
