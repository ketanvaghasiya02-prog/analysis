/**
 * Session-based recovery & risk analysis (Phase R10).
 *
 * Groups samples and zone events by their CurrentSession and computes, per
 * session: sample/event counts, recovery rate, recovery-time distribution,
 * worst max gap, average MAE, best/worst zone, failed-event count and sync
 * quality — plus a per-(session, zone) breakdown.
 *
 * Pure — reuses detected events + the MAE per-event helper; no CSV is re-parsed.
 */

import type { GapSample } from '@/types/gap';
import type { GapZone } from '@/utils/histogram';
import type { ZoneEvent } from '@/utils/events';
import { computeEventMae } from '@/utils/mae';
import { summarise, syncQualityPct } from '@/utils/statistics';

export interface SessionZoneStat {
  zoneId: string;
  label: string;
  events: number;
  recovered: number;
  recoveryPct: number;
  worstMaxGap: number | null;
}

export interface SessionStat {
  session: string;
  samples: number;
  events: number;
  recovered: number;
  failed: number;
  recoveryPct: number;
  avgRecoveryTimeSec: number | null;
  medianRecoveryTimeSec: number | null;
  worstMaxGap: number | null;
  /** Mean adverse expansion (max gap − entry gap) across the session's events. */
  avgMae: number | null;
  syncQualityPct: number | null;
  /** Highest-recovery zone in this session. */
  bestZone: SessionZoneStat | null;
  /** Lowest-recovery zone in this session. */
  worstZone: SessionZoneStat | null;
  zones: SessionZoneStat[];
}

export interface SessionAnalysis {
  sessions: SessionStat[];
}

interface EventRecord {
  zoneId: string;
  label: string;
  maxGap: number;
  adverseExpansion: number;
  recovered: boolean;
  recoveryTimeSec: number | null;
}

function buildZoneStats(records: EventRecord[]): SessionZoneStat[] {
  const byZone = new Map<string, EventRecord[]>();
  for (const r of records) {
    const list = byZone.get(r.zoneId);
    if (list) list.push(r);
    else byZone.set(r.zoneId, [r]);
  }

  const stats: SessionZoneStat[] = [];
  for (const [zoneId, group] of byZone) {
    const recovered = group.filter((r) => r.recovered).length;
    const worst = group.reduce(
      (m, r) => (m === null || r.maxGap > m ? r.maxGap : m),
      null as number | null,
    );
    stats.push({
      zoneId,
      label: group[0]!.label,
      events: group.length,
      recovered,
      recoveryPct: group.length ? (recovered / group.length) * 100 : 0,
      worstMaxGap: worst,
    });
  }
  // Sort by zone label for stable display.
  stats.sort((a, b) => a.label.localeCompare(b.label));
  return stats;
}

/** Picks the best (highest-recovery) and worst (lowest-recovery) zones. */
function pickBestWorst(zones: SessionZoneStat[]): {
  best: SessionZoneStat | null;
  worst: SessionZoneStat | null;
} {
  if (zones.length === 0) return { best: null, worst: null };
  let best = zones[0]!;
  let worst = zones[0]!;
  for (const z of zones) {
    if (
      z.recoveryPct > best.recoveryPct ||
      (z.recoveryPct === best.recoveryPct && z.events > best.events)
    ) {
      best = z;
    }
    if (
      z.recoveryPct < worst.recoveryPct ||
      (z.recoveryPct === worst.recoveryPct && z.events > worst.events)
    ) {
      worst = z;
    }
  }
  return { best, worst };
}

/** Builds the full session analysis. */
export function buildSessionAnalysis(
  samples: GapSample[],
  zones: GapZone[],
  events: ZoneEvent[],
): SessionAnalysis {
  // Samples + sync quality per session.
  const samplesBySession = new Map<string, GapSample[]>();
  for (const s of samples) {
    const key = s.currentSession || 'UNKNOWN';
    const list = samplesBySession.get(key);
    if (list) list.push(s);
    else samplesBySession.set(key, [s]);
  }

  // Per-event MAE records grouped by entry session.
  //
  // Part 7: invalid events (entry tick not in-sync) are excluded so unreliable
  // crossings never affect Same-Day Recovery statistics. The global Sync filter
  // removes unsynced *samples* upstream; this guards the remaining quality flag.
  //
  // Part 6: recovery is defined by computeEventMae using the inclusive boundary
  // gap <= zone.low + EPS (mae.ts EPS = 1e-9), shared by every session metric.
  const zoneById = new Map(zones.map((z) => [z.id, z]));
  const recordsBySession = new Map<string, EventRecord[]>();
  for (const event of events) {
    if (event.quality === 'invalid') continue;
    const zone = zoneById.get(event.zoneId);
    if (!zone) continue;
    const mae = computeEventMae(samples, event, zone.low);
    const record: EventRecord = {
      zoneId: event.zoneId,
      label: zone.label,
      maxGap: mae.maxGap,
      adverseExpansion: mae.adverseExpansion,
      recovered: mae.recovered,
      recoveryTimeSec: mae.recoveryTimeSec,
    };
    const key = event.session || 'UNKNOWN';
    const list = recordsBySession.get(key);
    if (list) list.push(record);
    else recordsBySession.set(key, [record]);
  }

  const sessionKeys = new Set<string>([
    ...samplesBySession.keys(),
    ...recordsBySession.keys(),
  ]);

  const sessions: SessionStat[] = [...sessionKeys].map((session) => {
    const sSamples = samplesBySession.get(session) ?? [];
    const records = recordsBySession.get(session) ?? [];

    const recovered = records.filter((r) => r.recovered).length;
    const recTimes = records
      .filter((r) => r.recovered)
      .map((r) => r.recoveryTimeSec);
    const timeSummary = summarise(recTimes);
    const worstMaxGap = records.reduce(
      (m, r) => (m === null || r.maxGap > m ? r.maxGap : m),
      null as number | null,
    );
    const maeSummary = summarise(records.map((r) => r.adverseExpansion));

    const zoneStats = buildZoneStats(records);
    const { best, worst } = pickBestWorst(zoneStats);

    return {
      session,
      samples: sSamples.length,
      events: records.length,
      recovered,
      failed: records.length - recovered,
      recoveryPct: records.length ? (recovered / records.length) * 100 : 0,
      avgRecoveryTimeSec: timeSummary.mean,
      medianRecoveryTimeSec: timeSummary.median,
      worstMaxGap,
      avgMae: maeSummary.mean,
      syncQualityPct: syncQualityPct(sSamples),
      bestZone: best,
      worstZone: worst,
      zones: zoneStats,
    };
  });

  // Most active sessions first.
  sessions.sort((a, b) => b.samples - a.samples);
  return { sessions };
}
