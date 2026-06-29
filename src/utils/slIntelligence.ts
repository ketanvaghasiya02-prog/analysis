/**
 * Stop Loss Optimizer — Intelligence Layer (Phase 10C, read-only analysis).
 *
 * This module NEVER recomputes Research Engine or optimizer metrics. It reads
 * the already-computed optimizer rows (stopLoss, recoveryBeforeSlPct,
 * recoveryGain, riskIncrease, efficiency, slHitPct) and derives higher-level
 * HISTORICAL OBSERVATIONS from them: the historically balanced stop-loss, the
 * recovery plateau, diminishing-returns markers and plain-language insights.
 *
 * It produces observations only — never a recommendation, "best", or
 * "use this" stop-loss.
 */

import type { SlOptimizerResult, SlOptimizerRow } from '@/utils/slOptimizer';
import type { SerializedExport } from '@/utils/reports';

/** A run of consecutive stop-losses whose recovery barely changed. */
export interface SlPlateau {
  startStopLoss: number;
  endStopLoss: number;
  startIndex: number;
  endIndex: number;
  length: number;
  recoveryPct: number; // recovery level across the plateau (at its start)
}

/** Per-row intelligence flags layered on top of the optimizer row. */
export interface SlIntelligenceRow {
  stopLoss: number;
  recoveryBeforeSlPct: number;
  recoveryGain: number; // from optimizer (Δ recovery vs previous SL)
  riskIncrease: number; // from optimizer (Δ SL vs previous SL)
  efficiency: number; // from optimizer (recoveryGain / riskIncrease)
  slHitPct: number;
  inPlateau: boolean;
  inBalancedZone: boolean;
  isBalanced: boolean;
  isLargestGain: boolean;
  isHighestEfficiency: boolean;
  isHighestRecovery: boolean;
}

export interface SlIntelligence {
  rows: SlIntelligenceRow[];
  balanced: SlOptimizerRow | null;
  plateau: SlPlateau | null;
  largestGain: SlOptimizerRow | null;
  highestEfficiency: SlOptimizerRow | null;
  highestRecovery: SlOptimizerRow | null;
  lowestSlHit: SlOptimizerRow | null;
  /** Stop-loss up to which recovery was still climbing meaningfully. */
  rapidUntil: SlOptimizerRow | null;
  observations: string[];
}

/**
 * % recovery change per step that still counts as "minimal" for plateau
 * detection. A genuine step up in recovery is larger than this.
 */
const PLATEAU_EPS = 0.15;
const PLATEAU_MIN_LEN = 3;

function fmt(n: number, d = 2): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}
function pct(n: number, d = 1): string {
  return `${n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}%`;
}

/** Detects the first recovery plateau among rows with positions. */
function detectPlateau(rows: SlOptimizerRow[]): SlPlateau | null {
  for (let a = 0; a < rows.length; a += 1) {
    let b = a;
    while (b + 1 < rows.length && Math.abs(rows[b + 1]!.recoveryGain) < PLATEAU_EPS) {
      b += 1;
    }
    if (b - a + 1 >= PLATEAU_MIN_LEN) {
      const start = rows[a]!;
      const end = rows[b]!;
      return {
        startStopLoss: start.stopLoss,
        endStopLoss: end.stopLoss,
        startIndex: a,
        endIndex: b,
        length: b - a + 1,
        recoveryPct: start.recoveryBeforeSlPct,
      };
    }
    a = b; // jump past the run we just examined
  }
  return null;
}

