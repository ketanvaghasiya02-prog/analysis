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
import { LayersIcon } from '@/components/common/icons';

export function SessionView() {
  const { filteredSamples, gapZones, events } = useData();

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
      <SessionComparisonCards sessions={analysis.sessions} />
      <SessionCharts sessions={analysis.sessions} />
      <ZoneBySessionTable sessions={analysis.sessions} />
    </div>
  );
}
