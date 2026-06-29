/**
 * Final-overview highlights & data-quality warnings (Phase R12).
 *
 * Aggregates the recovery and MAE engines into a small set of headline cards
 * (best/worst zones, suggested SL levels) and surfaces warnings when the data
 * is too thin or low-quality to support reliable conclusions.
 *
 * Pure — reuses the analysis engines; no CSV is re-parsed.
 */

import type { GapSample } from '@/types/gap';
import type { GapZone } from '@/utils/histogram';
import type { ZoneEvent } from '@/utils/events';
import { buildRecoveryAnalysis, type RecoverySettings } from '@/utils/recovery';
import { buildMaeAnalysis } from '@/utils/mae';
import { suggestedStopLosses } from '@/utils/stoploss';
import { syncQualityPct } from '@/utils/statistics';

export interface ZoneHighlight {
  zoneId: string;
  label: string;
  recoveryPct: number;
  events: number;
  worstMaxGap: number | null;
}

export interface SlHighlight {
  label: string;
  zoneLabel: string;
  level: number | null;
}

export interface Highlights {
  bestByRecovery: ZoneHighlight | null;
  bestByRecoveryAndSize: ZoneHighlight | null;
  lowestRisk: ZoneHighlight | null;
  highestRisk: ZoneHighlight | null;
  aggressiveSl: SlHighlight | null;
  balancedSl: SlHighlight | null;
  conservativeSl: SlHighlight | null;
}

export function buildHighlights(
  samples: GapSample[],
  zones: GapZone[],
  events: ZoneEvent[],
  recoverySettings: RecoverySettings,
): Highlights {
  const recovery = buildRecoveryAnalysis(samples, zones, events, recoverySettings);
  const mae = buildMaeAnalysis(samples, zones, events);

  const withEvents = recovery.zones.filter((z) => z.totalEvents > 0);
  const empty: Highlights = {
    bestByRecovery: null,
    bestByRecoveryAndSize: null,
    lowestRisk: null,
    highestRisk: null,
    aggressiveSl: null,
    balancedSl: null,
    conservativeSl: null,
  };
  if (withEvents.length === 0) return empty;

  const toHighlight = (zoneId: string): ZoneHighlight | null => {
    const rz = recovery.zones.find((z) => z.zoneId === zoneId);
    const mz = mae.zones.find((z) => z.zoneId === zoneId);
    if (!rz) return null;
    const worst =
      mz && (mz.recoveredStats.worst !== null || mz.failedStats.worst !== null)
        ? Math.max(
            mz.recoveredStats.worst ?? Number.NEGATIVE_INFINITY,
            mz.failedStats.worst ?? Number.NEGATIVE_INFINITY,
          )
        : null;
    return {
      zoneId,
      label: rz.label,
      recoveryPct: rz.recoveryProbabilityPct,
      events: rz.totalEvents,
      worstMaxGap: worst === Number.NEGATIVE_INFINITY ? null : worst,
    };
  };

  // Best by recovery % (tie-break more events).
  const bestRec = [...withEvents].sort(
    (a, b) =>
      b.recoveryProbabilityPct - a.recoveryProbabilityPct ||
      b.totalEvents - a.totalEvents,
  )[0]!;

  // Best by recovery + sample size: only zones meeting the min-events bar,
  // then highest recovery, tie-break by event count.
  const reliable = withEvents.filter((z) => z.meetsMinEvents);
  const bestRecSize = (reliable.length ? reliable : withEvents).sort(
    (a, b) =>
      b.recoveryProbabilityPct - a.recoveryProbabilityPct ||
      b.totalEvents - a.totalEvents,
  )[0]!;

  // Risk = worst max gap reached (larger = riskier). Compare via MAE.
  const risk = withEvents
    .map((z) => ({ z, h: toHighlight(z.zoneId) }))
    .filter((x): x is { z: typeof x.z; h: ZoneHighlight } => x.h !== null);
  const sortedRisk = [...risk].sort(
    (a, b) => (a.h.worstMaxGap ?? 0) - (b.h.worstMaxGap ?? 0),
  );
  const lowestRisk = sortedRisk[0]?.h ?? null;
  const highestRisk = sortedRisk[sortedRisk.length - 1]?.h ?? null;

  // Suggested SLs derived from the most reliable (best-by-size) zone.
  const refMae = mae.zones.find((z) => z.zoneId === bestRecSize.zoneId);
  const suggestions = refMae ? suggestedStopLosses(refMae) : [];
  const find = (style: string): SlHighlight | null => {
    const s = suggestions.find((x) => x.style === style);
    if (!s) return null;
    return { label: s.label, zoneLabel: bestRecSize.label, level: s.slLevel };
  };

  return {
    bestByRecovery: toHighlight(bestRec.zoneId),
    bestByRecoveryAndSize: toHighlight(bestRecSize.zoneId),
    lowestRisk,
    highestRisk,
    aggressiveSl: find('aggressive'),
    balancedSl: find('balanced'),
    conservativeSl: find('conservative'),
  };
}

export type WarningLevel = 'info' | 'warning' | 'critical';

export interface DataWarning {
  level: WarningLevel;
  title: string;
  detail: string;
}

export interface WarningThresholds {
  minSamples: number;
  minSyncPct: number;
  minEventsPerZone: number;
  minTotalEvents: number;
}

export const DEFAULT_WARNING_THRESHOLDS: WarningThresholds = {
  minSamples: 200,
  minSyncPct: 90,
  minEventsPerZone: 10,
  minTotalEvents: 30,
};

/** Produces data-quality warnings for the current filtered dataset. */
export function buildWarnings(
  samples: GapSample[],
  zones: GapZone[],
  events: ZoneEvent[],
  thresholds: WarningThresholds,
): DataWarning[] {
  const warnings: DataWarning[] = [];

  if (samples.length < thresholds.minSamples) {
    warnings.push({
      level: 'warning',
      title: 'Low sample size',
      detail: `Only ${samples.length.toLocaleString()} samples in view (below ${thresholds.minSamples.toLocaleString()}). Statistics may be unstable.`,
    });
  }

  const sync = syncQualityPct(samples);
  if (sync !== null && sync < thresholds.minSyncPct) {
    warnings.push({
      level: 'warning',
      title: 'Poor sync quality',
      detail: `Sync quality is ${sync.toFixed(1)}% (below ${thresholds.minSyncPct}%). Gap readings on out-of-sync ticks are less reliable.`,
    });
  }

  if (events.length < thresholds.minTotalEvents) {
    warnings.push({
      level: 'warning',
      title: 'Recovery analysis not reliable',
      detail: `Only ${events.length} zone events detected (below ${thresholds.minTotalEvents}). Recovery, MAE and stop-loss statistics are low-confidence.`,
    });
  }

  // Per-zone event counts.
  const countByZone = new Map<string, number>();
  for (const e of events) {
    countByZone.set(e.zoneId, (countByZone.get(e.zoneId) ?? 0) + 1);
  }
  const thinZones = zones.filter(
    (z) => (countByZone.get(z.id) ?? 0) > 0 &&
      (countByZone.get(z.id) ?? 0) < thresholds.minEventsPerZone,
  );
  if (thinZones.length > 0) {
    warnings.push({
      level: 'info',
      title: 'Zones with too few events',
      detail: `${thinZones.length} zone(s) have fewer than ${thresholds.minEventsPerZone} events (${thinZones
        .map((z) => z.label)
        .slice(0, 4)
        .join(', ')}${thinZones.length > 4 ? '…' : ''}). Treat their per-zone stats with caution.`,
    });
  }

  return warnings;
}
