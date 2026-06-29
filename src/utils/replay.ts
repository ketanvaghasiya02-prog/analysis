/**
 * Historical Evidence Replay (Phase 11F) — read-only path reconstruction.
 *
 * Rebuilds the chronological gap path of ONE stored occurrence directly from the
 * uploaded CSV samples (the same data the research was computed from). It does
 * NOT rerun the Research Engine, does NOT simulate, and does NOT predict — it
 * only locates the historical samples for the occurrence window and reads their
 * gap values so the replay can show exactly what happened.
 *
 * The outcome and the level definitions come from the stored repository record;
 * event positions are located by reading the actual sample gaps (descriptive
 * visualization, not re-simulation).
 */

import type { GapSample } from '@/types/gap';
import { OUTCOME_LABELS, type ScenarioOutcome } from '@/utils/scenario';
import type { OccurrenceRecord } from '@/utils/strategyExecution';
import type { RepositoryRecord } from '@/utils/researchRepository';
import type { SerializedExport } from '@/utils/reports';

const EPS = 1e-9;
const LOOKBACK_SEC = 300; // a little context before entry, for the chart

export interface ReplaySample {
  pos: number;
  globalIndex: number;
  timestampMs: number | null;
  time: string;
  gap: number;
  /** Seconds since entry (negative for the pre-entry lookback). */
  elapsedSec: number;
  /** gap − entryGap (adverse expansion above entry). */
  expansion: number;
  /** entryGap − gap (favourable compression toward recovery). */
  compression: number;
}

export interface ReplayMarkers {
  entryPos: number | null;
  maxExpansionPos: number | null;
  recoveryStartPos: number | null;
  recoveryPos: number | null;
  slPos: number | null;
  exitPos: number | null;
}

export interface ReplayTimeline {
  found: boolean;
  samples: ReplaySample[];
  markers: ReplayMarkers;
  levels: { entry: number; recovery: number; stopLoss: number };
  outcome: ScenarioOutcome;
  outcomeLabel: string;
  durationSec: number;
  occurrence: OccurrenceRecord;
}

/** Locates the entry sample for an occurrence (by day + server time). */
function findEntryIndex(samples: GapSample[], occ: OccurrenceRecord): number {
  // Exact match on the captured entry server time + day.
  let idx = samples.findIndex((s) => s.dayKey === occ.date && s.serverTime === occ.time);
  if (idx !== -1) return idx;
  // Fallback: same day, gap closest to the recorded entry gap.
  let best = -1;
  let bestDelta = Infinity;
  for (let i = 0; i < samples.length; i += 1) {
    const s = samples[i]!;
    if (s.dayKey !== occ.date || s.gap === null) continue;
    const d = Math.abs(s.gap - occ.entryGap);
    if (d < bestDelta) {
      bestDelta = d;
      best = i;
    }
  }
  return bestDelta <= 0.01 ? best : -1;
}

/**
 * Builds the replay timeline for one occurrence. Returns found=false when the
 * occurrence's samples cannot be located in the currently loaded dataset.
 */
export function buildReplay(
  samples: GapSample[],
  record: RepositoryRecord,
  occ: OccurrenceRecord,
): ReplayTimeline {
  const levels = { entry: record.entryGap, recovery: record.recoveryGap, stopLoss: record.stopLoss };
  const outcomeLabel = OUTCOME_LABELS[occ.outcome];
  const durationSec = occ.holdingSec ?? occ.recoveryTimeSec ?? 0;

  const entryIdx = findEntryIndex(samples, occ);
  if (entryIdx === -1) {
    return {
      found: false,
      samples: [],
      markers: { entryPos: null, maxExpansionPos: null, recoveryStartPos: null, recoveryPos: null, slPos: null, exitPos: null },
      levels,
      outcome: occ.outcome,
      outcomeLabel,
      durationSec,
      occurrence: occ,
    };
  }

  const entry = samples[entryIdx]!;
  const entryTs = entry.timestampMs;

  // Pre-entry lookback (same day) for chart context.
  let startIdx = entryIdx;
  if (entryTs !== null) {
    const cutoff = entryTs - LOOKBACK_SEC * 1000;
    while (startIdx > 0) {
      const prev = samples[startIdx - 1]!;
      if (prev.dayKey !== entry.dayKey) break;
      if (prev.timestampMs !== null && prev.timestampMs < cutoff) break;
      startIdx -= 1;
    }
  }

  // Forward window: entry → exit (bounded by the stored duration).
  const out: ReplaySample[] = [];
  let entryPos: number | null = null;
  for (let g = startIdx; g < samples.length; g += 1) {
    const s = samples[g]!;
    if (s.dayKey !== entry.dayKey && record.sameDayOnly) break;
    if (s.gap === null) continue;
    const elapsedSec =
      entryTs !== null && s.timestampMs !== null ? (s.timestampMs - entryTs) / 1000 : 0;
    // Stop once we pass the exit (after entry only).
    if (g > entryIdx && elapsedSec > durationSec + 0.5) break;
    if (g === entryIdx) entryPos = out.length;
    out.push({
      pos: out.length,
      globalIndex: g,
      timestampMs: s.timestampMs,
      time: s.serverTime,
      gap: s.gap,
      elapsedSec,
      expansion: s.gap - levels.entry,
      compression: levels.entry - s.gap,
    });
  }

  // Locate event positions by reading the actual gaps (read-only).
  let maxExpansionPos: number | null = null;
  let maxGap = -Infinity;
  let slPos: number | null = null;
  let recoveryPos: number | null = null;
  const afterEntry = entryPos ?? 0;
  for (let p = afterEntry; p < out.length; p += 1) {
    const g = out[p]!.gap;
    if (p >= afterEntry && g > maxGap) {
      maxGap = g;
      maxExpansionPos = p;
    }
    if (slPos === null && p > afterEntry && g >= levels.stopLoss - EPS) slPos = p;
    if (recoveryPos === null && p > afterEntry && g <= levels.recovery + EPS) recoveryPos = p;
  }

  // Recovery "starts" at the maximum expansion (the turning point toward recovery).
  const recoveryStartPos =
    recoveryPos !== null && maxExpansionPos !== null && maxExpansionPos <= recoveryPos
      ? maxExpansionPos
      : null;

  return {
    found: true,
    samples: out,
    markers: {
      entryPos,
      maxExpansionPos,
      recoveryStartPos,
      recoveryPos,
      slPos,
      exitPos: out.length > 0 ? out.length - 1 : null,
    },
    levels,
    outcome: occ.outcome,
    outcomeLabel,
    durationSec,
    occurrence: occ,
  };
}

