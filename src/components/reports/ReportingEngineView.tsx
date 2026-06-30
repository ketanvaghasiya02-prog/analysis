/**
 * Professional Reporting Engine — view (presentation only).
 *
 * Lets the user assemble a professional, descriptive report from existing
 * research: pick a report type, a subject (a stored strategy and/or the loaded
 * dataset), a theme and a format. It calls the SAME frozen engines the rest of
 * GRT uses to obtain the figures, then hands those computed results to the pure
 * report builders. It never recalculates or modifies research.
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
  REPORT_TYPE_LABELS,
  type ReportDocument,
  type ReportFormat,
  type ReportTheme,
  type ReportType,
} from '@/utils/reportEngine';
import { downloadExport } from '@/utils/reports';
import { EmptyState } from '@/components/common/EmptyState';
import { DownloadIcon, FileIcon } from '@/components/common/icons';

const REPORT_TYPES: ReportType[] = [
  'research',
  'strategy',
  'reliability',
  'walk-forward',
  'probability',
  'market-context',
  'replay',
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

/** Report types that describe a stored strategy record. */
const RECORD_TYPES = new Set<ReportType>(['research', 'strategy', 'reliability', 'walk-forward', 'replay']);
/** Report types that need the currently-loaded dataset. */
const DATASET_TYPES = new Set<ReportType>(['probability', 'market-context', 'replay']);

interface BuildResult {
  doc: ReportDocument | null;
  blocker: string | null;
}

