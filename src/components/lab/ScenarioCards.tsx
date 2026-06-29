/**
 * Research Lab main result cards (additive).
 *
 * Surfaces every outcome family — including unresolved — so no events are ever
 * silently dropped. Each metric carries a "?" help tip (definition + formula +
 * example).
 */

import type { ScenarioResult } from '@/utils/scenario';
import { fmtDuration, fmtInt, fmtNumber, fmtPercent } from '@/utils/format';
import { InfoTip } from '@/components/common/InfoTip';

const CONF_TONE = {
  HIGH: 'text-positive',
  MEDIUM: 'text-warning',
  LOW: 'text-negative',
} as const;

function Card({
  label,
  value,
  tooltip,
  tone = 'text-ink',
  hint,
}: {
  label: string;
  value: string;
  tooltip: string;
  tone?: string;
  hint?: string;
}) {
  return (
    <div className="card p-4">
      <div className="stat-label">
        {label}
        <InfoTip text={tooltip} />
      </div>
      <div className={['stat-value mt-2', tone].join(' ')}>{value}</div>
      {hint ? <div className="mt-0.5 text-xs text-ink-faint">{hint}</div> : null}
    </div>
  );
}

export function ScenarioCards({ result }: { result: ScenarioResult }) {
  const rr = result.riskReward;

  return (
    <>
      {/* Primary outcome metrics — always show all six, including unresolved. */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <Card
          label="Total Events"
          value={fmtInt(result.validEvents)}
          tooltip={
            'Definition: every entry-zone event that was analysed (passing session/sync filters).\n' +
            'Formula: count of detected entries that were classified.\n' +
            (result.totalEvents !== result.validEvents
              ? `Note: ${result.totalEvents} detected, ${result.validEvents} analysed after filters.`
              : 'Each event gets exactly one final outcome.')
          }
          hint={
            result.totalEvents !== result.validEvents
              ? `${fmtInt(result.totalEvents)} detected`
              : undefined
          }
        />
        <Card
          label="Recovery Before SL %"
          value={fmtPercent(result.recoveryBeforeSlPct)}
          tone="text-positive"
          tooltip={
            'Definition: the recovery target was reached before stop-loss was ever touched.\n' +
            'Formula: Recovered Before SL / Total Events × 100.\n' +
            'Example: 62 of 100 events → 62%.'
          }
        />
        <Card
          label="Recovery Ignoring SL %"
          value={fmtPercent(result.recoveryPctIgnoringSl)}
          tone="text-accent"
          tooltip={
            'Definition: the idea eventually worked, whether or not SL was touched first.\n' +
            'Formula: (Recovered Before SL + SL Hit Then Recovered) / Total × 100.\n' +
            'Example: (62 + 25) / 100 → 87%.'
          }
        />
        <Card
          label="SL Hit %"
          value={fmtPercent(result.slHitPct)}
          tone="text-negative"
          tooltip={
            'Definition: the gap reached the stop-loss level at some point.\n' +
            'Formula: (SL Hit Then Recovered + SL Hit Not Recovered) / Total × 100.\n' +
            'Example: (25 + 8) / 100 → 33%.'
          }
        />
        <Card
          label="Unresolved %"
          value={fmtPercent(result.unresolvedPct)}
          tone="text-warning"
          tooltip={
            'Definition: the event did not reach recovery or SL before the scan limit.\n' +
            'Formula: (Day End + Dataset End + Max Holding Expired) / Total × 100.\n' +
            'Example: (3 + 2 + 0) / 100 → 5%.'
          }
        />
        <Card
          label="Recovery After SL %"
          value={fmtPercent(result.recoveredAfterSlPct)}
          tone="text-warning"
          tooltip={
            'Definition: the idea eventually worked, but the selected SL was too tight — SL hit first, then recovery.\n' +
            'Formula: SL Hit Then Recovered / Total × 100.\n' +
            'Example: 25 of 100 events → 25%.'
          }
        />
      </section>

      {/* Secondary analytics. */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <Card
          label="Avg Recovery Time"
          value={fmtDuration(result.avgRecoveryTimeSec)}
          tooltip={
            'Definition: average time from entry to reaching the recovery target.\n' +
            'Formula: mean of recovery times over recovered events.'
          }
        />
        <Card
          label="P95 Max Adverse Gap"
          value={fmtNumber(result.adverse.p95, 3)}
          tone="text-accent"
          tooltip={
            'Definition: 95th percentile of the highest gap reached after entry.\n' +
            'Formula: P95 of max-gap-after-entry across events.\n' +
            'Use: a stop below this would have been hit ~5% of the time.'
          }
        />
        <Card
          label="Worst Max Gap"
          value={fmtNumber(result.adverse.worst, 3)}
          tone="text-negative"
          tooltip={
            'Definition: the largest gap any event reached after entry.\n' +
            'Formula: max of max-gap-after-entry across events.'
          }
        />
        <Card
          label="Risk / Reward (gap pts)"
          value={rr && rr.rr !== null ? fmtNumber(rr.rr, 2) : '—'}
          tooltip={
            'Definition: gap-point reward vs risk for this scenario (not money).\n' +
            'Formula: Reward = Avg Entry Gap − Recovery Target To; Risk = Stop Loss − Avg Entry Gap; RR = Reward / Risk.\n' +
            'Example: entry 18.20, recovery 15.50, SL 19.00 → reward 2.70 / risk 0.80 → 3.38.'
          }
          hint={
            rr
              ? `reward ${fmtNumber(rr.reward, 2)} / risk ${fmtNumber(rr.risk, 2)}`
              : undefined
          }
        />
        <Card
          label="Research Confidence"
          value={result.confidence.level}
          tone={CONF_TONE[result.confidence.level]}
          tooltip={
            'Definition: how trustworthy these stats are (not a measure of profitability).\n' +
            'Based on: number of events, sync quality, unresolved %, and day coverage.\n' +
            'Shown as LOW / MEDIUM / HIGH.'
          }
          hint={`score ${fmtNumber(result.confidence.score * 100, 0)} / 100`}
        />
      </section>
    </>
  );
}
