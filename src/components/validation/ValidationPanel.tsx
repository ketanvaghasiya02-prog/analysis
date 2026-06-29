/**
 * Validation report panel — surfaces dataset health at a glance.
 */

import { useData } from '@/context/DataContext';
import { fmtInt } from '@/utils/format';
import { formatDayLabel } from '@/utils/date';
import { AlertIcon, CheckIcon, FileIcon } from '@/components/common/icons';

function SyncBadge({ status, count }: { status: string; count: number }) {
  const upper = status.toUpperCase();
  const tone =
    upper.includes('SYNC') && !upper.includes('OUT')
      ? 'border-positive/40 text-positive'
      : upper.includes('UNKNOWN')
        ? 'border-panel-border text-ink-muted'
        : 'border-warning/40 text-warning';
  return (
    <span className={`chip ${tone}`}>
      {status}
      <span className="font-mono text-ink">{fmtInt(count)}</span>
    </span>
  );
}

export function ValidationPanel() {
  const { validation } = useData();
  if (!validation) return null;

  const {
    filesUploaded,
    totalRows,
    validRows,
    invalidRows,
    missingColumns,
    duplicateTimestampCount,
    syncStatusCounts,
    dateRange,
    perFile,
    totalParseErrors,
  } = validation;

  const validPct = totalRows > 0 ? (validRows / totalRows) * 100 : 0;

  const tallies: Array<{ label: string; value: string; warn?: boolean }> = [
    { label: 'Files Uploaded', value: fmtInt(filesUploaded) },
    { label: 'Total Rows', value: fmtInt(totalRows) },
    { label: 'Valid Rows', value: fmtInt(validRows) },
    { label: 'Invalid Rows', value: fmtInt(invalidRows), warn: invalidRows > 0 },
    {
      label: 'Missing Columns',
      value: fmtInt(missingColumns.length),
      warn: missingColumns.length > 0,
    },
    {
      label: 'Duplicate Timestamps',
      value: fmtInt(duplicateTimestampCount),
      warn: duplicateTimestampCount > 0,
    },
    {
      label: 'Parse Errors',
      value: fmtInt(totalParseErrors),
      warn: totalParseErrors > 0,
    },
  ];

  return (
    <section className="card p-5">
      <header className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckIcon className="text-base text-accent" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink">
            Validation Report
          </h2>
        </div>
        <span className="text-xs text-ink-faint">
          {dateRange.start && dateRange.end
            ? `${formatDayLabel(dateRange.start)} → ${formatDayLabel(dateRange.end)}`
            : 'No date range detected'}
        </span>
      </header>

      {/* Data quality bar */}
      <div className="mb-5">
        <div className="mb-1 flex items-center justify-between text-xs text-ink-muted">
          <span>Data quality</span>
          <span className="font-mono">{validPct.toFixed(1)}% valid</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-panel">
          <div
            className="h-full rounded-full bg-positive transition-all"
            style={{ width: `${Math.min(100, Math.max(0, validPct))}%` }}
          />
        </div>
      </div>

      {/* Tallies */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {tallies.map((t) => (
          <div
            key={t.label}
            className="rounded-md border border-panel-border bg-panel p-3"
          >
            <div className="stat-label">{t.label}</div>
            <div
              className={[
                'mt-1 font-mono text-lg font-semibold',
                t.warn ? 'text-warning' : 'text-ink',
              ].join(' ')}
            >
              {t.value}
            </div>
          </div>
        ))}
      </div>

      {/* SyncStatus distribution */}
      <div className="mt-5">
        <div className="stat-label mb-2">SyncStatus Distribution</div>
        <div className="flex flex-wrap gap-2">
          {Object.entries(syncStatusCounts).length === 0 ? (
            <span className="text-xs text-ink-faint">No samples</span>
          ) : (
            Object.entries(syncStatusCounts)
              .sort((a, b) => b[1] - a[1])
              .map(([status, count]) => (
                <SyncBadge key={status} status={status} count={count} />
              ))
          )}
        </div>
      </div>

      {/* Missing columns detail */}
      {missingColumns.length > 0 && (
        <div className="mt-5 rounded-md border border-warning/30 bg-warning/5 p-3">
          <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-warning">
            <AlertIcon className="text-sm" />
            Missing expected columns
          </div>
          <div className="flex flex-wrap gap-1.5">
            {missingColumns.map((c) => (
              <span
                key={c}
                className="rounded bg-panel px-1.5 py-0.5 font-mono text-xs text-warning"
              >
                {c}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Per-file breakdown */}
      <div className="mt-5">
        <div className="stat-label mb-2">Per-file Breakdown</div>
        <div className="overflow-hidden rounded-md border border-panel-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-panel text-xs uppercase tracking-wide text-ink-faint">
              <tr>
                <th className="px-3 py-2 font-medium">File</th>
                <th className="px-3 py-2 text-right font-medium">Rows</th>
                <th className="px-3 py-2 text-right font-medium">Valid</th>
                <th className="px-3 py-2 text-right font-medium">Invalid</th>
                <th className="px-3 py-2 text-right font-medium">Missing</th>
                <th className="px-3 py-2 font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-panel-border">
              {perFile.map((f) => (
                <tr key={f.fileName} className="hover:bg-panel/50">
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-2 text-ink">
                      <FileIcon className="text-sm text-ink-faint" />
                      <span className="truncate font-mono text-xs">
                        {f.fileName}
                      </span>
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-ink-muted">
                    {fmtInt(f.totalRows)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-positive">
                    {fmtInt(f.validRows)}
                  </td>
                  <td
                    className={[
                      'px-3 py-2 text-right font-mono',
                      f.invalidRows > 0 ? 'text-warning' : 'text-ink-faint',
                    ].join(' ')}
                  >
                    {fmtInt(f.invalidRows)}
                  </td>
                  <td
                    className={[
                      'px-3 py-2 text-right font-mono',
                      f.missingColumns.length > 0
                        ? 'text-warning'
                        : 'text-ink-faint',
                    ].join(' ')}
                  >
                    {fmtInt(f.missingColumns.length)}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-ink-muted">
                    {f.fileNameDate ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
