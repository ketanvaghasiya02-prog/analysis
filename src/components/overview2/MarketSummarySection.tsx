/**
 * Section 9 — Market Summary (Overview 2.0). Auto-generated narrative.
 */

import { fmtInt, fmtNumber } from '@/utils/format';
import { CONFIDENCE_LABELS, type ConfidenceLevel } from '@/utils/scenario';
import type { MarketSummary } from '@/utils/overviewStats';

function num(v: number | null) {
  return fmtNumber(v, 2);
}

export function MarketSummarySection({
  summary,
  confidenceLevel,
}: {
  summary: MarketSummary;
  confidenceLevel: ConfidenceLevel;
}) {
  return (
    <section className="card border-accent/20 bg-accent/5 p-5">
      <h2 className="stat-label mb-3">Market Summary</h2>
      <p className="text-sm leading-relaxed text-ink">
        Dataset contains{' '}
        <span className="font-semibold text-accent">{fmtInt(summary.tradingDays)}</span>{' '}
        trading {summary.tradingDays === 1 ? 'day' : 'days'} and{' '}
        <span className="font-semibold text-accent">{fmtInt(summary.totalSamples)}</span>{' '}
        samples. Average gap is{' '}
        <span className="font-semibold text-accent">{num(summary.averageGap)}</span>.
        95% of all observations occurred between{' '}
        <span className="font-semibold text-positive">{num(summary.range95.low)}</span> and{' '}
        <span className="font-semibold text-positive">{num(summary.range95.high)}</span>.
        {summary.rareThreshold !== null && summary.rarePct !== null && (
          <>
            {' '}Gap above{' '}
            <span className="font-semibold text-warning">{num(summary.rareThreshold)}</span>{' '}
            occurred only{' '}
            <span className="font-semibold text-warning">{fmtNumber(summary.rarePct, 2)}%</span>{' '}
            of the time.
          </>
        )}{' '}
        Largest historical gap was{' '}
        <span className="font-semibold text-negative">{num(summary.largestGap)}</span>.
        Research confidence:{' '}
        <span className="font-semibold text-ink">{CONFIDENCE_LABELS[confidenceLevel]}</span>.
      </p>
      <p className="mt-3 text-[11px] text-ink-faint">
        Generated automatically from the uploaded CSV statistics and the Research
        Engine. Descriptive only — not a trading signal.
      </p>
    </section>
  );
}
