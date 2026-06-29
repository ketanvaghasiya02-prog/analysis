/**
 * MAE Analysis page (Phase R6).
 *
 *  - Explanation banner (stop-loss rationale)
 *  - Zone selector
 *  - Recovered vs failed counts
 *  - Recovered MAE table + Failed MAE table
 *  - MAE distribution chart
 *
 * The MAE analysis is derived here (only while this page is mounted) from the
 * shared events / zones / filteredSamples — no CSV is re-parsed.
 */

import { useMemo } from 'react';
import { useData } from '@/context/DataContext';
import { buildMaeAnalysis, type ZoneMae } from '@/utils/mae';
import { MaeStatsTable } from '@/components/mae/MaeStatsTable';
import { MaeDistributionChart } from '@/components/mae/MaeDistributionChart';
import { fmtInt, fmtPercent } from '@/utils/format';
import { AlertIcon, LayersIcon } from '@/components/common/icons';

export function MaeView() {
  const {
    filteredSamples,
    gapZones,
    events,
    selectedZoneId,
    toggleZone,
    selectZone,
  } = useData();

  const analysis = useMemo(
    () => buildMaeAnalysis(filteredSamples, gapZones, events.events),
    [filteredSamples, gapZones, events.events],
  );

  const selected: ZoneMae | undefined = useMemo(
    () => analysis.zones.find((z) => z.zoneId === selectedZoneId),
    [analysis.zones, selectedZoneId],
  );

  const recoveredPct = selected
    ? selected.totalEvents > 0
      ? (selected.recovered.length / selected.totalEvents) * 100
      : 0
    : 0;

  return (
    <div className="space-y-5">
      {/* Explanation */}
      <section className="card flex items-start gap-3 border-accent/30 bg-accent/5 p-4">
        <AlertIcon className="mt-0.5 text-base text-accent" />
        <p className="text-sm leading-relaxed text-ink">
          Recovered events also need stop-loss room because many recover only
          after expanding first. Maximum Adverse Excursion measures the highest
          gap reached after entry — even for events that ultimately recover — so
          a stop placed too tight would be hit before the recovery arrives.
        </p>
      </section>

      {/* Zone selector */}
      <section className="card p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="stat-label">Select Zone</span>
          {selectedZoneId && (
            <button
              type="button"
              onClick={() => selectZone(null)}
              className="text-xs text-ink-faint transition-colors hover:text-accent"
            >
              clear
            </button>
          )}
        </div>

        {analysis.zones.length === 0 ? (
          <p className="text-sm text-ink-muted">
            No gap zones for the current selection.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {analysis.zones.map((z) => {
              const active = z.zoneId === selectedZoneId;
              return (
                <button
                  key={z.zoneId}
                  type="button"
                  onClick={() => toggleZone(z.zoneId)}
                  className={[
                    'flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs transition-colors',
                    active
                      ? 'border-accent/70 bg-accent/10'
                      : 'border-panel-border bg-panel hover:border-accent/40',
                  ].join(' ')}
                >
                  <span className="font-mono text-ink">{z.label}</span>
                  <span className="font-mono text-positive">
                    {fmtInt(z.recovered.length)}
                  </span>
                  <span className="text-ink-faint">/</span>
                  <span className="font-mono text-negative">
                    {fmtInt(z.failed.length)}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {selected ? (
        <>
          {/* Split summary */}
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="card p-4">
              <div className="stat-label">Total Events</div>
              <div className="stat-value mt-1">{fmtInt(selected.totalEvents)}</div>
            </div>
            <div className="card p-4">
              <div className="stat-label">Recovered</div>
              <div className="stat-value mt-1 text-positive">
                {fmtInt(selected.recovered.length)}
              </div>
            </div>
            <div className="card p-4">
              <div className="stat-label">Failed</div>
              <div className="stat-value mt-1 text-negative">
                {fmtInt(selected.failed.length)}
              </div>
            </div>
            <div className="card p-4">
              <div className="stat-label">Recovery Rate</div>
              <div className="stat-value mt-1 text-accent">
                {fmtPercent(recoveredPct)}
              </div>
            </div>
          </section>

          {/* Tables */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <MaeStatsTable
              title="Recovered Events — Max Gap"
              stats={selected.recoveredStats}
              accent="bg-positive"
            />
            <MaeStatsTable
              title="Failed Events — Max Gap"
              stats={selected.failedStats}
              accent="bg-negative"
            />
          </div>

          {/* Distribution */}
          <MaeDistributionChart zone={selected} />
        </>
      ) : (
        <section className="card flex items-center justify-center gap-2 p-8 text-center text-sm text-ink-muted">
          <LayersIcon className="text-base text-ink-faint" />
          Select a zone above to view its MAE tables and distribution.
        </section>
      )}
    </div>
  );
}
