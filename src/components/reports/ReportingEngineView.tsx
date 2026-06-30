/**
 * Professional Reporting Engine — the single report generation hub.
 *
 * One place to generate every report. Pick a report type, configure only the
 * inputs that type needs, click Generate, and export to PDF / CSV / JSON.
 *
 * It composes EXISTING report builders (no calculation, no report logic is
 * modified): the professional ReportDocument builders in `reportEngine.ts`
 * (Strategy / Probability / Reliability / Walk Forward / Market Intelligence /
 * Research / Replay) and the dataset report builders in `reports.ts` (the Daily
 * "day-wise" report and the Complete "full-summary" report). Nothing is
 * recalculated; every figure is reused verbatim from the frozen engines.
 */

import { useMemo, useState } from 'react';
import { useData } from '@/context/DataContext';
import { useRepository } from '@/context/RepositoryContext';
import { useStrategyFocus } from '@/context/StrategyFocusContext';
import type { RepositoryRecord } from '@/utils/researchRepository';
import { buildDossier } from '@/utils/strategyDossier';
import { buildReliability, DEFAULT_RELIABILITY_CONFIG } from '@/utils/reliability';
import { buildWalkForward, DEFAULT_WALK_FORWARD_CONFIG } from '@/utils/walkForward';
import { buildMarketContext, DEFAULT_MARKET_CONTEXT_INPUT } from '@/utils/marketContext';
import { computeProbability, DEFAULT_PROBABILITY_INPUT } from '@/utils/probability';
import { buildReplay } from '@/utils/replay';
import { describeSelection } from '@/utils/selection';
import {
  buildMarketContextReport,
  buildProbabilityReport,
  buildReliabilityReport,
  buildReplayReport,
  buildResearchReport,
  buildStrategyReport,
  buildWalkForwardReport,
  printReportPdf,
  reportHtml,
  serializeReport,
  type ReportDocument,
  type ReportFormat,
  type ReportTheme,
  type ReportType as EngineType,
} from '@/utils/reportEngine';
import {
  buildReport,
  downloadExport,
  serializeReports,
  type Report as LegacyReport,
  type ReportId as LegacyId,
  type ReportInput as LegacyInput,
} from '@/utils/reports';
import { EmptyState } from '@/components/common/EmptyState';
import { DownloadIcon, FileIcon } from '@/components/common/icons';

type Needs = 'record' | 'dataset';

interface HubType {
  key: string;
  label: string;
  kind: 'engine' | 'legacy';
  engineType?: EngineType;
  legacyId?: LegacyId;
  needs: Needs;
  inputNote: string;
}

// Requested report types first; Research + Replay are kept so no existing
// report-generation capability is removed.
const HUB_TYPES: HubType[] = [
  { key: 'daily', label: 'Daily Report', kind: 'legacy', legacyId: 'day-wise', needs: 'dataset', inputNote: 'Per-day summary of the loaded dataset, scoped by the active date and session filters.' },
  { key: 'strategy', label: 'Strategy Report', kind: 'engine', engineType: 'strategy', needs: 'record', inputNote: 'Select a stored strategy from the Repository.' },
  { key: 'probability', label: 'Probability Report', kind: 'engine', engineType: 'probability', needs: 'dataset', inputNote: 'Probability dataset — the loaded CSV history.' },
  { key: 'reliability', label: 'Reliability Report', kind: 'engine', engineType: 'reliability', needs: 'record', inputNote: 'Reliability dataset — a stored strategy.' },
  { key: 'walk-forward', label: 'Walk Forward Validation Report', kind: 'engine', engineType: 'walk-forward', needs: 'record', inputNote: 'Validation dataset — a stored strategy.' },
  { key: 'market-context', label: 'Market Intelligence Report', kind: 'engine', engineType: 'market-context', needs: 'dataset', inputNote: 'Current research window over the loaded dataset.' },
  { key: 'complete', label: 'Complete Research Report', kind: 'legacy', legacyId: 'full-summary', needs: 'dataset', inputNote: 'Entire loaded dataset — overview, day-wise, zone recovery, sessions, failed events and stop-loss.' },
  { key: 'research', label: 'Research Report', kind: 'engine', engineType: 'research', needs: 'record', inputNote: 'Select a stored strategy from the Repository.' },
  { key: 'replay', label: 'Replay Report', kind: 'engine', engineType: 'replay', needs: 'record', inputNote: 'A stored strategy occurrence reconstructed from its dataset.' },
];

