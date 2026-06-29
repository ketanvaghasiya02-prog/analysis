/**
 * Final-overview highlight cards (Phase R12).
 *
 * Headline conclusions: best/worst zones and suggested statistical SL levels.
 * Research evidence only — not trading recommendations.
 */

import { useMemo } from 'react';
import { useData } from '@/context/DataContext';
import { buildHighlights } from '@/utils/highlights';
import { fmtInt, fmtNumber, fmtPercent } from '@/utils/format';
import { InfoTip } from '@/components/common/InfoTip';

interface CardProps {
  label: string;
  tooltip: string;
  primary: string;
  secondary?: string;
  tone?: string;
}

function HighlightCard({ label, tooltip, primary, secondary, tone = 'text-ink' }: CardProps) {
  return (
    <div className="card p-4">
      <div className="stat-label">
        {label}
        <InfoTip text={tooltip} />
      </div>
      <div className={['mt-2 font-mono text-lg font-semibold', tone].join(' ')}>
        {primary}
      </div>
      {secondary ? (
        <div className="mt-0.5 text-xs text-ink-faint">{secondary}</div>
      ) : null}
    </div>
  );
}

export function HighlightCards() {
  const { filteredSamples, gapZones, events, recoverySettings } = useData();

  const h = useMemo(
    () =>
      buildHighlights(
        filteredSamples,
        gapZones,
        events.events,
        recoverySettings,
      ),
    [filteredSamples, gapZones, events.events, recoverySettings],
  );

  const hasAny = h.bestByRecovery || h.bestByRecoveryAndSize;
  if (!hasAny) return null;

  return (
    <section>
      <h2 className="stat-label mb-2">Research Highlights</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <HighlightCard
          label="Best Zone — Recovery %"
          tooltip="Zone with the highest probability of recovering back to its zone low."
          tone="text-positive"
          primary={h.bestByRecovery ? h.bestByRecovery.label : '—'}
          secondary={
            h.bestByRecovery
              ? `${fmtPercent(h.bestByRecovery.recoveryPct)} · ${fmtInt(h.bestByRecovery.events)} events`
              : undefined
          }
        />
        <HighlightCard
          label="Best Zone — Recovery + Size"
          tooltip="Highest recovery zone among those meeting the minimum-events threshold (more statistically reliable)."
          tone="text-positive"
          primary={h.bestByRecoveryAndSize ? h.bestByRecoveryAndSize.label : '—'}
          secondary={
            h.bestByRecoveryAndSize
              ? `${fmtPercent(h.bestByRecoveryAndSize.recoveryPct)} · ${fmtInt(h.bestByRecoveryAndSize.events)} events`
              : undefined
          }
        />
        <HighlightCard
          label="Lowest Risk Zone"
          tooltip="Zone with the smallest worst-case max gap after entry (least adverse excursion)."
          tone="text-accent"
          primary={h.lowestRisk ? h.lowestRisk.label : '—'}
          secondary={
            h.lowestRisk
              ? `worst gap ${fmtNumber(h.lowestRisk.worstMaxGap, 3)}`
              : undefined
          }
        />
        <HighlightCard
          label="Highest Risk Zone"
          tooltip="Zone with the largest worst-case max gap after entry (most adverse excursion)."
          tone="text-negative"
          primary={h.highestRisk ? h.highestRisk.label : '—'}
          secondary={
            h.highestRisk
              ? `worst gap ${fmtNumber(h.highestRisk.worstMaxGap, 3)}`
              : undefined
          }
        />
        <HighlightCard
          label="Suggested Aggressive SL"
          tooltip="Recovered P90 max gap of the most reliable zone. Statistical reference, not advice."
          tone="text-warning"
          primary={h.aggressiveSl ? fmtNumber(h.aggressiveSl.level, 2) : '—'}
          secondary={h.aggressiveSl ? `zone ${h.aggressiveSl.zoneLabel}` : undefined}
        />
        <HighlightCard
          label="Suggested Balanced SL"
          tooltip="Recovered P95 max gap of the most reliable zone. Statistical reference, not advice."
          tone="text-warning"
          primary={h.balancedSl ? fmtNumber(h.balancedSl.level, 2) : '—'}
          secondary={h.balancedSl ? `zone ${h.balancedSl.zoneLabel}` : undefined}
        />
        <HighlightCard
          label="Suggested Conservative SL"
          tooltip="Recovered P99 max gap of the most reliable zone. Statistical reference, not advice."
          tone="text-positive"
          primary={h.conservativeSl ? fmtNumber(h.conservativeSl.level, 2) : '—'}
          secondary={
            h.conservativeSl ? `zone ${h.conservativeSl.zoneLabel}` : undefined
          }
        />
      </div>
    </section>
  );
}
