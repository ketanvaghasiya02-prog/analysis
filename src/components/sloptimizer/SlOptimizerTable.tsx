/**
 * Stop Loss Optimizer results table (visualization layer).
 *
 * One row per tested stop-loss with the full Research Engine result set. Adds
 * sorting, filtering, resizable columns, automatic row highlighting and a CSV
 * export of exactly what is on screen. Every value is read from the
 * already-computed optimizer rows — nothing is recalculated here.
 */

import { useMemo, useRef, useState, type ReactNode } from 'react';
import type { SlOptimizerResult, SlOptimizerRow } from '@/utils/slOptimizer';
import { fmtDuration, fmtInt, fmtNumber, fmtPercent } from '@/utils/format';
import { DownloadIcon, TableIcon } from '@/components/common/icons';
import { InfoTip } from '@/components/common/InfoTip';
import { exportRowsCsv } from '@/utils/chartExport';
import { METRIC_TOOLTIPS } from '@/components/sloptimizer/metrics';

type NumericKey =
  | 'stopLoss'
  | 'recoveryBeforeSlPct'
  | 'recoveryAfterSlPct'
  | 'recoveryIgnoringSlPct'
  | 'slHitPct'
  | 'avgRecoverySec'
  | 'avgMaxGap'
  | 'p95MaxGap'
  | 'worstMaxGap'
  | 'score';

interface Column {
  key: NumericKey | 'confidenceLabel';
  label: string;
  sortable: boolean;
  tooltip?: string;
  render: (r: SlOptimizerRow) => ReactNode;
  csv: (r: SlOptimizerRow) => string | number | null;
  cellClass?: string;
  width: number;
}

function scoreTone(s: number): string {
  if (s >= 70) return 'text-positive';
  if (s >= 45) return 'text-warning';
  return 'text-negative';
}

const r1 = (n: number | null) => (n === null ? null : Math.round(n * 10) / 10);
const r3 = (n: number | null) => (n === null ? null : Math.round(n * 1000) / 1000);
const rt = (n: number | null) => (n === null ? null : Math.round(n));

const COLUMNS: Column[] = [
  { key: 'stopLoss', label: 'Stop Loss', sortable: true, width: 96, tooltip: METRIC_TOOLTIPS.stopLoss, render: (r) => fmtNumber(r.stopLoss, 2), csv: (r) => r3(r.stopLoss), cellClass: 'text-ink' },
  { key: 'recoveryBeforeSlPct', label: 'Recovery Before %', sortable: true, width: 130, tooltip: METRIC_TOOLTIPS.recoveryBeforeSlPct, render: (r) => fmtPercent(r.recoveryBeforeSlPct), csv: (r) => r1(r.recoveryBeforeSlPct), cellClass: 'text-positive' },
  { key: 'recoveryAfterSlPct', label: 'Recovery After %', sortable: true, width: 124, tooltip: METRIC_TOOLTIPS.recoveryAfterSlPct, render: (r) => fmtPercent(r.recoveryAfterSlPct), csv: (r) => r1(r.recoveryAfterSlPct), cellClass: 'text-warning' },
  { key: 'recoveryIgnoringSlPct', label: 'Recovery Ignoring %', sortable: true, width: 138, tooltip: METRIC_TOOLTIPS.recoveryIgnoringSlPct, render: (r) => fmtPercent(r.recoveryIgnoringSlPct), csv: (r) => r1(r.recoveryIgnoringSlPct), cellClass: 'text-accent' },
  { key: 'slHitPct', label: 'SL Hit %', sortable: true, width: 92, tooltip: METRIC_TOOLTIPS.slHitPct, render: (r) => fmtPercent(r.slHitPct), csv: (r) => r1(r.slHitPct), cellClass: 'text-negative' },
  { key: 'avgRecoverySec', label: 'Avg Recovery Time', sortable: true, width: 128, tooltip: METRIC_TOOLTIPS.avgRecoverySec, render: (r) => fmtDuration(r.avgRecoverySec), csv: (r) => rt(r.avgRecoverySec) },
  { key: 'avgMaxGap', label: 'Avg Max Gap', sortable: true, width: 110, tooltip: METRIC_TOOLTIPS.avgMaxGap, render: (r) => fmtNumber(r.avgMaxGap, 3), csv: (r) => r3(r.avgMaxGap) },
  { key: 'p95MaxGap', label: 'P95 Gap', sortable: true, width: 96, tooltip: METRIC_TOOLTIPS.p95MaxGap, render: (r) => fmtNumber(r.p95MaxGap, 3), csv: (r) => r3(r.p95MaxGap) },
  { key: 'worstMaxGap', label: 'Worst Gap', sortable: true, width: 100, tooltip: METRIC_TOOLTIPS.worstMaxGap, render: (r) => fmtNumber(r.worstMaxGap, 3), csv: (r) => r3(r.worstMaxGap), cellClass: 'text-negative' },
  { key: 'score', label: 'Overall Score', sortable: true, width: 112, tooltip: METRIC_TOOLTIPS.score, render: (r) => <span className={scoreTone(r.score)}>{fmtNumber(r.score, 1)}</span>, csv: (r) => r1(r.score) },
  { key: 'confidenceLabel', label: 'Research Confidence', sortable: false, width: 150, tooltip: METRIC_TOOLTIPS.confidenceLabel, render: (r) => r.confidenceLabel, csv: (r) => r.confidenceLabel, cellClass: 'font-sans' },
];

