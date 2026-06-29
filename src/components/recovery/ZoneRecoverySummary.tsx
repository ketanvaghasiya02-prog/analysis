/**
 * Aggregate recovery summary for the selected zone (Phase R5).
 *
 * Recovery to the zone low: total events, recovered count, probability, and the
 * distance / time distributions.
 */

import type { ZoneRecovery } from '@/utils/recovery';
import { recoveryBand } from '@/utils/recovery';
import { fmtDuration, fmtInt, fmtNumber, fmtPercent } from '@/utils/format';
import { LayersIcon, AlertIcon } from '@/components/common/icons';

const BAND_TEXT = {
  high: 'text-positive',
  mid: 'text-warning',
  low: 'text-negative',
} as const;

function Metric({
  label,
  value,
  tone = 'text-ink',
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="rounded-md border border-panel-border bg-panel p-3">
      <div className="stat-label">{label}</div>
      <div className={['mt-1 font-mono text-lg font-semibold', tone].join(' ')}>
        {value}
      </div>
    </div>
  );
}

export function ZoneRecoverySummary({ zone }: { zone: ZoneRecovery }) {
  const band = recoveryBand(zone.recoveryProbabilityPct);

  return (
    <section className="card p-5">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <LayersIcon className="text-base text-accent" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink">
            Recovery to Zone Low
          </h2>
        </div>
        <span className="font-mono text-xs text-ink-faint">
          Zone {zone.label}
        </span>
      </header>

      {!zone.meetsMinEvents && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning">
          <AlertIcon className="text-sm" />
          Only {fmtInt(zone.totalEvents)} events — below the minimum-events
          threshold; treat these statistics as low-confidence.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        <Metric label="Total Events" value={fmtInt(zone.totalEvents)} />
        <Metric
          label="Recovered to Low"
          value={fmtInt(zone.recoveredToLow)}
          tone="text-positive"
        />
        <Metric
          label="Recovery Probability"
          value={fmtPercent(zone.recoveryProbabilityPct)}
          tone={`${BAND_TEXT[band]} `}
        />
        <Metric
          label="Avg Recovery Time"
          value={fmtDuration(zone.avgTimeSec)}
        />
        <Metric
          label="Avg Recovery Distance"
          value={fmtNumber(zone.avgDistance, 3)}
          tone="text-accent"
        />
        <Metric
          label="Median Distance"
          value={fmtNumber(zone.medianDistance, 3)}
        />
        <Metric
          label="Max Distance"
          value={fmtNumber(zone.maxDistance, 3)}
        />
        <Metric
          label="Median Recovery Time"
          value={fmtDuration(zone.medianTimeSec)}
        />
        <Metric label="Max Recovery Time" value={fmtDuration(zone.maxTimeSec)} />
      </div>
    </section>
  );
}
