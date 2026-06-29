/**
 * Section 4 — Gap Frequency Table (Overview 2.0). Sortable + CSV export.
 */

import { useMemo, useState } from 'react';
import type { FrequencyRow } from '@/utils/overviewStats';
import { fmtInt, fmtNumber, fmtPercent } from '@/utils/format';
import { exportRowsCsv } from '@/utils/chartExport';
import { TableIcon } from '@/components/common/icons';

type SortKey = 'gap' | 'occurrences' | 'percentage' | 'cumulative';

export function GapFrequencySection({ rows }: { rows: FrequencyRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('gap');
  const [desc, setDesc] = useState(false);

  const sorted = useMemo(() => {
    const out = [...rows];
    out.sort((a, b) => (desc ? b[sortKey] - a[sortKey] : a[sortKey] - b[sortKey]));
    return out;
  }, [rows, sortKey, desc]);

  const toggle = (k: SortKey) => {
    if (k === sortKey) setDesc((d) => !d);
    else {
      setSortKey(k);
      setDesc(false);
    }
  };

  const Th = ({ k, label, right }: { k: SortKey; label: string; right?: boolean }) => (
    <th
      onClick={() => toggle(k)}
      className={[
        'cursor-pointer select-none px-3 py-2 font-medium',
        right ? 'text-right' : '',
      ].join(' ')}
    >
      {label}
      {sortKey === k ? <span className="ml-1 text-ink-faint">{desc ? '▼' : '▲'}</span> : null}
    </th>
  );

  return (
    <section className="card overflow-hidden">
      <header className="flex items-center gap-2 border-b border-panel-border px-5 py-3">
        <TableIcon className="text-base text-accent" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink">
          Gap Frequency Table
        </h2>
        <button
          type="button"
          onClick={() =>
            exportRowsCsv(
              'gap_frequency',
              ['Gap', 'Occurrences', 'Percentage', 'Cumulative %'],
              rows.map((r) => [
                Number(r.gap.toFixed(2)),
                r.occurrences,
                Number(r.percentage.toFixed(2)),
                Number(r.cumulative.toFixed(2)),
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
        <div className="p-6 text-center text-sm text-ink-muted">No gap data.</div>
      ) : (
        <div className="max-h-[24rem] overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 z-10 bg-panel text-xs uppercase tracking-wide text-ink-faint">
              <tr>
                <Th k="gap" label="Gap" />
                <Th k="occurrences" label="Occurrences" right />
                <Th k="percentage" label="Percentage" right />
                <Th k="cumulative" label="Cumulative %" right />
              </tr>
            </thead>
            <tbody className="divide-y divide-panel-border font-mono text-xs">
              {sorted.map((r) => (
                <tr key={r.gap} className="hover:bg-panel/50">
                  <td className="px-3 py-1.5 text-ink">{fmtNumber(r.gap, 2)}</td>
                  <td className="px-3 py-1.5 text-right text-ink-muted">{fmtInt(r.occurrences)}</td>
                  <td className="px-3 py-1.5 text-right text-accent">{fmtPercent(r.percentage)}</td>
                  <td className="px-3 py-1.5 text-right text-ink-muted">{fmtPercent(r.cumulative)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
