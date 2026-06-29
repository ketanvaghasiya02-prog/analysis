/**
 * Research Lab main result cards (additive).
 *
 * Surfaces every outcome family — including unresolved — so no events are ever
 * silently dropped. Each metric carries a "?" help tip (definition + formula +
 * example).
 */

import {
  CONFIDENCE_LABELS,
  type ConfidenceLevel,
  type ScenarioResult,
} from '@/utils/scenario';
import { fmtDuration, fmtInt, fmtNumber, fmtPercent } from '@/utils/format';
import { InfoTip } from '@/components/common/InfoTip';

const CONF_TONE: Record<ConfidenceLevel, string> = {
  VERY_HIGH: 'text-positive',
  HIGH: 'text-positive',
  MEDIUM: 'text-warning',
  LOW: 'text-negative',
  VERY_LOW: 'text-negative',
};

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

  const input = result.input;

  return (
    <>
      {/* Scenario parameters. */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card
          label="Entry Gap"
          value={fmtNumber(input.entryGap, 2)}
          tone="text-accent"
          tooltip="The exact gap level. An event starts on the first touch of this level from below."
        />
        <Card
          label="Recovery Gap"
          value={fmtNumber(input.recoveryGap, 2)}
          tone="text-positive"
          tooltip="Recovery is the first time the gap touches at or below this level after entry."
        />
        <Card
          label="Stop Loss Gap"
          value={fmtNumber(input.stopLoss, 2)}
          tone="text-negative"
          tooltip="Stop-loss is the first time the gap touches at or above this level after entry."
        />
        <Card
          label="Total Events"
          value={fmtInt(result.validEvents)}
          tooltip={
            'Definition: every entry event that was analysed (passing session/sync filters).\n' +
            'Formula: count of detected first-touch entries that were classified.\n' +
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
      </section>

      {/* Primary outcome metrics — always show all, including unresolved. */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
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

      {/* Recovery-time + adverse-gap distribution. */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <Card
          label="Avg Recovery Time"
          value={fmtDuration(result.avgRecoveryTimeSec)}
          tooltip={
            'Definition: average time from entry to reaching the recovery gap.\n' +
            'Formula: mean of recovery times over recovered events.'
          }
        />
        <Card
          label="Median Recovery Time"
          value={fmtDuration(result.medianRecoveryTimeSec)}
          tooltip="Middle recovery time (50th percentile) over recovered events."
        />
        <Card
          label="Avg Max Adverse Gap"
          value={fmtNumber(result.adverse.avg, 3)}
          tooltip="Average of the highest gap reached after entry, across events."
        />
        <Card
          label="Median Max Adverse Gap"
          value={fmtNumber(result.adverse.median, 3)}
          tooltip="Median of the highest gap reached after entry."
        />
        <Card
          label="P90 Max Adverse Gap"
          value={fmtNumber(result.adverse.p90, 3)}
          tooltip="90th percentile of the highest gap reached after entry."
        />
        <Card
          label="P95 Max Adverse Gap"
          value={fmtNumber(result.adverse.p95, 3)}
          tone="text-accent"
          tooltip={
            'Definition: 95th percentile of the highest gap reached after entry.\n' +
            'Use: a stop below this would have been hit ~5% of the time.'
          }
        />
        <Card
          label="P99 Max Adverse Gap"
          value={fmtNumber(result.adverse.p99, 3)}
          tooltip="99th percentile of the highest gap reached after entry."
        />
        <Card
          label="Worst Max Adverse Gap"
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
            'Formula: Reward = Avg Entry Gap − Recovery Gap; Risk = Stop Loss − Avg Entry Gap; RR = Reward / Risk.\n' +
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
          value={CONFIDENCE_LABELS[result.confidence.level]}
          tone={CONF_TONE[result.confidence.level]}
          tooltip={
            'Definition: how trustworthy these stats are (not a measure of profitability).\n' +
            'Based on: sample size, date coverage, sync quality, and outcome completeness.\n' +
            'Shown as Very Low / Low / Medium / High / Very High. Few events can never read High.'
          }
          hint={`score ${fmtNumber(result.confidence.score * 100, 0)} / 100`}
        />
      </section>
    </>
  );
}