/** Builds the intelligence analysis from already-computed optimizer results. */
export function buildSlIntelligence(result: SlOptimizerResult): SlIntelligence {
  const valid = result.rows.filter((r) => r.totalPositions > 0);

  const balanced = result.balanced;
  const highestRecovery = result.maxSuccess;

  const plateau = valid.length >= PLATEAU_MIN_LEN ? detectPlateau(valid) : null;

  const gainRows = valid.filter((_, i) => i > 0); // gain is undefined for the first SL
  const largestGain =
    gainRows.length > 0
      ? gainRows.reduce((b, r) => (r.recoveryGain > b.recoveryGain ? r : b))
      : null;

  const effRows = valid.filter((r) => r.efficiency > 0);
  const highestEfficiency =
    effRows.length > 0
      ? effRows.reduce((b, r) => (r.efficiency > b.efficiency ? r : b))
      : null;

  const lowestSlHit =
    valid.length > 0 ? valid.reduce((b, r) => (r.slHitPct < b.slHitPct ? r : b)) : null;

  // The point recovery was still climbing meaningfully: the row just before the
  // plateau starts, else the balanced point.
  const rapidUntil =
    plateau && plateau.startIndex > 0
      ? valid[plateau.startIndex - 1]!
      : balanced;

  // Build per-row flags.
  const balancedSl = balanced?.stopLoss ?? null;
  const plateauStart = plateau?.startStopLoss ?? null;
  const plateauEnd = plateau?.endStopLoss ?? null;
  const rows: SlIntelligenceRow[] = result.rows.map((r) => {
    const inPlateau =
      plateauStart !== null &&
      plateauEnd !== null &&
      r.stopLoss >= plateauStart - 1e-9 &&
      r.stopLoss <= plateauEnd + 1e-9;
    return {
      stopLoss: r.stopLoss,
      recoveryBeforeSlPct: r.recoveryBeforeSlPct,
      recoveryGain: r.recoveryGain,
      riskIncrease: r.riskIncrease,
      efficiency: r.efficiency,
      slHitPct: r.slHitPct,
      inPlateau,
      inBalancedZone: balancedSl !== null && r.stopLoss >= balancedSl - 1e-9,
      isBalanced: balancedSl !== null && Math.abs(r.stopLoss - balancedSl) < 1e-9,
      isLargestGain: largestGain !== null && Math.abs(r.stopLoss - largestGain.stopLoss) < 1e-9,
      isHighestEfficiency:
        highestEfficiency !== null && Math.abs(r.stopLoss - highestEfficiency.stopLoss) < 1e-9,
      isHighestRecovery:
        highestRecovery !== null && Math.abs(r.stopLoss - highestRecovery.stopLoss) < 1e-9,
    };
  });

  return {
    rows,
    balanced,
    plateau,
    largestGain,
    highestEfficiency,
    highestRecovery,
    lowestSlHit,
    rapidUntil,
    observations: buildObservations({
      balanced,
      plateau,
      largestGain,
      highestEfficiency,
      highestRecovery,
      lowestSlHit,
      rapidUntil,
      marginalBeyondBalanced: result.marginalBeyondBalanced,
    }),
  };
}

/** Plain-language historical observations (never recommendations). */
function buildObservations(x: {
  balanced: SlOptimizerRow | null;
  plateau: SlPlateau | null;
  largestGain: SlOptimizerRow | null;
  highestEfficiency: SlOptimizerRow | null;
  highestRecovery: SlOptimizerRow | null;
  lowestSlHit: SlOptimizerRow | null;
  rapidUntil: SlOptimizerRow | null;
  marginalBeyondBalanced: number;
}): string[] {
  const out: string[] = [];

  if (x.rapidUntil) {
    out.push(
      `Historical recovery increases rapidly until Stop Loss ${fmt(x.rapidUntil.stopLoss)}.`,
    );
  }
  if (x.balanced) {
    out.push(
      `After Stop Loss ${fmt(x.balanced.stopLoss)} the historical improvement slows considerably.`,
    );
  }
  if (x.plateau) {
    out.push(
      `Historical plateau detected: recovery stays near ${pct(
        x.plateau.recoveryPct,
      )} across ${x.plateau.length} consecutive stop-losses from ${fmt(
        x.plateau.startStopLoss,
      )} to ${fmt(x.plateau.endStopLoss)}.`,
    );
    out.push(
      `Additional Stop Loss beyond ${fmt(
        x.plateau.startStopLoss,
      )} produced almost no extra historical recovery.`,
    );
  } else if (x.balanced) {
    out.push(
      `Beyond Stop Loss ${fmt(x.balanced.stopLoss)}, higher stop-losses added only ${pct(
        x.marginalBeyondBalanced,
      )} more historical recovery.`,
    );
  }
  if (x.largestGain) {
    out.push(
      `Largest single historical recovery gain (${pct(
        x.largestGain.recoveryGain,
      )}) occurred at Stop Loss ${fmt(x.largestGain.stopLoss)}.`,
    );
  }
  if (x.highestEfficiency) {
    out.push(
      `Most historically efficient step was at Stop Loss ${fmt(
        x.highestEfficiency.stopLoss,
      )} (${fmt(x.highestEfficiency.efficiency)} recovery % per point of added stop-loss).`,
    );
  }
  if (x.lowestSlHit) {
    out.push(
      `Lowest historical stop-loss hit rate (${pct(
        x.lowestSlHit.slHitPct,
      )}) was observed at Stop Loss ${fmt(x.lowestSlHit.stopLoss)}.`,
    );
  }
  return out;
}

// --- exports (intelligence metrics in CSV / JSON / PDF) ----------------------

function csvCell(v: string | number | null): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const r1 = (n: number) => Math.round(n * 10) / 10;
const r2 = (n: number) => Math.round(n * 100) / 100;
const r3 = (n: number) => Math.round(n * 1000) / 1000;

