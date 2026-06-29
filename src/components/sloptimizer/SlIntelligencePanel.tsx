/**
 * Stop Loss Intelligence — insights panel (Phase 10C, observations only).
 *
 * Presents the historically balanced stop-loss with a small recovery ladder
 * around it, the plain-language historical observations, and the intelligence
 * exports (CSV / JSON / PDF). Everything is derived from already-computed
 * optimizer results — no recommendation is ever made.
 */

import { useMemo } from 'react';
import type { SlIntelligence } from '@/utils/slIntelligence';
import {
  intelligenceCsv,
  intelligenceJson,
  printIntelligencePdf,
} from '@/utils/slIntelligence';
import type { SlOptimizerResult } from '@/utils/slOptimizer';
import { downloadExport } from '@/utils/reports';
import { fmtNumber, fmtPercent } from '@/utils/format';
import { BulbIcon } from '@/components/common/icons';
import { INTEL_TOOLTIPS } from '@/components/sloptimizer/metrics';
import { InfoTip } from '@/components/common/InfoTip';

/** A few rows of context around the balanced stop-loss. */
function ladderRows(result: SlOptimizerResult, balancedSl: number) {
  const valid = result.rows.filter((r) => r.totalPositions > 0);
  const idx = valid.findIndex((r) => Math.abs(r.stopLoss - balancedSl) < 1e-9);
  if (idx === -1) return [];
  const from = Math.max(0, idx - 4);
  const to = Math.min(valid.length, idx + 3);
  return valid.slice(from, to);
}

export function SlIntelligencePanel({
  intel,
  result,
  stamp,
}: {
  intel: SlIntelligence;
  result: SlOptimizerResult;
  stamp: () => string;
}) {
  const balancedSl = intel.balanced?.stopLoss ?? null;
  const ladder = useMemo(
    () => (balancedSl !== null ? ladderRows(result, balancedSl) : []),
    [result, balancedSl],
  );

  const hasData = intel.rows.some((r) => r.recoveryBeforeSlPct > 0);

  return (
    <section className="card p-5">
      <header className="mb-4 flex flex-wrap items-center gap-2">
        <BulbIcon className="text-base text-accent" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink">
          Intelligence Panel
        </h2>
        <span className="text-[11px] text-ink-faint">historical observations only</span>
        <div className="ml-auto flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => downloadExport(intelligenceCsv(intel))}
            className="btn px-2.5 py-1 text-xs"
            disabled={!hasData}
          >
            CSV
          </button>
          <button
            type="button"
            onClick={() => downloadExport(intelligenceJson(intel, stamp()))}
            className="btn px-2.5 py-1 text-xs"
            disabled={!hasData}
          >
            JSON
          </button>
          <button
            type="button"
            onClick={() => printIntelligencePdf(intel, stamp())}
            className="btn px-2.5 py-1 text-xs"
            disabled={!hasData}
          >
            PDF
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,260px)_1fr]">
        {/* Balanced stop loss + recovery ladder */}
        <div className="space-y-3">
          <div className="rounded-lg border border-positive/30 bg-positive/5 p-4">
            <div className="stat-label">
              Balanced Historical Stop Loss
              <InfoTip text={INTEL_TOOLTIPS.balanced ?? ''} />
            </div>
            <div className="mt-1 text-2xl font-semibold text-positive">
              {intel.balanced ? fmtNumber(intel.balanced.stopLoss, 2) : '—'}
            </div>
            {intel.balanced && (
              <div className="mt-1 text-xs text-ink-faint">
                historical recovery {fmtPercent(intel.balanced.recoveryBeforeSlPct)}
              </div>
            )}
          </div>

          {ladder.length > 0 && (
            <div className="rounded-lg border border-panel-border p-3">
              <div className="stat-label mb-2">Recovery Ladder</div>
              <ul className="space-y-1 font-mono text-xs">
                {ladder.map((r) => {
                  const isBal = balancedSl !== null && Math.abs(r.stopLoss - balancedSl) < 1e-9;
                  return (
                    <li
                      key={r.stopLoss}
                      className={[
                        'flex items-center justify-between rounded px-2 py-0.5',
                        isBal ? 'bg-positive/15 text-positive' : 'text-ink-muted',
                      ].join(' ')}
                    >
                      <span>{fmtNumber(r.stopLoss, 2)}</span>
                      <span>{fmtPercent(r.recoveryBeforeSlPct)}</span>
                      <span className={r.recoveryGain > 0.05 ? 'text-positive' : 'text-ink-faint'}>
                        {r.recoveryGain >= 0 ? '+' : ''}
                        {fmtNumber(r.recoveryGain, 1)}%
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>

        {/* Observations */}
        <div>
          <div className="stat-label mb-2">Historical Observations</div>
          {intel.observations.length > 0 ? (
            <ul className="space-y-2">
              {intel.observations.map((text, i) => (
                <li key={i} className="flex items-start gap-2 text-sm leading-relaxed text-ink-muted">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent/70" />
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-faint">
              Not enough historical stop-loss steps to derive observations. Widen the
              SL range or reduce the step size.
            </p>
          )}
          <p className="mt-3 text-[11px] text-ink-faint">
            These are historical statistical observations — never a recommendation
            to trade or to use any stop-loss.
          </p>
        </div>
      </div>
    </section>
  );
}
