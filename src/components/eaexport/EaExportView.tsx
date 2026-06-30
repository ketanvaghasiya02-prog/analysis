/**
 * EA Export Engine — view (integration layer, read-only).
 *
 * Lets the user convert verified research into a standardized configuration
 * export (JSON / CSV / YAML / XML). It assembles profiles from existing
 * research using the SAME frozen engines the rest of GRT uses, then serialises
 * them. It generates NO Expert Advisor code, NO MQL5 and NO trading logic — it
 * only emits structured data plus metadata, a manifest and a content checksum.
 */

import { useEffect, useMemo, useState } from 'react';
import { useData } from '@/context/DataContext';
import { useRepository } from '@/context/RepositoryContext';
import { useStrategyFocus } from '@/context/StrategyFocusContext';
import type { RepositoryRecord } from '@/utils/researchRepository';
import { buildDossier } from '@/utils/strategyDossier';
import { buildReliability, DEFAULT_RELIABILITY_CONFIG } from '@/utils/reliability';
import { buildWalkForward, DEFAULT_WALK_FORWARD_CONFIG } from '@/utils/walkForward';
import { buildMarketContext, DEFAULT_MARKET_CONTEXT_INPUT } from '@/utils/marketContext';
import {
  buildExport,
  serializeExport,
  PROFILE_LABELS,
  EA_EXPORT_VERSION,
  type ExportFormat,
  type ExportHistoryEntry,
  type ExportProfileType,
  type ProfileInput,
} from '@/utils/eaExport';
import { downloadExport } from '@/utils/reports';
import { EmptyState } from '@/components/common/EmptyState';
import { CheckIcon, DatabaseIcon, DownloadIcon, TrashIcon } from '@/components/common/icons';

const PROFILE_TYPES: ExportProfileType[] = [
  'complete',
  'research',
  'strategy',
  'probability',
  'reliability',
  'validation',
  'market-context',
  'ea-config',
];

const FORMATS: ExportFormat[] = ['json', 'csv', 'yaml', 'xml'];

/** Profile types that describe one or more stored strategy records. */
const RECORD_TYPES = new Set<ExportProfileType>(['complete', 'research', 'strategy', 'probability', 'reliability', 'validation', 'ea-config']);

const HISTORY_KEY = 'grt.eaexport.history.v1';
const MAX_HISTORY = 20;

function loadHistory(): ExportHistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as ExportHistoryEntry[]) : [];
  } catch {
    return [];
  }
}
function saveHistory(h: ExportHistoryEntry[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(h));
  } catch {
    /* ignore */
  }
}

function buildBundle(record: RepositoryRecord): ProfileInput {
  const walk = buildWalkForward(record, DEFAULT_WALK_FORWARD_CONFIG);
  return {
    record,
    dossier: buildDossier(record),
    reliability: buildReliability(record, DEFAULT_RELIABILITY_CONFIG),
    walk: walk.aggregate.totalWalks > 0 ? walk : null,
  };
}

const PREVIEW_LIMIT = 16_000;

