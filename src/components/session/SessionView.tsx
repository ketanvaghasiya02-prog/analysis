/**
 * Session Analysis page (Phase R10).
 *
 *  - Session comparison cards
 *  - Session recovery bar chart + worst-gap bar chart
 *  - Zone-by-session table
 *
 * Derived from the shared events / zones / filteredSamples — no CSV is re-parsed.
 */

import { useMemo } from 'react';
import { useData } from '@/context/DataContext';
import { buildSessionAnalysis } from '@/utils/sessions';
import { SessionComparisonCards } from '@/components/session/SessionComparisonCards';
import { SessionCharts } from '@/components/session/SessionCharts';
import { ZoneBySessionTable } from '@/components/session/ZoneBySessionTable';
import { InfoTip } from '@/components/common/InfoTip';
import { fmtNumber } from '@/utils/format';
import { ClockIcon, LayersIcon } from '@/components/common/icons';

export function SessionView() {
  const { filteredSamples, gapZones, events, gapBinSize } = useData();

  const analysis = useMemo(
    () => buildSessionAnalysis(filteredSamples, gapZones, events.events),
    [filteredSamples, gapZones, events.events],
  );

  if (analysis.sessions.length === 0) {
    return (
      <section className="card flex items-center justify-center gap-2 p-8 text-center text-sm text-ink-muted">
        <LayersIcon className="text-base text-ink-faint" />
        No session data for the current selection.
      </section>
    );
  }

  return (
    <div className="space-y-5">
      {/* Methodology banner — same-day recovery, no Stop Loss, zone size (Parts 5/8/9). */}
      <section className="card flex flex-wrap items-center gap-x-4 gap-y-2 border-accent/30 bg-accent/5 px-4 py-3 text-sm">
        <span className="flex items-center gap-2 font-semibold text-ink">
          <ClockIcon className="text-base text-accent" /> Same-Day Recovery analysis
        </span>
        <span className="flex items-center text-ink-muted">
          Zone Size: <span className="ml-1 font-mono text-ink">{fmtNumber(gapBinSize, 2)}</span>
          <InfoTip text="Changing zone size changes events, zones and recovery statistics." />
        </span>
        <span className="flex items-center text-ink-muted">
          Same-Day Recovery %
          <InfoTip text="Same-Day Recovery % = events where the gap returned to the zone low on the same trading day. Stop Loss is not used on this page." />
        </span>
        <span className="ml-auto text-[11px] text-ink-faint">Stop Loss is not used on this page.</span>
      </section>

      <SessionComparisonCards sessions={analysis.sessions} />
      <SessionCharts sessions={analysis.sessions} />
      <ZoneBySessionTable sessions={analysis.sessions} />
    </div>
  );
}