export function ReportingEngineView() {
  const { dataset } = useData();
  const { records } = useRepository();
  const { focus } = useStrategyFocus();

  const [type, setType] = useState<ReportType>('research');
  const [theme, setTheme] = useState<ReportTheme>('professional');
  const [format, setFormat] = useState<ReportFormat>('pdf');
  const [recordKey, setRecordKey] = useState<string | null>(null);

  const samples = dataset?.samples ?? [];
  const generatedAt = useMemo(() => new Date().toISOString(), [type, recordKey]);

  const selectedRecord: RepositoryRecord | null = useMemo(() => {
    const key = recordKey ?? focus?.key ?? null;
    return records.find((r) => r.key === key) ?? records[0] ?? null;
  }, [records, recordKey, focus]);

  const { doc, blocker } = useMemo<BuildResult>(() => {
    try {
      if (RECORD_TYPES.has(type) && !selectedRecord) {
        return { doc: null, blocker: 'No stored strategy is available. Run the Historical Strategy Finder to populate the Research Repository first.' };
      }
      if (DATASET_TYPES.has(type) && samples.length === 0) {
        return { doc: null, blocker: 'This report needs a loaded dataset. Upload one or more GapMonitor CSV exports first.' };
      }

      switch (type) {
        case 'research':
          return { doc: buildResearchReport(selectedRecord!, buildDossier(selectedRecord!), generatedAt), blocker: null };
        case 'reliability':
          return { doc: buildReliabilityReport(buildReliability(selectedRecord!, DEFAULT_RELIABILITY_CONFIG), generatedAt), blocker: null };
        case 'walk-forward':
          return { doc: buildWalkForwardReport(buildWalkForward(selectedRecord!, DEFAULT_WALK_FORWARD_CONFIG), generatedAt), blocker: null };
        case 'strategy': {
          const rec = selectedRecord!;
          const reliability = buildReliability(rec, DEFAULT_RELIABILITY_CONFIG);
          const walk = buildWalkForward(rec, DEFAULT_WALK_FORWARD_CONFIG);
          return { doc: buildStrategyReport(rec, buildDossier(rec), reliability, walk.aggregate.totalWalks > 0 ? walk : null, generatedAt), blocker: null };
        }
        case 'market-context':
          return { doc: buildMarketContextReport(buildMarketContext(samples, DEFAULT_MARKET_CONTEXT_INPUT), generatedAt), blocker: null };
        case 'probability':
          return { doc: buildProbabilityReport(computeProbability(samples, DEFAULT_PROBABILITY_INPUT), generatedAt), blocker: null };
        case 'replay': {
          const rec = selectedRecord!;
          const occ = (rec.occurrences ?? [])[focus?.occurrenceIndex ?? 0] ?? (rec.occurrences ?? [])[0] ?? null;
          if (!occ) return { doc: null, blocker: 'The selected strategy has no stored occurrences to replay.' };
          const timeline = buildReplay(samples, rec, occ);
          if (!timeline.found) return { doc: null, blocker: 'The occurrence could not be located in the currently loaded dataset. Load the dataset the strategy was researched on.' };
          return { doc: buildReplayReport(timeline, rec, generatedAt), blocker: null };
        }
        default:
          return { doc: null, blocker: 'Unknown report type.' };
      }
    } catch {
      return { doc: null, blocker: 'This report could not be assembled from the available research.' };
    }
  }, [type, selectedRecord, samples, generatedAt, focus]);

  const previewHtml = useMemo(() => (doc ? reportHtml(doc, theme) : ''), [doc, theme]);

  const generate = () => {
    if (!doc) return;
    if (format === 'pdf') printReportPdf(doc, theme);
    else downloadExport(serializeReport(doc, format));
  };

  const needsRecord = RECORD_TYPES.has(type);

  return (
    <div className="space-y-5">
      {/* Header + disclaimer */}
      <section className="card flex flex-wrap items-start gap-3 border-accent/30 bg-accent/5 p-4">
        <FileIcon className="mt-0.5 text-base text-accent" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-ink">Professional Reporting Engine</p>
            <span className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
              Presentation Only
            </span>
          </div>
          <p className="mt-1 text-sm leading-relaxed text-ink-muted">
            Assemble descriptive reports from existing research. Reports reuse the
            figures computed by the frozen engines — they never recalculate, predict
            or recommend.
          </p>
        </div>
      </section>

      {/* Controls */}
      <section className="card p-5">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div>
            <span className="stat-label mb-1.5 block">Report Type</span>
            <div className="flex flex-wrap gap-1.5">
              {REPORT_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={[
                    'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
                    type === t ? 'border-accent/70 bg-accent/10 text-accent' : 'border-panel-border bg-panel text-ink-muted hover:border-accent hover:text-accent',
                  ].join(' ')}
                >
                  {REPORT_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="stat-label mb-1.5 block">Theme</span>
            <div className="flex flex-wrap gap-1.5">
              {THEMES.map((th) => (
                <button
                  key={th.id}
                  type="button"
                  onClick={() => setTheme(th.id)}
                  className={[
                    'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
                    theme === th.id ? 'border-accent/70 bg-accent/10 text-accent' : 'border-panel-border bg-panel text-ink-muted hover:border-accent hover:text-accent',
                  ].join(' ')}
                >
                  {th.label}
                </button>
              ))}
            </div>
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

        {needsRecord && records.length > 0 && (
          <div className="mt-4">
            <span className="stat-label mb-1.5 block">Strategy (subject)</span>
            <select
              value={selectedRecord?.key ?? ''}
              onChange={(e) => setRecordKey(e.target.value)}
              className="w-full max-w-xl rounded-md border border-panel-border bg-panel px-3 py-1.5 text-sm text-ink focus:border-accent focus:outline-none"
            >
              {records.map((r) => (
                <option key={r.key} value={r.key}>
                  Entry {r.entryGap} → Recovery {r.recoveryGap} · SL {r.stopLoss} · {r.totalPositions} events · {r.dateFrom}→{r.dateTo}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={generate}
            disabled={!doc}
            className="flex items-center gap-2 rounded-md border border-accent/50 bg-accent/15 px-4 py-2 text-sm font-semibold text-accent transition-colors hover:bg-accent/25 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <DownloadIcon className="text-base" />
            {format === 'pdf' ? 'Open Print / Save as PDF' : `Download ${format.toUpperCase()}`}
          </button>
          {doc && (
            <span className="text-[11px] text-ink-faint">
              {REPORT_TYPE_LABELS[type]} · {doc.sections.length} sections · window {doc.researchWindow}
            </span>
          )}
        </div>
      </section>

      {/* Preview / blocker */}
      {blocker ? (
        <EmptyState title="Report not available" description={blocker} />
      ) : doc ? (
        <section className="card overflow-hidden p-0">
          <header className="flex items-center gap-2 border-b border-panel-border px-4 py-2.5">
            <FileIcon className="text-base text-accent" />
            <h3 className="text-sm font-semibold text-ink">Live Preview</h3>
            <span className="ml-auto text-[11px] text-ink-faint">{theme} theme · rendered exactly as exported</span>
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
