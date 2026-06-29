/**
 * Recovery Matrix page (Phase R5).
 *
 *  - Recovery settings (target step, minimum target gap, minimum events/zone)
 *  - Zone selector with colour-coded recovery probability per zone
 *  - For the selected zone: aggregate recovery summary + recovery-target matrix
 *
 * The recovery analysis is derived here (only while this page is mounted) from
 * the shared events / zones / filteredSamples — no CSV is re-parsed.
 */

import { useMemo } from 'react';
import { useData } from '@/context/DataContext';
import {
  buildRecoveryAnalysis,
  recoveryBand,
  type ZoneRecovery,
} from '@/utils/recovery';
import { ZoneRecoverySummary } from '@/components/recovery/ZoneRecoverySummary';
import { RecoveryMatrixTable } from '@/components/recovery/RecoveryMatrixTable';
import { fmtInt, fmtPercent } from '@/utils/format';
import { LayersIcon } from '@/components/common/icons';

const BAND_CHIP = {
  high: 'border-positive/50 text-positive',
  mid: 'border-warning/50 text-warning',
  low: 'border-negative/50 text-negative',
} as const;

function NumberSetting({
  label,
  value,
  onChange,
  step,
  min,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step: number;
  min: number;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="stat-label">{label}</span>
      <input
        type="number"
        value={value}
        step={step}
        min={min}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v)) onChange(v);
        }}
        className="w-32 rounded-md border border-panel-border bg-panel px-3 py-1.5 text-sm text-ink focus:border-accent focus:outline-none"
      />
    </label>
  );
}

export function RecoveryView() {
  const {
    filteredSamples,
    gapZones,
    events,
    recoverySettings,
    updateRecoverySettings,
    resetRecoverySettings,
    selectedZoneId,
    toggleZone,
    selectZone,
  } = useData();

  const analysis = useMemo(
    () =>
      buildRecoveryAnalysis(
        filteredSamples,
        gapZones,
        events.events,
        recoverySettings,
      ),
    [filteredSamples, gapZones, events.events, recoverySettings],
  );

  const selected: ZoneRecovery | undefined = useMemo(
    () => analysis.zones.find((z) => z.zoneId === selectedZoneId),
    [analysis.zones, selectedZoneId],
  );

  return (
    <div className="space-y-5">
      {/* Settings */}
      <section className="card p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LayersIcon className="text-base text-accent" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink">
              Recovery Settings
            </h2>
          </div>
          <button type="button" onClick={resetRecoverySettings} className="btn px-2 py-1">
            Reset
          </button>
        </div>
        <div className="flex flex-wrap gap-5">
          <NumberSetting
            label="Recovery Target Step"
            value={recoverySettings.step}
            onChange={(step) => step > 0 && updateRecoverySettings({ step })}
            step={0.1}
            min={0.01}
          />
          <NumberSetting
            label="Min Recovery Target Gap"
            value={recoverySettings.minTargetGap}
            onChange={(minTargetGap) => updateRecoverySettings({ minTargetGap })}
            step={0.5}
            min={0}
          />
          <NumberSetting
            label="Min Events per Zone"
            value={recoverySettings.minEventsPerZone}
            onChange={(minEventsPerZone) =>
              minEventsPerZone >= 0 &&
              updateRecoverySettings({ minEventsPerZone })
            }
            step={1}
            min={0}
          />
        </div>
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
              const band = recoveryBand(z.recoveryProbabilityPct);
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
                  <span className={['font-mono', BAND_CHIP[band]].join(' ')}>
                    {fmtPercent(z.recoveryProbabilityPct)}
                  </span>
                  {!z.meetsMinEvents && (
                    <span className="text-[10px] uppercase text-ink-faint">
                      low n
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {selected ? (
        <>
          <ZoneRecoverySummary zone={selected} />
          <RecoveryMatrixTable zone={selected} />
        </>
      ) : (
        <section className="card p-8 text-center text-sm text-ink-muted">
          Select a zone above to view its recovery summary and target matrix.
        </section>
      )}
    </div>
  );
}