export function EaExportView() {
  const { dataset } = useData();
  const { records } = useRepository();
  const { focus } = useStrategyFocus();

  const [type, setType] = useState<ExportProfileType>('complete');
  const [format, setFormat] = useState<ExportFormat>('json');
  const [scope, setScope] = useState<'single' | 'all'>('single');
  const [recordKey, setRecordKey] = useState<string | null>(null);
  const [history, setHistory] = useState<ExportHistoryEntry[]>(() => loadHistory());

  useEffect(() => saveHistory(history), [history]);

  const samples = dataset?.samples ?? [];
  const csvSource = useMemo(() => (dataset?.files ?? []).map((f) => f.fileName), [dataset]);

  const selectedRecord = useMemo(
    () => records.find((r) => r.key === (recordKey ?? focus?.key)) ?? records[0] ?? null,
    [records, recordKey, focus],
  );

  const market = useMemo(() => (samples.length ? buildMarketContext(samples, DEFAULT_MARKET_CONTEXT_INPUT) : null), [samples]);

  // Records included in this export (scope). Bundles reuse the frozen engines.
  const profiles = useMemo<ProfileInput[]>(() => {
    if (!RECORD_TYPES.has(type)) return [];
    const scoped = scope === 'all' ? records : selectedRecord ? [selectedRecord] : [];
    return scoped.map(buildBundle);
  }, [type, scope, records, selectedRecord]);

  const doc = useMemo(
    () => buildExport({ type, profiles, market, csvSource, generatedAt: new Date().toISOString() }),
    [type, profiles, market, csvSource],
  );

  const serialized = useMemo(() => serializeExport(doc, format), [doc, format]);

  const recordBlocked = RECORD_TYPES.has(type) && records.length === 0;
  const marketBlocked = type === 'market-context' && !market?.current;

  const logEntry = (status: ExportHistoryEntry['status']) => {
    const entry: ExportHistoryEntry = {
      time: new Date().toISOString(),
      type: PROFILE_LABELS[type],
      format,
      version: EA_EXPORT_VERSION,
      recordCount: doc.manifest.recordCount,
      checksum: doc.manifest.checksum,
      status,
    };
    setHistory((prev) => [entry, ...prev].slice(0, MAX_HISTORY));
  };

  const onDownload = () => {
    downloadExport(serialized);
    logEntry(doc.manifest.recordCount === 0 ? 'empty' : 'success');
  };
  const onCopy = () => {
    void navigator.clipboard?.writeText(serialized.content);
    logEntry(doc.manifest.recordCount === 0 ? 'empty' : 'success');
  };

  const previewText = serialized.content.length > PREVIEW_LIMIT
    ? `${serialized.content.slice(0, PREVIEW_LIMIT)}\n… preview truncated (${serialized.content.length.toLocaleString()} chars). The full content downloads.`
    : serialized.content;

  return (
    <div className="space-y-5">
      {/* Header + disclaimer */}
      <section className="card flex flex-wrap items-start gap-3 border-accent/30 bg-accent/5 p-4">
        <DatabaseIcon className="mt-0.5 text-base text-accent" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-ink">EA Export Engine</p>
            <span className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
              Integration Layer
            </span>
          </div>
          <p className="mt-1 text-sm leading-relaxed text-ink-muted">
            Convert verified research into a standardized export for external systems (MT5, Python, C#, NodeJS, REST). GRT ends at
            the export stage — this engine emits structured configuration only. It generates no Expert Advisor code, no MQL5 and no
            trading logic, and never recalculates research.
          </p>
        </div>
      </section>

      {/* Controls */}
      <section className="card p-5">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div>
            <span className="stat-label mb-1.5 block">Export Profile</span>
            <div className="flex flex-wrap gap-1.5">
              {PROFILE_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={[
                    'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
                    type === t ? 'border-accent/70 bg-accent/10 text-accent' : 'border-panel-border bg-panel text-ink-muted hover:border-accent hover:text-accent',
                  ].join(' ')}
                >
                  {PROFILE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="stat-label mb-1.5 block">Format</span>
            <div className="flex flex-wrap gap-1.5">
              {FORMATS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFormat(f)}
                  className={[
                    'rounded-md border px-2.5 py-1 text-xs font-medium uppercase transition-colors',
                    format === f ? 'border-accent/70 bg-accent/10 text-accent' : 'border-panel-border bg-panel text-ink-muted hover:border-accent hover:text-accent',
                  ].join(' ')}
                >
                  {f}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[10px] text-ink-faint">Binary profile: planned.</p>
          </div>
          <div>
            <span className="stat-label mb-1.5 block">Scope</span>
            <div className="flex flex-wrap gap-1.5">
              {(['single', 'all'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setScope(s)}
                  disabled={!RECORD_TYPES.has(type)}
                  className={[
                    'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-40',
                    scope === s ? 'border-accent/70 bg-accent/10 text-accent' : 'border-panel-border bg-panel text-ink-muted hover:border-accent hover:text-accent',
                  ].join(' ')}
                >
                  {s === 'single' ? 'Selected strategy' : `All (${records.length})`}
                </button>
              ))}
            </div>
          </div>
        </div>

        {RECORD_TYPES.has(type) && scope === 'single' && records.length > 0 && (
          <div className="mt-4">
            <span className="stat-label mb-1.5 block">Strategy</span>
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
            onClick={onDownload}
            disabled={recordBlocked || marketBlocked}
            className="flex items-center gap-2 rounded-md border border-accent/50 bg-accent/15 px-4 py-2 text-sm font-semibold text-accent transition-colors hover:bg-accent/25 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <DownloadIcon className="text-base" /> Download {format.toUpperCase()}
          </button>
          <button
            type="button"
            onClick={onCopy}
            disabled={recordBlocked || marketBlocked}
            className="rounded-md border border-panel-border bg-panel px-3 py-2 text-sm font-medium text-ink-muted transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
          >
            Copy
          </button>
          <span className="text-[11px] text-ink-faint">{serialized.filename}</span>
        </div>
      </section>

      {/* Manifest */}
      {!recordBlocked && !marketBlocked && (
        <section className="card p-5">
          <h2 className="stat-label mb-3">Export Manifest</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-md border border-panel-border bg-panel px-3 py-2">
              <div className="stat-label">Checksum</div>
              <div className="flex items-center gap-1 font-mono text-sm font-semibold text-positive"><CheckIcon className="text-xs" /> {doc.manifest.checksum}</div>
            </div>
            <div className="rounded-md border border-panel-border bg-panel px-3 py-2">
              <div className="stat-label">Export Version</div>
              <div className="font-mono text-sm font-semibold text-ink">{doc.manifest.exportVersion}</div>
            </div>
            <div className="rounded-md border border-panel-border bg-panel px-3 py-2">
              <div className="stat-label">Record Count</div>
              <div className="font-mono text-sm font-semibold text-ink">{doc.manifest.recordCount}</div>
            </div>
            <div className="rounded-md border border-panel-border bg-panel px-3 py-2">
              <div className="stat-label">Engine Version</div>
              <div className="font-mono text-sm font-semibold text-ink">{doc.metadata.engineVersion}</div>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-ink-faint">
            The checksum is a deterministic hash of the research content only (independent of the creation time), so the same
            research always produces the same checksum — every exported value matches GRT exactly.
          </p>
        </section>
      )}

      {/* Preview / blocked */}
      {recordBlocked ? (
        <EmptyState
          title="No research to export"
          description="The Research Repository is empty. Run the Historical Strategy Finder to research and store strategies — then they can be exported. The Market Context profile can still be exported with a dataset loaded."
        />
      ) : marketBlocked ? (
        <EmptyState title="Market Context unavailable" description="Load a GapMonitor CSV export to generate a Market Context profile." />
      ) : (
        <section className="card overflow-hidden p-0">
          <header className="flex items-center gap-2 border-b border-panel-border px-4 py-2.5">
            <DatabaseIcon className="text-base text-accent" />
            <h3 className="text-sm font-semibold text-ink">Preview</h3>
            <span className="ml-auto font-mono text-[11px] text-ink-faint">{format.toUpperCase()} · {serialized.content.length.toLocaleString()} chars</span>
          </header>
          <pre className="max-h-[52vh] overflow-auto bg-panel px-4 py-3 font-mono text-[11px] leading-relaxed text-ink-muted">{previewText}</pre>
        </section>
      )}

      {/* Export history */}
      <section className="card p-5">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="stat-label">Export History</h2>
          {history.length > 0 && (
            <button type="button" onClick={() => setHistory([])} className="ml-auto flex items-center gap-1 text-[10px] text-ink-faint transition-colors hover:text-negative">
              <TrashIcon className="text-[11px]" /> clear log
            </button>
          )}
        </div>
        {history.length === 0 ? (
          <p className="text-xs text-ink-faint">No exports yet. Downloaded or copied exports are logged here (time, type, format, version, status).</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-panel-border text-ink-faint">
                  <th className="py-1.5 pr-3 font-medium">Time</th>
                  <th className="py-1.5 pr-3 font-medium">Type</th>
                  <th className="py-1.5 pr-3 font-medium">Format</th>
                  <th className="py-1.5 pr-3 font-medium">Version</th>
                  <th className="py-1.5 pr-3 font-medium">Records</th>
                  <th className="py-1.5 pr-3 font-medium">Checksum</th>
                  <th className="py-1.5 pr-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="font-mono text-ink-muted">
                {history.map((h, i) => (
                  <tr key={i} className="border-b border-panel-border/60">
                    <td className="py-1.5 pr-3 whitespace-nowrap">{h.time.replace('T', ' ').slice(0, 19)}</td>
                    <td className="py-1.5 pr-3 font-sans">{h.type}</td>
                    <td className="py-1.5 pr-3 uppercase">{h.format}</td>
                    <td className="py-1.5 pr-3">{h.version}</td>
                    <td className="py-1.5 pr-3">{h.recordCount}</td>
                    <td className="py-1.5 pr-3">{h.checksum}</td>
                    <td className="py-1.5 pr-3">
                      <span className={['rounded px-1.5 py-0.5 text-[10px] font-semibold', h.status === 'success' ? 'bg-positive/15 text-positive' : 'bg-warning/15 text-warning'].join(' ')}>{h.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="text-[11px] text-ink-faint">
        EA Export is the official integration layer of GRT. Future brokers, APIs and automation consume these exported profiles
        instead of accessing internal calculations directly. The export engine itself never trades.
      </p>
    </div>
  );
}
