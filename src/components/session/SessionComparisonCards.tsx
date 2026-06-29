/**
 * Session comparison cards (Phase R10) — one card per session.
 */

import type { SessionStat } from '@/utils/sessions';
import {
  fmtDuration,
  fmtInt,
  fmtNumber,
  fmtPercent,
} from '@/utils/format';

function Row({
  label,
  value,
  tone = 'text-ink',
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="flex items-center justify-between py-1 text-xs">
      <span className="text-ink-muted">{label}</span>
      <span className={['font-mono', tone].join(' ')}>{value}</span>
    </div>
  );
}

function recoveryTone(pct: number): string {
  if (pct >= 90) return 'text-positive';
  if (pct >= 70) return 'text-warning';
  return 'text-negative';
}

export function SessionComparisonCards({
  sessions,
}: {
  sessions: SessionStat[];
}) {
  return (
    <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {sessions.map((s) => (
        <div key={s.session} className="card p-4">
          <header className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink">{s.session}</h3>
            <span
              className={[
                'font-mono text-lg font-semibold',
                recoveryTone(s.recoveryPct),
              ].join(' ')}
            >
              {fmtPercent(s.recoveryPct)}
            </span>
          </header>

          <div className="divide-y divide-panel-border">
            <Row label="Samples" value={fmtInt(s.samples)} />
            <Row label="Events" value={fmtInt(s.events)} />
            <Row
              label="Failed events"
              value={fmtInt(s.failed)}
              tone={s.failed > 0 ? 'text-negative' : 'text-ink'}
            />
            <Row
              label="Avg recovery time"
              value={fmtDuration(s.avgRecoveryTimeSec)}
            />
            <Row
              label="Median recovery time"
              value={fmtDuration(s.medianRecoveryTimeSec)}
            />
            <Row
              label="Worst max gap"
              value={fmtNumber(s.worstMaxGap, 3)}
              tone="text-negative"
            />
            <Row label="Average MAE" value={fmtNumber(s.avgMae, 3)} />
            <Row
              label="Sync quality"
              value={fmtPercent(s.syncQualityPct)}
              tone={
                s.syncQualityPct !== null && s.syncQualityPct >= 95
                  ? 'text-positive'
                  : 'text-warning'
              }
            />
            <Row
              label="Best zone"
              value={
                s.bestZone
                  ? `${s.bestZone.label} (${fmtPercent(s.bestZone.recoveryPct)})`
                  : '—'
              }
              tone="text-positive"
            />
            <Row
              label="Worst zone"
              value={
                s.worstZone
                  ? `${s.worstZone.label} (${fmtPercent(s.worstZone.recoveryPct)})`
                  : '—'
              }
              tone="text-negative"
            />
          </div>
        </div>
      ))}
    </section>
  );
}
