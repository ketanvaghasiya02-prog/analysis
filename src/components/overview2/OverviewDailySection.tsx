/**
 * Section 6 — Daily Analysis (Overview 2.0). Sortable per-day table.
 *
 * Gap stats are descriptive; positions / recovery time / confidence are
 * consumed from the Research Engine (computeScenario per day).
 */

import { useMemo, useState } from 'react';
import type { GapSample } from '@/types/gap';
import {
  computeScenario,
  CONFIDENCE_LABELS,
  type ScenarioInput,
} from '@/utils/scenario';
import { computeGapStats } from '@/utils/overviewStats';
import { fmtDuration, fmtInt, fmtNumber } from '@/utils/format';
import { exportRowsCsv } from '@/utils/chartExport';
import { TableIcon } from '@/components/common/icons';

interface Row {
  day: string;
  avg: number | null;
  max: number | null;
  min: number | null;
  expansion: number;
  compression: number;
  positions: number;
  avgRecoverySec: number | null;
  confidence: string;
}

type SortKey = 'day' | 'avg' | 'max' | 'min' | 'expansion' | 'compression' | 'positions';

/** Largest up-swing and down-swing within a day's chronological gap path. */
function swings(group: GapSample[]): { expansion: number; compression: number } {
  let runMin = Infinity;
  let runMax = -Infinity;
  let expansion = 0;
  let compression = 0;
  for (const s of group) {
    if (s.gap === null) continue;
    if (s.gap < runMin) runMin = s.gap;
    if (s.gap > runMax) runMax = s.gap;
    expansion = Math.max(expansion, s.gap - runMin);
    compression = Math.max(compression, runMax - s.gap);
  }
  return { expansion, compression };
}

export function OverviewDailySection({
  samples,
  reference,
}: {
  samples: GapSample[];
  reference: ScenarioInput;
}) {
  const [sortKey, setSortKey] = useState<SortKey>('day');
  const [desc, setDesc] = useState(false);

  const rows = useMemo<Row[]>(() => {
    const byDay = new Map<string, GapSample[]>();
    for (const s of samples) (byDay.get(s.dayKey) ?? byDay.set(s.dayKey, []).get(s.dayKey)!).push(s);
    const out: Row[] = [];
    for (const [day, group] of byDay) {
      const stats = computeGapStats(group);
      const sw = swings(group);
      const res = computeScenario(group, reference);
      out.push({
        day,
        avg: stats.avg,
        max: stats.max,
        min: stats.min,
        expansion: sw.expansion,
        compression: sw.compression,
        positions: res.validEvents,
        avgRecoverySec: res.avgRecoveryTimeSec,
        confidence: CONFIDENCE_LABELS[res.confidence.level],
      });
    }
    return out;
  }, [samples, reference]);

  const sorted = useMemo(() => {
    const out = [...rows];
    out.sort((a, b) => {
      if (sortKey === 'day') return desc ? b.day.localeCompare(a.day) : a.day.localeCompare(b.day);
      const av = (a[sortKey] as number) ?? 0;
      const bv = (b[sortKey] as number) ?? 0;
      return desc ? bv - av : av - bv;
    });
    return out;
  }, [rows, sortKey, desc]);

  const toggle = (k: SortKey) => {
    if (k === sortKey) setDesc((d) => !d);
    else {
      setSortKey(k);
      setDesc(k !== 'day');
    }
  };

  const Th = ({ k, label, right }: { k: SortKey; label: string; right?: boolean }) => (
    <th onClick={() => toggle(k)} className={['cursor-pointer select-none px-3 py-2 font-medium', right ? 'text-right' : ''].join(' ')}>
      {label}
      {sortKey === k ? <span className="ml-1 text-ink-faint">{desc ? '▼' : '▲'}</span> : null}
    </th>
  );

  return (
    <section className="card overflow-hidden">
      <header className="flex items-center gap-2 border-b border-panel-border px-5 py-3">
        <TableIcon className="text-base text-accent" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink">Daily Analysis</h2>
        <button
          type="button"
          onClick={() =>
            exportRowsCsv(
              'daily_analysis',
              ['Date', 'Avg Gap', 'Max', 'Min', 'Largest Expansion', 'Largest Compression', 'Positions', 'Avg Recovery (s)', 'Confidence'],
              rows.map((r) => [
                r.day, fmtNumber(r.avg, 3), fmtNumber(r.max, 3), fmtNumber(r.min, 3),
                Number(r.expansion.toFixed(3)), Number(r.compression.toFixed(3)),
                r.positions, r.avgRecoverySec === null ? '' : Math.round(r.avgRecoverySec), r.confidence,
              ]),
            )
          }
          className="btn ml-auto px-2 py-1 text-xs"
          disabled={rows.length === 0}
        >
          Export CSV
        </button>
      </header>
      {rows.length === 0 ? (
        <div className="p-6 text-center text-sm text-ink-muted">No daily data.</div>
      ) : (
        <div className="max-h-[24rem] overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 z-10 bg-panel text-xs uppercase tracking-wide text-ink-faint">
              <tr>
                <Th k="day" label="Date" />
                <Th k="avg" label="Avg Gap" right />
                <Th k="max" label="Max" right />
                <Th k="min" label="Min" right />
                <Th k="expansion" label="Largest Expansion" right />
                <Th k="compression" label="Largest Compression" right />
                <Th k="positions" label="Positions" right />
                <th className="px-3 py-2 text-right font-medium">Avg Recovery</th>
                <th className="px-3 py-2 font-medium">Confidence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-panel-border font-mono text-xs">
              {sorted.map((r) => (
                <tr key={r.day} className="hover:bg-panel/50">
                  <td className="px-3 py-1.5 text-ink">{r.day}</td>
                  <td className="px-3 py-1.5 text-right text-accent">{fmtNumber(r.avg, 3)}</td>
                  <td className="px-3 py-1.5 text-right text-positive">{fmtNumber(r.max, 3)}</td>
                  <td className="px-3 py-1.5 text-right text-negative">{fmtNumber(r.min, 3)}</td>
                  <td className="px-3 py-1.5 text-right text-warning">{fmtNumber(r.expansion, 3)}</td>
                  <td className="px-3 py-1.5 text-right text-positive">{fmtNumber(r.compression, 3)}</td>
                  <td className="px-3 py-1.5 text-right text-ink-muted">{fmtInt(r.positions)}</td>
                  <td className="px-3 py-1.5 text-right text-ink-muted">{fmtDuration(r.avgRecoverySec)}</td>
                  <td className="px-3 py-1.5 font-sans text-ink-muted">{r.confidence}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