type HighlightKind = 'recoveryHigh' | 'recoveryLow' | 'scoreHigh' | 'slHitLow';

const HIGHLIGHT_STYLE: Record<HighlightKind, { row: string; chip: string; label: string }> = {
  recoveryHigh: { row: 'bg-positive/10', chip: 'bg-positive/20 text-positive', label: 'Highest recovery' },
  recoveryLow: { row: 'bg-negative/10', chip: 'bg-negative/20 text-negative', label: 'Lowest recovery' },
  scoreHigh: { row: 'bg-accent/10', chip: 'bg-accent/20 text-accent', label: 'Highest score' },
  slHitLow: { row: 'bg-purple-500/10', chip: 'bg-purple-500/25 text-purple-300', label: 'Lowest SL hit' },
};

/** Picks the stop-loss values that earn each highlight colour. */
function computeHighlights(rows: SlOptimizerRow[]): Map<number, HighlightKind> {
  const map = new Map<number, HighlightKind>();
  const withPos = rows.filter((r) => r.totalPositions > 0);
  if (withPos.length === 0) return map;

  const maxRec = withPos.reduce((b, r) => (r.recoveryBeforeSlPct > b.recoveryBeforeSlPct ? r : b));
  const minRec = withPos.reduce((b, r) => (r.recoveryBeforeSlPct < b.recoveryBeforeSlPct ? r : b));
  const maxScore = withPos.reduce((b, r) => (r.score > b.score ? r : b));
  const minHit = withPos.reduce((b, r) => (r.slHitPct < b.slHitPct ? r : b));

  // Priority order if a row wins more than one: score > recoveryHigh > slHitLow > recoveryLow.
  map.set(minRec.stopLoss, 'recoveryLow');
  map.set(minHit.stopLoss, 'slHitLow');
  map.set(maxRec.stopLoss, 'recoveryHigh');
  map.set(maxScore.stopLoss, 'scoreHigh');
  return map;
}

