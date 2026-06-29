/**
 * Left navigation sidebar: brand, upload control, loaded-file list and
 * day-bucket overview. Phase R1 has a single "Overview" view.
 */

import { useData } from '@/context/DataContext';
import { FileUpload } from '@/components/upload/FileUpload';
import { fmtInt } from '@/utils/format';
import {
  ChartIcon,
  FileIcon,
  LayersIcon,
  TableIcon,
  TrashIcon,
} from '@/components/common/icons';

export function Sidebar() {
  const { dataset, validation, reset } = useData();

  return (
    <aside className="flex h-full w-72 flex-col border-r border-panel-border bg-panel">
      {/* Brand */}
      <div className="flex items-center gap-2.5 border-b border-panel-border px-5 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/15 text-accent">
          <ChartIcon className="text-xl" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold text-ink">MT5 Gap Monitor</div>
          <div className="text-[11px] text-ink-faint">CSV Research Console</div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {/* Nav */}
        <nav className="mb-5 space-y-1">
          <div className="flex items-center gap-2 rounded-md border border-accent/40 bg-accent/10 px-3 py-2 text-sm font-medium text-accent">
            <TableIcon className="text-base" />
            Overview
          </div>
          <div
            className="flex cursor-not-allowed items-center gap-2 rounded-md px-3 py-2 text-sm text-ink-faint"
            title="Available in a later phase"
          >
            <LayersIcon className="text-base" />
            Gap Analytics
            <span className="ml-auto text-[10px] uppercase tracking-wide">
              Soon
            </span>
          </div>
        </nav>

        {/* Upload */}
        <div className="mb-5">
          <div className="stat-label mb-2">Upload Data</div>
          <FileUpload variant="compact" />
        </div>

        {/* Loaded files */}
        {dataset && validation && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="stat-label">
                Files ({validation.filesUploaded})
              </span>
              <button
                type="button"
                onClick={reset}
                className="flex items-center gap-1 text-xs text-ink-faint transition-colors hover:text-negative"
                title="Clear all loaded data"
              >
                <TrashIcon className="text-sm" /> Clear
              </button>
            </div>
            <ul className="space-y-1">
              {dataset.files.map((f) => (
                <li
                  key={f.fileName}
                  className="flex items-center gap-2 rounded-md border border-panel-border bg-panel-raised px-2.5 py-1.5"
                >
                  <FileIcon className="shrink-0 text-sm text-ink-faint" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-mono text-[11px] text-ink">
                      {f.fileName}
                    </div>
                    <div className="text-[10px] text-ink-faint">
                      {fmtInt(f.validSamples.length)} valid
                      {f.invalidRows.length > 0
                        ? ` · ${fmtInt(f.invalidRows.length)} invalid`
                        : ''}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Footer disclaimer */}
      <div className="border-t border-panel-border px-5 py-3">
        <p className="text-[10px] leading-relaxed text-ink-faint">
          Research tool for statistical analysis of CSV exports. Not a trading
          application — no broker connection, orders or signals.
        </p>
      </div>
    </aside>
  );
}
