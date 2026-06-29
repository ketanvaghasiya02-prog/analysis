/**
 * Data-quality warnings panel (Phase R12).
 */

import { useMemo } from 'react';
import { useData } from '@/context/DataContext';
import {
  buildWarnings,
  DEFAULT_WARNING_THRESHOLDS,
  type DataWarning,
} from '@/utils/highlights';
import { AlertIcon } from '@/components/common/icons';

const LEVEL_STYLE: Record<DataWarning['level'], string> = {
  info: 'border-accent/30 bg-accent/5 text-accent',
  warning: 'border-warning/30 bg-warning/5 text-warning',
  critical: 'border-negative/30 bg-negative/5 text-negative',
};

export function WarningsPanel() {
  const { filteredSamples, gapZones, events, recoverySettings } = useData();

  const warnings = useMemo(
    () =>
      buildWarnings(filteredSamples, gapZones, events.events, {
        ...DEFAULT_WARNING_THRESHOLDS,
        minEventsPerZone: recoverySettings.minEventsPerZone,
      }),
    [filteredSamples, gapZones, events.events, recoverySettings.minEventsPerZone],
  );

  if (warnings.length === 0) return null;

  return (
    <section className="space-y-2">
      {warnings.map((w, i) => (
        <div
          key={`${w.title}-${i}`}
          className={[
            'flex items-start gap-3 rounded-lg border p-3',
            LEVEL_STYLE[w.level],
          ].join(' ')}
        >
          <AlertIcon className="mt-0.5 text-base" />
          <div>
            <div className="text-sm font-semibold">{w.title}</div>
            <div className="text-xs text-ink-muted">{w.detail}</div>
          </div>
        </div>
      ))}
    </section>
  );
}
