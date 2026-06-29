/**
 * Stop Loss Optimizer — automatic quick insights (visualization only).
 *
 * Generates plain-language OBSERVATIONS from the already-computed optimizer
 * result. These describe what historically happened — they never recommend a
 * trade or a stop-loss to use.
 */

import { useMemo } from 'react';
import type { SlOptimizerResult, SlOptimizerRow } from '@/utils/slOptimizer';
import { fmtNumber, fmtPercent } from '@/utils/format';
import { BulbIcon } from '@/components/common/icons';

/** Builds descriptive observations from the optimizer rows. */
function buildInsights(result: SlOptimizerResult): string[] {
  const rows = result.rows.filter((r) => r.totalPositions > 0);
  if (rows.length < 2) return [];

  const out: string[] = [];
  const first = rows[0]!;
  const last = rows[rows.length - 1]!;

  // 1) Where the highest historical recovery occurred.
  if (result.maxSuccess) {
    out.push(
      `Highest historical recovery (${fmtPercent(
        result.maxSuccess.recoveryBeforeSlPct,
      )}) occurred at Stop Loss ${fmtNumber(result.maxSuccess.stopLoss, 2)}.`,
    );
  }

  // 2) Direction of SL Hit rate as SL increases.
  const hitDelta = last.slHitPct - first.slHitPct;
  if (Math.abs(hitDelta) >= 1) {
    out.push(
      hitDelta < 0
        ? 'Stop-loss hit rate decreases as the stop-loss increases.'
        : 'Stop-loss hit rate increases as the stop-loss increases.',
    );
  } else {
    out.push('Stop-loss hit rate stays broadly flat across the tested range.');
  }

  // 3) Where recovery improvement slows (diminishing returns).
  const knee = findRecoveryKnee(rows);
  if (knee) {
    out.push(
      `Recovery improvement slows after Stop Loss ${fmtNumber(knee.stopLoss, 2)}.`,
    );
  }

  // 4) Balanced SL observation (Phase 10A balanced point).
  if (result.balanced) {
    out.push(
      `Beyond Stop Loss ${fmtNumber(
        result.balanced.stopLoss,
        2,
      )}, higher stop-losses added only ${fmtPercent(
        result.marginalBeyondBalanced,
        1,
      )} more historical recovery.`,
    );
  }

  // 5) Lowest historical risk (average max gap).
  if (result.lowestRisk) {
    out.push(
      `Lowest average maximum gap (${fmtNumber(
        result.lowestRisk.avgMaxGap,
        3,
      )}) was observed at Stop Loss ${fmtNumber(result.lowestRisk.stopLoss, 2)}.`,
    );
  }

  return out;
}

/**
 * First SL where the next steps stop meaningfully improving recovery-before-SL.
 * Reuses the already-computed recoveryGain field — no recalculation.
 */
function findRecoveryKnee(rows: SlOptimizerRow[]): SlOptimizerRow | null {
  const LOOKAHEAD = 3;
  const EPS = 0.2; // % points
  for (let i = 0; i < rows.length; i += 1) {
    const ahead = rows.slice(i + 1, i + 1 + LOOKAHEAD);
    if (ahead.length === 0) continue;
    if (ahead.every((r) => r.recoveryGain < EPS)) return rows[i]!;
  }
  return null;
}

export function SlOptimizerInsights({ result }: { result: SlOptimizerResult }) {
  const insights = useMemo(() => buildInsights(result), [result]);

  if (insights.length === 0) return null;

  return (
    <section className="card p-5">
      <header className="mb-3 flex items-center gap-2">
        <BulbIcon className="text-base text-accent" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink">
          Quick Insights
        </h2>
        <span className="ml-auto text-[11px] text-ink-faint">observations only</span>
      </header>
      <ul className="space-y-2">
        {insights.map((text, i) => (
          <li key={i} className="flex items-start gap-2 text-sm leading-relaxed text-ink-muted">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent/70" />
            <span>{text}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[11px] text-ink-faint">
        Descriptive statistics from historical data — never a recommendation to
        trade or to use any stop-loss.
      </p>
    </section>
  );
}
