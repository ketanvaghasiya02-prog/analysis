/**
 * Research Lab main result cards (additive).
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
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
      <Card
        label="Total Events"
        value={fmtInt(result.totalEvents)}
        tooltip="Entries into the entry gap zone detected in the data. Valid events (passing session/sync filters) are analysed."
        hint={`${fmtInt(result.validEvents)} valid`}
      />
      <Card
        label="Recovery Before SL %"
        value={fmtPercent(result.recoveryBeforeSlPct)}
        tooltip="Share of valid events that reached the recovery target without the gap ever touching the stop-loss level."
        tone="text-positive"
      />
      <Card
        label="SL Hit %"
        value={fmtPercent(result.slHitPct)}
        tooltip="Share of valid events where the gap reached the stop-loss level and never recovered within the scan window."
        tone="text-negative"
      />
      <Card
        label="Recovery After SL %"
        value={fmtPercent(result.recoveredAfterSlPct)}
        tooltip="Share of valid events that touched the stop-loss level first but later still reached the recovery target."
        tone="text-warning"
      />
      <Card
        label="Avg Recovery Time"
        value={fmtDuration(result.avgRecoveryTimeSec)}
        tooltip="Average time from entry to reaching the recovery target, across recovered events."
      />
      <Card
        label="P95 Max Adverse Gap"
        value={fmtNumber(result.adverse.p95, 3)}
        tooltip="95th percentile of the highest gap reached after entry — a stop below this would have been hit ~5% of the time."
        tone="text-accent"
      />
      <Card
        label="Worst Max Gap"
        value={fmtNumber(result.adverse.worst, 3)}
        tooltip="Largest gap any event reached after entry."
        tone="text-negative"
      />
      <Card
        label="Risk / Reward (gap pts)"
        value={rr && rr.rr !== null ? fmtNumber(rr.rr, 2) : '—'}
        tooltip="Gap-point reward (avg entry gap − recovery target to) divided by risk (stop-loss − avg entry gap). Gap points only — not money."
        hint={
          rr
            ? `reward ${fmtNumber(rr.reward, 2)} / risk ${fmtNumber(rr.risk, 2)}`
            : undefined
        }
      />
      <Card
        label="Recovery % (ignoring SL)"
        value={fmtPercent(result.recoveryPctIgnoringSl)}
        tooltip="Share of valid events that eventually reached the recovery target, whether or not the stop-loss was touched first."
      />
      <Card
        label="Research Confidence"
        value={result.confidence.level}
        tooltip="Heuristic from event count, sync quality, unresolved % and day coverage. Not a measure of profitability."
        tone={CONF_TONE[result.confidence.level]}
        hint={`score ${fmtNumber(result.confidence.score * 100, 0)} / 100`}
      />
    </section>
  );
}
