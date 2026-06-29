/**
 * Zone-by-session table (Phase R10).
 *
 * One row per (session, zone): events, recovered, recovery % and worst max gap.
 */

import { useMemo } from 'react';
import type { SessionStat } from '@/utils/sessions';
import { fmtInt, fmtNumber, fmtPercent } from '@/utils/format';
import { TableIcon } from '@/components/common/icons';

interface Row {
  session: string;
  zoneLabel: string;
  events: number;
  recovered: number;
  recoveryPct: number;
  worstMaxGap: number | null;
}

function recoveryTone(pct: number): string {
  if (pct >= 90) return 'text-positive';
  if (pct >= 70) return 'text-warning';
  return 'text-negative';
}

export function ZoneBySessionTable({ sessions }: { sessions: SessionStat[] }) {
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (const s of sessions) {
      for (const z of s.zones) {
        out.push({
          session: s.session,
          zoneLabel: z.label,
          events: z.events,
          recovered: z.recovered,
          recoveryPct: z.recoveryPct,
          worstMaxGap: z.worstMaxGap,
        });
      }
    }
    return out;
  }, [sessions]);

  return (
    <section className="card overflow-hidden">
      <header className="flex items-center gap-2 border-b border-panel-border px-5 py-3">
        <TableIcon className="text-base text-accent" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink">
          Zone by Session
        </h2>
        <span className="ml-auto text-xs text-ink-faint">{rows.length} rows</span>
      </header>

      {rows.length === 0 ? (
        <div className="p-6 text-center text-sm text-ink-muted">
          No session/zone events for the current selection.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-panel text-xs uppercase tracking-wide text-ink-faint">
              <tr>
                <th className="px-3 py-2 font-medium">Session</th>
                <th className="px-3 py-2 font-medium">Zone</th>
                <th className="px-3 py-2 text-right font-medium">Events</th>
                <th className="px-3 py-2 text-right font-medium">Recovered</th>
                <th className="px-3 py-2 text-right font-medium">Recovery %</th>
                <th className="px-3 py-2 text-right font-medium">Worst Max Gap</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-panel-border font-mono text-xs">
              {rows.map((r) => (
                <tr key={`${r.session}-${r.zoneLabel}`} className="hover:bg-panel/50">
                  <td className="px-3 py-2 font-sans text-ink">{r.session}</td>
                  <td className="px-3 py-2 text-ink-muted">{r.zoneLabel}</td>
                  <td className="px-3 py-2 text-right text-ink-muted">
                    {fmtInt(r.events)}
                  </td>
                  <td className="px-3 py-2 text-right text-positive">
                    {fmtInt(r.recovered)}
                  </td>
                  <td
                    className={[
                      'px-3 py-2 text-right font-semibold',
                      recoveryTone(r.recoveryPct),
                    ].join(' ')}
                  >
                    {fmtPercent(r.recoveryPct)}
                  </td>
                  <td className="px-3 py-2 text-right text-negative">
                    {fmtNumber(r.worstMaxGap, 3)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