// --- export -------------------------------------------------------------------

function csvCell(v: string | number | null): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const r3 = (n: number) => Math.round(n * 1000) / 1000;

const CSV_COLUMNS = ['Pos', 'Time', 'Elapsed (s)', 'Gap', 'Expansion', 'Compression', 'Marker'];

function markerLabel(t: ReplayTimeline, pos: number): string {
  const m = t.markers;
  const labels: string[] = [];
  if (m.entryPos === pos) labels.push('Entry');
  if (m.maxExpansionPos === pos) labels.push('Max Expansion');
  if (m.recoveryStartPos === pos) labels.push('Recovery Start');
  if (m.recoveryPos === pos) labels.push('Recovery');
  if (m.slPos === pos) labels.push('Stop Loss');
  if (m.exitPos === pos && m.recoveryPos !== pos) labels.push('Exit');
  return labels.join(' / ');
}

export function replayCsv(t: ReplayTimeline): SerializedExport {
  const lines = [CSV_COLUMNS.map(csvCell).join(',')];
  for (const s of t.samples) {
    lines.push(
      [s.pos, s.time, Math.round(s.elapsedSec), r3(s.gap), r3(s.expansion), r3(s.compression), markerLabel(t, s.pos)]
        .map(csvCell)
        .join(','),
    );
  }
  return {
    filename: `Replay_${t.occurrence.date}_${t.occurrence.time.replace(/[: ]/g, '-')}.csv`,
    content: lines.join('\n'),
    mime: 'text/csv',
  };
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Opens a printable replay summary (save as PDF from the print dialog). */
export function printReplayPdf(
  t: ReplayTimeline,
  record: RepositoryRecord,
  generatedAt: string,
): void {
  const m = t.markers;
  const at = (pos: number | null) => (pos !== null && t.samples[pos] ? esc(t.samples[pos]!.time) : '—');
  const rows = t.samples
    .map(
      (s) =>
        `<tr><td>${s.pos}</td><td>${esc(s.time)}</td><td>${Math.round(s.elapsedSec)}</td><td>${r3(s.gap)}</td><td>${esc(markerLabel(t, s.pos))}</td></tr>`,
    )
    .join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"/>
<title>Replay Summary</title>
<style>
  body{font-family:Inter,system-ui,sans-serif;color:#0b1220;margin:24px;font-size:12px}
  h1{font-size:18px;margin:0 0 4px} h2{font-size:14px;margin:16px 0 6px}
  .note{color:#64748b;font-size:11px;margin-bottom:12px}
  table{border-collapse:collapse;width:100%} th,td{border:1px solid #cbd5e1;padding:3px 6px;text-align:right;font-variant-numeric:tabular-nums}
  th{background:#f1f5f9} td:nth-child(2),td:last-child,th:nth-child(2),th:last-child{text-align:left}
  @media print{body{margin:0}}
</style></head><body>
<h1>Historical Evidence Replay — ${esc(record.id)}</h1>
<div class="note">Generated ${esc(generatedAt)}. Read-only replay of one historical occurrence — not a simulation, prediction or trading signal.</div>
<div>Entry ${record.entryGap} · Recovery ${record.recoveryGap} · Stop Loss ${record.stopLoss} · Session ${esc(t.occurrence.session)} · Date ${esc(t.occurrence.date)}</div>
<div>Outcome: ${esc(t.outcomeLabel)}</div>
<h2>Event Times</h2>
<div>Entry ${at(m.entryPos)} · Max Expansion ${at(m.maxExpansionPos)} · Recovery Start ${at(m.recoveryStartPos)} · Recovery ${at(m.recoveryPos)} · Stop Loss ${at(m.slPos)} · Exit ${at(m.exitPos)}</div>
<h2>Replay Samples (${t.samples.length})</h2>
<table><thead><tr><th>Pos</th><th>Time</th><th>Elapsed (s)</th><th>Gap</th><th>Marker</th></tr></thead><tbody>${rows}</tbody></table>
</body></html>`;
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 250);
}
