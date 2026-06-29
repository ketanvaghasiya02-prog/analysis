/**
 * Settings page (Phase R12).
 *
 * Tunes the analysis parameters used across the app. Values are persisted to
 * localStorage by the data store, so they survive reloads.
 */

import { useData } from '@/context/DataContext';
import { ChipMultiSelect } from '@/components/filters/ChipMultiSelect';
import { InfoTip } from '@/components/common/InfoTip';

function NumberField({
  label,
  tooltip,
  value,
  step,
  min,
  onChange,
}: {
  label: string;
  tooltip: string;
  value: number;
  step: number;
  min: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="stat-label">
        {label}
        <InfoTip text={tooltip} />
      </span>
      <input
        type="number"
        value={value}
        step={step}
        min={min}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v)) onChange(v);
        }}
        className="w-40 rounded-md border border-panel-border bg-panel px-3 py-1.5 text-sm text-ink focus:border-accent focus:outline-none"
      />
    </label>
  );
}

export function SettingsView() {
  const {
    gapBinSize,
    setGapBinSize,
    recoverySettings,
    updateRecoverySettings,
    slSettings,
    updateSlSettings,
    filterOptions,
    defaultSessions,
    setDefaultSessions,
  } = useData();

  return (
    <div className="max-w-3xl space-y-5">
      <section className="card p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-ink">
          Analysis Parameters
        </h2>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <NumberField
            label="Gap Bin Size"
            tooltip="Width of each gap zone in the distribution / event engine."
            value={gapBinSize}
            step={0.05}
            min={0.01}
            onChange={setGapBinSize}
          />
          <NumberField
            label="Recovery Target Step"
            tooltip="Spacing between successive lower recovery targets in the recovery matrix."
            value={recoverySettings.step}
            step={0.1}
            min={0.01}
            onChange={(step) => step > 0 && updateRecoverySettings({ step })}
          />
          <NumberField
            label="Min Recovery Target Gap"
            tooltip="Lowest recovery target gap evaluated in the recovery matrix."
            value={recoverySettings.minTargetGap}
            step={0.5}
            min={0}
            onChange={(minTargetGap) => updateRecoverySettings({ minTargetGap })}
          />
          <NumberField
            label="Min Events per Zone"
            tooltip="Minimum events for a zone to be treated as statistically reliable. Drives reliability flags and warnings."
            value={recoverySettings.minEventsPerZone}
            step={1}
            min={0}
            onChange={(minEventsPerZone) =>
              minEventsPerZone >= 0 &&
              updateRecoverySettings({ minEventsPerZone })
            }
          />
          <NumberField
            label="Stop-Loss Step"
            tooltip="Spacing between SL levels in the stop-loss survival sweep."
            value={slSettings.step}
            step={0.1}
            min={0.01}
            onChange={(step) => step > 0 && updateSlSettings({ step })}
          />
        </div>
      </section>

      <section className="card p-5">
        <h2 className="mb-1 flex items-center text-sm font-semibold uppercase tracking-wide text-ink">
          Default Session Filter
          <InfoTip text="Sessions applied to the global filter when a dataset is loaded or cleared." />
        </h2>
        <p className="mb-3 text-xs text-ink-muted">
          {filterOptions && filterOptions.sessions.length > 0
            ? 'Select the sessions to pre-apply as the default filter.'
            : 'Load a dataset to choose from its available sessions.'}
        </p>
        <ChipMultiSelect
          label="Sessions"
          options={filterOptions?.sessions ?? defaultSessions}
          selected={defaultSessions}
          onChange={setDefaultSessions}
        />
      </section>

      <p className="text-xs text-ink-faint">
        Settings are saved to your browser's local storage and restored on your
        next visit.
      </p>
    </div>
  );
}
