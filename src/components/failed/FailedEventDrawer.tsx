/**
 * Failed event details drawer (Phase R8).
 *
 * Slide-over panel showing a single failed event's full detail, including its
 * later recovery (if any) elsewhere in the dataset.
 */

import {
  POST_RECOVERY_LABELS,
  type FailedEvent,
} from '@/utils/failed';
import { fmtInt, fmtNumber } from '@/utils/format';

interface FailedEventDrawerProps {
  event: FailedEvent | null;
  zoneLabel: string;
  onClose: () => void;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-panel-border py-2 text-sm">
      <span className="text-ink-muted">{label}</span>
      <span className="font-mono text-ink">{value}</span>
    </div>
  );
}

export function FailedEventDrawer({
  event,
  zoneLabel,
  onClose,
}: FailedEventDrawerProps) {
  if (!event) return null;

  const recovered = event.postRecovery !== 'never';

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close details"
        onClick={onClose}
        className="absolute inset-0 bg-black/50"
      />
      {/* Panel */}
      <aside className="relative z-50 flex h-full w-full max-w-md flex-col border-l border-panel-border bg-panel-raised shadow-card">
        <header className="flex items-center justify-between border-b border-panel-border px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-ink">{event.eventId}</h2>
            <p className="text-xs text-ink-faint">Zone {zoneLabel} · failed event</p>
          </div>
          <button type="button" onClick={onClose} className="btn px-2 py-1">
            Close
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-3">
          <h3 className="stat-label mb-1 mt-2">Entry</h3>
          <Row label="Date" value={event.date} />
          <Row label="Entry time" value={event.entryTime || '—'} />
          <Row label="Entry gap" value={fmtNumber(event.entryGap, 3)} />
          <Row label="Session" value={event.session} />
          <Row label="Sync status" value={event.syncStatus} />

          <h3 className="stat-label mb-1 mt-5">Adverse Excursion</h3>
          <Row label="Max gap after entry" value={fmtNumber(event.maxGap, 3)} />
          <Row
            label="Adverse expansion"
            value={fmtNumber(event.adverseExpansion, 3)}
          />
          <Row label="Start index" value={fmtInt(event.startIndex)} />
          <Row label="Day boundary index" value={fmtInt(event.dayBoundaryIndex)} />

          <h3 className="stat-label mb-1 mt-5">Recovery After Failure</h3>
          <div
            className={[
              'mb-2 rounded-md border px-3 py-2 text-sm',
              recovered
                ? 'border-positive/30 bg-positive/5 text-positive'
                : 'border-negative/30 bg-negative/5 text-negative',
            ].join(' ')}
          >
            {POST_RECOVERY_LABELS[event.postRecovery]}
          </div>
          <Row label="Recovery date" value={event.recoveryDate ?? '—'} />
          <Row label="Recovery time" value={event.recoveryTime ?? '—'} />
          <Row
            label="Days to recovery"
            value={
              event.daysToRecovery !== null
                ? fmtInt(event.daysToRecovery)
                : '—'
            }
          />
        </div>
      </aside>
    </div>
  );
}
