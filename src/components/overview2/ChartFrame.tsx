/**
 * Chart frame with title and PNG / CSV export controls (Overview 2.0).
 */

import { useRef, type ReactNode } from 'react';
import { exportChartPng, exportRowsCsv } from '@/utils/chartExport';
import { ChartIcon } from '@/components/common/icons';

interface ChartFrameProps {
  title: string;
  subtitle?: string;
  fileBase: string;
  /** Optional CSV export payload. */
  csv?: { columns: string[]; rows: Array<Array<string | number | null>> };
  height?: number;
  children: ReactNode;
}

export function ChartFrame({
  title,
  subtitle,
  fileBase,
  csv,
  height = 280,
  children,
}: ChartFrameProps) {
  const ref = useRef<HTMLDivElement>(null);

  return (
    <section className="card p-5">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ChartIcon className="text-base text-accent" />
          <h3 className="text-sm font-semibold uppercase tracking-wide text-ink">
            {title}
          </h3>
          {subtitle ? (
            <span className="text-xs text-ink-faint">· {subtitle}</span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => exportChartPng(ref.current, fileBase)}
            className="btn px-2 py-1 text-xs"
          >
            PNG
          </button>
          {csv ? (
            <button
              type="button"
              onClick={() => exportRowsCsv(fileBase, csv.columns, csv.rows)}
              className="btn px-2 py-1 text-xs"
            >
              CSV
            </button>
          ) : null}
        </div>
      </header>
      <div ref={ref} style={{ height }} className="w-full">
        {children}
      </div>
    </section>
  );
}