export function SlOptimizerTable({ result }: { result: SlOptimizerResult }) {
  const [sortKey, setSortKey] = useState<NumericKey>('stopLoss');
  const [desc, setDesc] = useState(false);
  const [slMin, setSlMin] = useState('');
  const [slMax, setSlMax] = useState('');
  const [confidence, setConfidence] = useState('');
  const [widths, setWidths] = useState<Record<string, number>>(() =>
    Object.fromEntries(COLUMNS.map((c) => [c.key, c.width])),
  );

  const balancedSl = result.balanced?.stopLoss ?? null;
  const highlights = useMemo(() => computeHighlights(result.rows), [result.rows]);

  const confidenceOptions = useMemo(
    () => Array.from(new Set(result.rows.map((r) => r.confidenceLabel))),
    [result.rows],
  );

  const filtered = useMemo(() => {
    const lo = slMin.trim() === '' ? -Infinity : Number(slMin);
    const hi = slMax.trim() === '' ? Infinity : Number(slMax);
    return result.rows.filter((r) => {
      if (Number.isFinite(lo) && r.stopLoss < lo) return false;
      if (Number.isFinite(hi) && r.stopLoss > hi) return false;
      if (confidence && r.confidenceLabel !== confidence) return false;
      return true;
    });
  }, [result.rows, slMin, slMax, confidence]);

  const sorted = useMemo(() => {
    const out = [...filtered];
    out.sort((a, b) => {
      const av = (a[sortKey] as number | null) ?? -Infinity;
      const bv = (b[sortKey] as number | null) ?? -Infinity;
      return desc ? bv - av : av - bv;
    });
    return out;
  }, [filtered, sortKey, desc]);

  const toggle = (k: NumericKey) => {
    if (k === sortKey) setDesc((d) => !d);
    else {
      setSortKey(k);
      setDesc(k !== 'stopLoss');
    }
  };

  // --- column resize ----------------------------------------------------------
  const resizing = useRef<{ key: string; startX: number; startW: number } | null>(null);
  const startResize = (key: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    resizing.current = { key, startX: e.clientX, startW: widths[key] ?? 100 };
    const onMove = (ev: MouseEvent) => {
      const st = resizing.current;
      if (!st) return;
      const next = Math.max(64, st.startW + (ev.clientX - st.startX));
      setWidths((w) => ({ ...w, [st.key]: next }));
    };
    const onUp = () => {
      resizing.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const exportCsv = () => {
    const cols = COLUMNS.map((c) => c.label);
    const rows = sorted.map((r) => COLUMNS.map((c) => c.csv(r)));
    exportRowsCsv('StopLossOptimizer-table', cols, rows);
  };

  const resetFilters = () => {
    setSlMin('');
    setSlMax('');
    setConfidence('');
  };
  const filterActive = slMin !== '' || slMax !== '' || confidence !== '';

  return (
    <section className="card overflow-hidden">
      <header className="flex flex-wrap items-center gap-2 border-b border-panel-border px-5 py-3">
        <TableIcon className="text-base text-accent" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink">
          Stop Loss Results
        </h2>
        <span className="text-xs text-ink-faint">
          {sorted.length} / {result.rows.length} SL levels{result.truncated ? ' (capped)' : ''}
        </span>
        <button
          type="button"
          onClick={exportCsv}
          className="btn ml-auto flex items-center gap-1.5 px-2 py-1 text-xs"
          disabled={sorted.length === 0}
          title="Export the rows shown (after filtering and sorting) as CSV"
        >
          <DownloadIcon className="text-sm" />
          CSV
        </button>
      </header>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 border-b border-panel-border px-5 py-3 text-xs">
        <label className="flex flex-col gap-1">
          <span className="stat-label">SL ≥</span>
          <input
            type="number"
            step={0.1}
            value={slMin}
            onChange={(e) => setSlMin(e.target.value)}
            placeholder="min"
            className="w-24 rounded-md border border-panel-border bg-panel px-2 py-1 text-ink focus:border-accent focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="stat-label">SL ≤</span>
          <input
            type="number"
            step={0.1}
            value={slMax}
            onChange={(e) => setSlMax(e.target.value)}
            placeholder="max"
            className="w-24 rounded-md border border-panel-border bg-panel px-2 py-1 text-ink focus:border-accent focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="stat-label">Confidence</span>
          <select
            value={confidence}
            onChange={(e) => setConfidence(e.target.value)}
            className="w-40 rounded-md border border-panel-border bg-panel px-2 py-1 text-ink focus:border-accent focus:outline-none"
          >
            <option value="">All</option>
            {confidenceOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        {filterActive && (
          <button type="button" onClick={resetFilters} className="btn px-2 py-1">
            Clear filters
          </button>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-faint">
          {(Object.keys(HIGHLIGHT_STYLE) as HighlightKind[]).map((k) => (
            <span key={k} className="inline-flex items-center gap-1.5">
              <span className={['h-2.5 w-2.5 rounded-sm', HIGHLIGHT_STYLE[k].chip].join(' ')} />
              {HIGHLIGHT_STYLE[k].label}
            </span>
          ))}
        </div>
      </div>

      <div className="max-h-[34rem] overflow-auto">
        <table className="text-left text-sm" style={{ tableLayout: 'fixed', width: 'max-content', minWidth: '100%' }}>
          <colgroup>
            {COLUMNS.map((c) => (
              <col key={c.key} style={{ width: widths[c.key] }} />
            ))}
          </colgroup>
          <thead className="sticky top-0 z-10 bg-panel text-xs uppercase tracking-wide text-ink-faint">
            <tr>
              {COLUMNS.map((c, idx) => (
                <th
                  key={c.key}
                  onClick={c.sortable ? () => toggle(c.key as NumericKey) : undefined}
                  className={[
                    'relative px-3 py-2 font-medium',
                    idx === 0 ? 'text-left' : 'text-right',
                    c.sortable ? 'cursor-pointer select-none' : '',
                  ].join(' ')}
                >
                  <span className="inline-flex items-center gap-0.5">
                    {c.label}
                    {c.tooltip ? <InfoTip text={c.tooltip} /> : null}
                    {c.sortable && sortKey === c.key ? (
                      <span className="text-ink-faint">{desc ? '▼' : '▲'}</span>
                    ) : null}
                  </span>
                  <span
                    onMouseDown={(e) => startResize(c.key, e)}
                    className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize select-none hover:bg-accent/40"
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-panel-border font-mono text-xs">
            {sorted.map((r) => {
              const isBalanced = balancedSl !== null && Math.abs(r.stopLoss - balancedSl) < 1e-9;
              const hl = highlights.get(r.stopLoss);
              const rowClass = hl
                ? HIGHLIGHT_STYLE[hl].row
                : isBalanced
                  ? 'bg-accent/5'
                  : 'hover:bg-panel/50';
              return (
                <tr key={r.stopLoss} className={['transition-colors', rowClass].join(' ')}>
                  {COLUMNS.map((c, idx) => (
                    <td
                      key={c.key}
                      className={[
                        'truncate px-3 py-1.5',
                        idx === 0 ? 'text-left' : 'text-right',
                        c.cellClass ?? 'text-ink-muted',
                      ].join(' ')}
                    >
                      {idx === 0 ? (
                        <span className="inline-flex items-center gap-1.5">
                          {c.render(r)}
                          {isBalanced ? (
                            <span className="rounded bg-accent/20 px-1 text-[10px] text-accent">balanced</span>
                          ) : null}
                          {hl ? (
                            <span className={['rounded px-1 text-[10px]', HIGHLIGHT_STYLE[hl].chip].join(' ')}>
                              {HIGHLIGHT_STYLE[hl].label}
                            </span>
                          ) : null}
                        </span>
                      ) : (
                        c.render(r)
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length} className="px-3 py-6 text-center text-ink-faint">
                  {result.rows.length === 0
                    ? 'No SL levels — check the range and that entry events exist.'
                    : 'No rows match the current filters.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <footer className="border-t border-panel-border px-5 py-2 text-[11px] text-ink-faint">
        Total positions at each SL:{' '}
        {result.rows[0] ? fmtInt(result.rows[0].totalPositions) : 0}. Every row is one
        Research Engine v1.0 call — no logic duplicated. Drag a column edge to resize.
      </footer>
    </section>
  );
}
