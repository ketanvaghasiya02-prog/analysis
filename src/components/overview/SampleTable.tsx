/**
 * Virtualized sample inspector (Phase R1 + R12).
 *
 * Read-only preview of the active sample set. Rows are windowed (only the
 * visible slice is rendered) so the table stays responsive even when many CSV
 * files are merged into tens of thousands of rows. Not order entry.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table';
import { useData } from '@/context/DataContext';
import type { GapSample } from '@/types/gap';
import { fmtInt, fmtNumber } from '@/utils/format';
import { isSynced } from '@/utils/statistics';
import { TableIcon } from '@/components/common/icons';

const ROW_HEIGHT = 30;
const VIEWPORT_HEIGHT = 480;
const OVERSCAN = 10;
const COL_COUNT = 11;

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
            isSynced(v) ? 'bg-positive/15 text-positive' : 'bg-warning/15 text-warning',
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
  const data = useMemo(() => filteredSamples, [filteredSamples]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const rafRef = useRef<number | null>(null);

  // Reset scroll position when the underlying set changes (mode/filters).
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    setScrollTop(0);
  }, [filteredSamples]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const rows = table.getRowModel().rows;
  const total = rows.length;

  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const visibleCount =
    Math.ceil(VIEWPORT_HEIGHT / ROW_HEIGHT) + OVERSCAN * 2;
  const endIndex = Math.min(total, startIndex + visibleCount);
  const paddingTop = startIndex * ROW_HEIGHT;
  const paddingBottom = (total - endIndex) * ROW_HEIGHT;
  const visibleRows = rows.slice(startIndex, endIndex);

  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const top = e.currentTarget.scrollTop;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => setScrollTop(top));
  };

  if (data.length === 0) {
    return (
      <section className="card p-6 text-center text-sm text-ink-muted">
        No samples in the current selection.
      </section>
    );
  }

  return (
    <section className="card overflow-hidden">
      <header className="flex items-center justify-between border-b border-panel-border px-5 py-3">
        <div className="flex items-center gap-2">
          <TableIcon className="text-base text-accent" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink">
            Sample Inspector
          </h2>
        </div>
        <span className="text-xs text-ink-faint">
          {fmtInt(total)} samples · virtualized
        </span>
      </header>

      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="overflow-auto"
        style={{ maxHeight: VIEWPORT_HEIGHT }}
      >
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 z-10 bg-panel text-xs uppercase tracking-wide text-ink-faint">
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
          <tbody className="font-mono text-xs">
            {paddingTop > 0 && (
              <tr aria-hidden>
                <td colSpan={COL_COUNT} style={{ height: paddingTop }} />
              </tr>
            )}
            {visibleRows.map((row) => (
              <tr
                key={row.id}
                className="border-b border-panel-border hover:bg-panel/50"
                style={{ height: ROW_HEIGHT }}
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className="whitespace-nowrap px-3 text-ink-muted"
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            {paddingBottom > 0 && (
              <tr aria-hidden>
                <td colSpan={COL_COUNT} style={{ height: paddingBottom }} />
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <footer className="border-t border-panel-border px-5 py-2 text-xs text-ink-faint">
        Showing rows {total === 0 ? 0 : startIndex + 1}–{endIndex} of{' '}
        {fmtInt(total)}
      </footer>
    </section>
  );
}
