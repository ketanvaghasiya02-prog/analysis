/**
 * Stop-Loss Research page (Phase R7).
 *
 * RESEARCH ONLY — presents statistical evidence about how stop-loss gap levels
 * would have interacted with historical zone events. It does not generate
 * trading signals or tell anyone to take a trade.
 *
 * Composition: disclaimer · zone selector · SL settings · suggested SL evidence
 * cards · survival table · survival curve. Derived from the shared events /
 * zones / filteredSamples — no CSV is re-parsed.
 */

import { useMemo } from 'react';
import { useData } from '@/context/DataContext';
import { buildMaeAnalysis, type ZoneMae } from '@/utils/mae';
import {
  buildSurvivalCurve,
  suggestedStopLosses,
} from '@/utils/stoploss';
import { SuggestedSlCards } from '@/components/stoploss/SuggestedSlCards';
import { SurvivalTable } from '@/components/stoploss/SurvivalTable';
import { SurvivalChart } from '@/components/stoploss/SurvivalChart';
import { fmtInt } from '@/utils/format';
import { AlertIcon, LayersIcon } from '@/components/common/icons';

export function StopLossView() {
  const {
    filteredSamples,
    gapZones,
    events,
    selectedZoneId,
    toggleZone,
    selectZone,
    slSettings,
    updateSlSettings,
    resetSlSettings,
  } = useData();

  const analysis = useMemo(
    () => buildMaeAnalysis(filteredSamples, gapZones, events.events),
    [filteredSamples, gapZones, events.events],
  );

  const selected: ZoneMae | undefined = useMemo(
    () => analysis.zones.find((z) => z.zoneId === selectedZoneId),
    [analysis.zones, selectedZoneId],
  );

  const curve = useMemo(
    () => (selected ? buildSurvivalCurve(selected, slSettings) : null),
    [selected, slSettings],
  );

  const suggestions = useMemo(
    () => (selected ? suggestedStopLosses(selected) : []),
    [selected],
  );

  const highlight = suggestions
    .map((s) => s.slLevel)
    .filter((v): v is number => v !== null);

  return (
    <div className="space-y-5">
      {/* Research disclaimer */}
      <section className="card flex items-start gap-3 border-warning/30 bg-warning/5 p-4">
        <AlertIcon className="mt-0.5 text-base text-warning" />
        <p className="text-sm leading-relaxed text-ink">
          <span className="font-semibold">Statistical research only.</span> This
          page shows how different stop-loss gap levels would have interacted
          with historical zone events. It is not financial advice, produces no
          trading signals, and does not suggest taking any position — it only
          quantifies what happened in the data.
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
                  title={`${fmtInt(z.totalEvents)} events`}
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

      {selected && curve ? (
        <>
          {/* SL settings */}
          <section className="card p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="stat-label">Stop-Loss Sweep</span>
              <button
                type="button"
                onClick={resetSlSettings}
                className="btn px-2 py-1"
              >
                Auto-fit
              </button>
            </div>
            <div className="flex flex-wrap gap-5">
              <label className="flex flex-col gap-1">
                <span className="stat-label">SL Start Gap</span>
                <input
                  type="number"
                  step="any"
                  value={slSettings.start ?? ''}
                  placeholder={curve.effectiveStart.toFixed(2)}
                  onChange={(e) =>
                    updateSlSettings({
                      start: e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                  className="w-32 rounded-md border border-panel-border bg-panel px-3 py-1.5 text-sm text-ink focus:border-accent focus:outline-none"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="stat-label">SL End Gap</span>
                <input
                  type="number"
                  step="any"
                  value={slSettings.end ?? ''}
                  placeholder={curve.effectiveEnd.toFixed(2)}
                  onChange={(e) =>
                    updateSlSettings({
                      end: e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                  className="w-32 rounded-md border border-panel-border bg-panel px-3 py-1.5 text-sm text-ink focus:border-accent focus:outline-none"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="stat-label">SL Step</span>
                <input
                  type="number"
                  step="any"
                  min={0.01}
                  value={slSettings.step}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (v > 0) updateSlSettings({ step: v });
                  }}
                  className="w-32 rounded-md border border-panel-border bg-panel px-3 py-1.5 text-sm text-ink focus:border-accent focus:outline-none"
                />
              </label>
            </div>
          </section>

          <SuggestedSlCards suggestions={suggestions} />
          <SurvivalTable rows={curve.rows} highlight={highlight} />
          <SurvivalChart rows={curve.rows} />
        </>
      ) : (
        <section className="card flex items-center justify-center gap-2 p-8 text-center text-sm text-ink-muted">
          <LayersIcon className="text-base text-ink-faint" />
          Select a zone above to run the stop-loss survival sweep.
        </section>
      )}
    </div>
  );
}