const THEMES: Array<{ id: ReportTheme; label: string }> = [
  { id: 'professional', label: 'Professional' },
  { id: 'institutional', label: 'Institutional' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
];

const FORMATS: Array<{ id: ReportFormat; label: string }> = [
  { id: 'pdf', label: 'PDF' },
  { id: 'csv', label: 'CSV' },
  { id: 'json', label: 'JSON' },
];

interface BuildResult {
  doc: ReportDocument | null;
  legacy: LegacyReport | null;
  blocker: string | null;
}

/** Opens a print-ready window for legacy (dataset) report HTML. */
function printHtml(html: string): void {
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 300);
}

export function ReportingEngineView() {
  const {
    dataset,
    hasData,
    filteredSamples,
    gapZones,
    events,
    recoverySettings,
    slSettings,
    validation,
    selection,
    filters,
  } = useData();
  const { records } = useRepository();
  const { focus } = useStrategyFocus();

  const [typeKey, setTypeKey] = useState<string>('daily');
  const [theme, setTheme] = useState<ReportTheme>('professional');
  const [format, setFormat] = useState<ReportFormat>('pdf');
  const [recordKey, setRecordKey] = useState<string | null>(null);

  const active = HUB_TYPES.find((t) => t.key === typeKey) ?? HUB_TYPES[0]!;
  const samples = dataset?.samples ?? [];
  const dateRange = validation?.dateRange ?? { start: null, end: null };
  const generatedAt = useMemo(() => new Date().toISOString(), [typeKey, recordKey]);

  const selectedRecord: RepositoryRecord | null = useMemo(() => {
    const key = recordKey ?? focus?.key ?? null;
    return records.find((r) => r.key === key) ?? records[0] ?? null;
  }, [records, recordKey, focus]);

  const legacyInput = (): LegacyInput => ({
    samples: filteredSamples,
    zones: gapZones,
    events: events.events,
    recoverySettings,
    slSettings,
    fileNames: dataset?.files.map((f) => f.fileName) ?? [],
    dateRange,
    analysisMode: describeSelection(selection),
    filters,
    generatedAt,
  });

  const { doc, legacy, blocker } = useMemo<BuildResult>(() => {
    const none = (blocker: string): BuildResult => ({ doc: null, legacy: null, blocker });
    try {
      if (active.needs === 'record' && !selectedRecord) {
        return none('No stored strategy is available. Run the Historical Strategy Finder to populate the Research Repository first.');
      }
      if (active.needs === 'dataset' && !hasData) {
        return none('This report needs a loaded dataset. Upload one or more GapMonitor CSV exports first.');
      }

      if (active.kind === 'legacy') {
        return { doc: null, legacy: buildReport(active.legacyId!, legacyInput()), blocker: null };
      }

      const engineDoc = ((): ReportDocument | null => {
        const rec = selectedRecord!;
        switch (active.engineType) {
          case 'research':
            return buildResearchReport(rec, buildDossier(rec), generatedAt);
          case 'reliability':
            return buildReliabilityReport(buildReliability(rec, DEFAULT_RELIABILITY_CONFIG), generatedAt);
          case 'walk-forward':
            return buildWalkForwardReport(buildWalkForward(rec, DEFAULT_WALK_FORWARD_CONFIG), generatedAt);
          case 'strategy': {
            const reliability = buildReliability(rec, DEFAULT_RELIABILITY_CONFIG);
            const walk = buildWalkForward(rec, DEFAULT_WALK_FORWARD_CONFIG);
            return buildStrategyReport(rec, buildDossier(rec), reliability, walk.aggregate.totalWalks > 0 ? walk : null, generatedAt);
          }
          case 'market-context':
            return buildMarketContextReport(buildMarketContext(samples, DEFAULT_MARKET_CONTEXT_INPUT), generatedAt);
          case 'probability':
            return buildProbabilityReport(computeProbability(samples, DEFAULT_PROBABILITY_INPUT), generatedAt);
          case 'replay': {
            const occ = (rec.occurrences ?? [])[focus?.occurrenceIndex ?? 0] ?? (rec.occurrences ?? [])[0] ?? null;
            if (!occ) return null;
            const timeline = buildReplay(samples, rec, occ);
            return timeline.found ? buildReplayReport(timeline, rec, generatedAt) : null;
          }
          default:
            return null;
        }
      })();

      if (!engineDoc) {
        if (active.engineType === 'replay') {
          return none('The occurrence could not be located in the currently loaded dataset. Load the dataset the strategy was researched on.');
        }
        return none('This report could not be assembled from the available research.');
      }
      return { doc: engineDoc, legacy: null, blocker: null };
    } catch {
      return none('This report could not be assembled from the available research.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, selectedRecord, hasData, samples, generatedAt, focus, filteredSamples, gapZones, events, recoverySettings, slSettings, filters, selection]);

  const previewHtml = useMemo(() => {
    if (doc) return reportHtml(doc, theme);
    if (legacy) return serializeReports([legacy], 'html', dateRange).content;
    return '';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, legacy, theme]);

  const ready = !!doc || !!legacy;

  const generate = () => {
    if (doc) {
      if (format === 'pdf') printReportPdf(doc, theme);
      else downloadExport(serializeReport(doc, format));
      return;
    }
    if (legacy) {
      if (format === 'pdf') printHtml(serializeReports([legacy], 'html', dateRange).content);
      else downloadExport(serializeReports([legacy], format, dateRange));
    }
  };

  const statusLine = doc
    ? `${active.label} · ${doc.sections.length} sections · window ${doc.researchWindow}`
    : legacy
      ? `${active.label} · ${legacy.tables.length} tables`
      : '';

  return (
    <div className="space-y-5">
      {/* Header */}
      <section className="card flex flex-wrap items-start gap-3 border-accent/30 bg-accent/5 p-4">
        <FileIcon className="mt-0.5 text-base text-accent" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-ink">Reporting Engine</p>
            <span className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
              Report Generation Hub
            </span>
          </div>
          <p className="mt-1 text-sm leading-relaxed text-ink-muted">
            One place to generate every report. Choose a report type, configure its
            inputs, click Generate, and export to PDF / CSV / JSON. Reports reuse the
            figures computed by the frozen engines — they never recalculate, predict
            or recommend.
          </p>
        </div>
      </section>

      {/* Report type */}
      <section className="card p-5">
        <span className="stat-label mb-2 block">Report Type</span>
        <div className="flex flex-wrap gap-1.5">
          {HUB_TYPES.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTypeKey(t.key)}
              className={[
                'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
                typeKey === t.key ? 'border-accent/70 bg-accent/10 text-accent' : 'border-panel-border bg-panel text-ink-muted hover:border-accent hover:text-accent',
              ].join(' ')}
            >
              {t.label}
            </button>
          ))}
        </div>
      </section>

      {/* Inputs (only the ones this report needs) */}
      <section className="card p-5">
        <div className="mb-2 flex items-center gap-2">
          <span className="stat-label">Report Inputs</span>
          <span className="text-[11px] text-ink-faint">{active.inputNote}</span>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Subject / dataset input */}
          {active.needs === 'record' ? (
            records.length > 0 ? (
              <label className="flex flex-col gap-1">
                <span className="stat-label">Strategy</span>
                <select
                  value={selectedRecord?.key ?? ''}
                  onChange={(e) => setRecordKey(e.target.value)}
                  className="w-full rounded-md border border-panel-border bg-panel px-3 py-1.5 text-sm text-ink focus:border-accent focus:outline-none"
                >
                  {records.map((r) => (
                    <option key={r.key} value={r.key}>
                      Entry {r.entryGap} → Recovery {r.recoveryGap} · SL {r.stopLoss} · {r.totalPositions} events · {r.dateFrom}→{r.dateTo}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p className="text-xs text-ink-faint">No stored strategies yet — run the Historical Strategy Finder.</p>
            )
          ) : (
            <div className="rounded-md border border-panel-border bg-panel px-3 py-2 text-xs text-ink-muted">
              <div className="stat-label mb-0.5">Dataset</div>
              {hasData
                ? `${dataset?.files.length ?? 0} file(s) · range ${dateRange.start ?? '—'} → ${dateRange.end ?? '—'}${active.key === 'daily' ? ' · active date/session filters applied' : ''}`
                : 'No dataset loaded.'}
            </div>
          )}

          {/* Theme + format */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <span className="stat-label mb-1.5 block">Theme</span>
              <div className="flex flex-wrap gap-1.5">
                {THEMES.map((th) => (
                  <button
                    key={th.id}
                    type="button"
                    onClick={() => setTheme(th.id)}
                    disabled={active.kind === 'legacy'}
                    className={[
                      'rounded-md border px-2 py-1 text-xs font-medium transition-colors disabled:opacity-40',
                      theme === th.id ? 'border-accent/70 bg-accent/10 text-accent' : 'border-panel-border bg-panel text-ink-muted hover:border-accent hover:text-accent',
                    ].join(' ')}
                  >
                    {th.label}
                  </button>
                ))}
              </div>
              {active.kind === 'legacy' && <span className="mt-1 block text-[10px] text-ink-faint">Theme applies to professional reports.</span>}
            </div>
            <div>
              <span className="stat-label mb-1.5 block">Format</span>
              <div className="flex flex-wrap gap-1.5">
                {FORMATS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFormat(f.id)}
                    className={[
                      'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
                      format === f.id ? 'border-accent/70 bg-accent/10 text-accent' : 'border-panel-border bg-panel text-ink-muted hover:border-accent hover:text-accent',
                    ].join(' ')}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={generate}
            disabled={!ready}
            className="flex items-center gap-2 rounded-md border border-accent/50 bg-accent/15 px-4 py-2 text-sm font-semibold text-accent transition-colors hover:bg-accent/25 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <DownloadIcon className="text-base" />
            {format === 'pdf' ? 'Generate Report (Print / Save as PDF)' : `Generate Report (${format.toUpperCase()})`}
          </button>
          {ready && <span className="text-[11px] text-ink-faint">{statusLine}</span>}
        </div>
      </section>

      {/* Preview / blocker */}
      {blocker ? (
        <EmptyState title="Report not available" description={blocker} />
      ) : ready ? (
        <section className="card overflow-hidden p-0">
          <header className="flex items-center gap-2 border-b border-panel-border px-4 py-2.5">
            <FileIcon className="text-base text-accent" />
            <h3 className="text-sm font-semibold text-ink">Live Preview</h3>
            <span className="ml-auto text-[11px] text-ink-faint">{doc ? `${theme} theme · ` : ''}rendered exactly as exported</span>
          </header>
          <iframe
            title="Report preview"
            srcDoc={previewHtml}
            className="h-[70vh] w-full border-0 bg-white"
          />
        </section>
      ) : null}

      <p className="text-[11px] text-ink-faint">
        Reports are presentation only. Every statistic is reproduced verbatim from
        the frozen engines and is reproducible from the source CSV. Reports remain
        purely descriptive — no prediction, no recommendation.
      </p>
    </div>
  );
}