const CSV_COLUMNS = [
  'Stop Loss',
  'Recovery Before SL %',
  'Recovery Gain %',
  'Additional Risk',
  'Efficiency',
  'SL Hit %',
  'In Plateau',
  'Balanced Zone',
  'Historically Balanced',
];

function rowToCsv(r: SlIntelligenceRow): Array<string | number> {
  return [
    r3(r.stopLoss),
    r1(r.recoveryBeforeSlPct),
    r1(r.recoveryGain),
    r2(r.riskIncrease),
    r3(r.efficiency),
    r1(r.slHitPct),
    r.inPlateau ? 'yes' : 'no',
    r.inBalancedZone ? 'yes' : 'no',
    r.isBalanced ? 'yes' : 'no',
  ];
}

export function intelligenceCsv(intel: SlIntelligence): SerializedExport {
  const lines = [CSV_COLUMNS.map(csvCell).join(',')];
  for (const r of intel.rows) lines.push(rowToCsv(r).map(csvCell).join(','));
  return {
    filename: 'StopLossIntelligence.csv',
    content: lines.join('\n'),
    mime: 'text/csv',
  };
}

export function intelligenceJson(
  intel: SlIntelligence,
  generatedAt: string,
): SerializedExport {
  const payload = {
    note:
      'Historical statistical observations only. Derived from already-computed optimizer results. Not a trading signal or recommendation.',
    generatedAt,
    historicallyBalancedStopLoss: intel.balanced?.stopLoss ?? null,
    recoveryPlateau: intel.plateau,
    largestRecoveryGain: intel.largestGain
      ? { stopLoss: intel.largestGain.stopLoss, gainPct: r1(intel.largestGain.recoveryGain) }
      : null,
    highestEfficiency: intel.highestEfficiency
      ? { stopLoss: intel.highestEfficiency.stopLoss, efficiency: r3(intel.highestEfficiency.efficiency) }
      : null,
    highestRecovery: intel.highestRecovery
      ? { stopLoss: intel.highestRecovery.stopLoss, recoveryPct: r1(intel.highestRecovery.recoveryBeforeSlPct) }
      : null,
    lowestSlHit: intel.lowestSlHit
      ? { stopLoss: intel.lowestSlHit.stopLoss, slHitPct: r1(intel.lowestSlHit.slHitPct) }
      : null,
    observations: intel.observations,
    rows: intel.rows,
  };
  return {
    filename: 'StopLossIntelligence.json',
    content: JSON.stringify(payload, null, 2),
    mime: 'application/json',
  };
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Opens a printable intelligence report (save as PDF from the print dialog). */
export function printIntelligencePdf(
  intel: SlIntelligence,
  generatedAt: string,
): void {
  const head = `<tr>${CSV_COLUMNS.map((c) => `<th>${esc(c)}</th>`).join('')}</tr>`;
  const body = intel.rows
    .map(
      (r) =>
        `<tr>${rowToCsv(r)
          .map((c) => `<td>${esc(String(c))}</td>`)
          .join('')}</tr>`,
    )
    .join('');
  const obs = intel.observations.map((o) => `<li>${esc(o)}</li>`).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"/>
<title>Stop Loss Intelligence</title>
<style>
  body{font-family:Inter,system-ui,sans-serif;color:#0b1220;margin:24px;font-size:12px}
  h1{font-size:18px;margin:0 0 4px} h2{font-size:14px;margin:16px 0 6px}
  .note{color:#64748b;font-size:11px;margin-bottom:12px}
  ul{margin:6px 0 12px 18px} li{margin:2px 0}
  table{border-collapse:collapse;width:100%} th,td{border:1px solid #cbd5e1;padding:3px 6px;text-align:right;font-variant-numeric:tabular-nums}
  th{background:#f1f5f9} td:nth-child(7),td:nth-child(8),td:nth-child(9){text-align:center}
  @media print{body{margin:0}}
</style></head><body>
<h1>Stop Loss Intelligence — Historical Observations</h1>
<div class="note">Generated ${esc(generatedAt)}. Historical statistical observations only — not a trading signal, no buy/sell recommendation.</div>
${intel.balanced ? `<h2>Historically Balanced Stop Loss: ${fmt(intel.balanced.stopLoss)}</h2>` : ''}
${
    intel.plateau
      ? `<div>Historical plateau: ${fmt(intel.plateau.startStopLoss)} – ${fmt(
          intel.plateau.endStopLoss,
        )} (~${pct(intel.plateau.recoveryPct)} recovery).</div>`
      : ''
  }
<h2>Historical Observations</h2><ul>${obs}</ul>
<h2>Per-Stop-Loss Intelligence</h2>
<table><thead>${head}</thead><tbody>${body}</tbody></table>
</body></html>`;

  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 250);
}
