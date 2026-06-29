/**
 * Export menu (Phase R11).
 *
 * Lives in the header, so an export control is available on every page. Lets
 * the user pick a format (CSV / JSON / printable HTML) and download any single
 * report or all reports at once. Reports are built on demand from the current
 * filtered dataset, so exports always respect the active analysis mode and
 * global filters.
 */

import { useMemo, useState } from 'react';
import { useData, type AppView } from '@/context/DataContext';
import { describeSelection } from '@/utils/selection';
import {
  ALL_REPORT_IDS,
  buildAllReports,
  buildReport,
  downloadExport,
  REPORT_TITLES,
  serializeReports,
  type ExportFormat,
  type ReportId,
  type ReportInput,
} from '@/utils/reports';

const FORMATS: Array<{ id: ExportFormat; label: string }> = [
  { id: 'csv', label: 'CSV' },
  { id: 'json', label: 'JSON' },
  { id: 'html', label: 'HTML' },
];

/** Maps the active page to its primary report, to surface it first. */
const VIEW_REPORT: Partial<Record<AppView, ReportId>> = {
  recovery: 'gap-zone-recovery',
  stoploss: 'stop-loss-survival',
  failed: 'failed-events',
  session: 'session',
};

export function ExportMenu() {
  const {
    hasData,
    filteredSamples,
    gapZones,
    events,
    recoverySettings,
    slSettings,
    dataset,
    validation,
    selection,
    filters,
    view,
  } = useData();

  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<ExportFormat>('csv');

  const buildInput = (): ReportInput => ({
    samples: filteredSamples,
    zones: gapZones,
    events: events.events,
    recoverySettings,
    slSettings,
    fileNames: dataset?.files.map((f) => f.fileName) ?? [],
    dateRange: validation?.dateRange ?? { start: null, end: null },
    analysisMode: describeSelection(selection),
    filters,
    generatedAt: new Date().toISOString(),
  });

  const dateRange = validation?.dateRange ?? { start: null, end: null };

  const exportOne = (id: ReportId) => {
    const report = buildReport(id, buildInput());
    downloadExport(serializeReports([report], format, dateRange));
    setOpen(false);
  };

  const exportAll = () => {
    const reports = buildAllReports(buildInput());
    downloadExport(serializeReports(reports, format, dateRange));
    setOpen(false);
  };

  // Order reports with the current page's report first.
  const orderedIds = useMemo<ReportId[]>(() => {
    const primary = VIEW_REPORT[view];
    if (!primary) return ALL_REPORT_IDS;
    return [primary, ...ALL_REPORT_IDS.filter((id) => id !== primary)];
  }, [view]);

  if (!hasData) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="btn px-3 py-1.5"
      >
        Export
        <span className="text-ink-faint">▾</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-40 mt-2 w-72 rounded-lg border border-panel-border bg-panel-raised p-3 shadow-card">
            <div className="mb-2 flex items-center justify-between">
              <span className="stat-label">Format</span>
              <div className="flex gap-1">
                {FORMATS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFormat(f.id)}
                    className={[
                      'btn px-2 py-0.5 text-xs',
                      format === f.id ? 'btn-active' : '',
                    ].join(' ')}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="my-2 border-t border-panel-border" />

            <div className="stat-label mb-1">Reports</div>
            <ul className="space-y-0.5">
              {orderedIds.map((id) => (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => exportOne(id)}
                    className={[
                      'flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-panel',
                      VIEW_REPORT[view] === id ? 'text-accent' : 'text-ink-muted',
                    ].join(' ')}
                  >
                    {REPORT_TITLES[id]}
                    <span className="text-ink-faint">↓</span>
                  </button>
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={exportAll}
              className="btn btn-active mt-3 w-full py-1.5 text-xs"
            >
              Export all reports ({format.toUpperCase()})
            </button>
          </div>
        </>
      )}
    </div>
  );
}
