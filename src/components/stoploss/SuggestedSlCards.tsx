/**
 * Suggested statistical SL evidence cards (Phase R7).
 *
 * Each card describes an SL reference level derived from the recovered-event
 * max-gap distribution and the historical outcomes at that level. These are
 * statistical reference points, NOT trading recommendations.
 */

import type { SuggestedStopLoss } from '@/utils/stoploss';
import { fmtNumber, fmtPercent } from '@/utils/format';

const ACCENT: Record<SuggestedStopLoss['style'], string> = {
  aggressive: 'border-negative/40',
  balanced: 'border-warning/40',
  conservative: 'border-positive/40',
  'worst-case': 'border-accent/40',
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-muted">{label}</span>
      <span className="font-mono text-ink">{value}</span>
    </div>
  );
}

export function SuggestedSlCards({
  suggestions,
}: {
  suggestions: SuggestedStopLoss[];
}) {
  return (
    <section>
      <h2 className="stat-label mb-2">Suggested Statistical SL Levels</h2>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {suggestions.map((s) => (
          <div
            key={s.style}
            className={['card border p-4', ACCENT[s.style]].join(' ')}
          >
            <div className="flex items-baseline justify-between">
              <h3 className="text-sm font-semibold text-ink">{s.label}</h3>
              <span className="font-mono text-lg font-semibold text-accent">
                {s.slLevel !== null ? fmtNumber(s.slLevel, 2) : '—'}
              </span>
            </div>
            <p className="mt-0.5 text-[11px] uppercase tracking-wide text-ink-faint">
              {s.basis}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-ink-muted">
              {s.description}
            </p>

            {s.row && (
              <div className="mt-3 space-y-1 border-t border-panel-border pt-3 text-xs">
                <Stat
                  label="Recovered survived"
                  value={fmtPercent(s.row.recoveredSurvivedPct)}
                />
                <Stat
                  label="Recovered stopped"
                  value={fmtPercent(s.row.recoveredStoppedPct)}
                />
                <Stat
                  label="Failed cut"
                  value={fmtPercent(s.row.failedCutPct)}
                />
                <Stat
                  label="Overall recovery"
                  value={fmtPercent(s.row.overallRecoveryPct)}
                />
                <Stat
                  label="Stop efficiency"
                  value={fmtNumber(s.row.stopEfficiency, 1)}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
