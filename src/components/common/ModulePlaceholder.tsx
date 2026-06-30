/**
 * Professional "coming soon" placeholder for future modules (presentation only).
 *
 * Explains what the module will do and its current status. No business logic;
 * the page header above already shows the module name + status badge.
 */

import { useData } from '@/context/DataContext';
import { MODULE_META } from '@/components/layout/moduleMeta';
import { BulbIcon } from '@/components/common/icons';

export function ModulePlaceholder() {
  const { view } = useData();
  const meta = MODULE_META[view];
  if (!meta) return null;

  return (
    <section className="card mx-auto max-w-2xl p-8">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/15 text-accent">
          <BulbIcon className="text-xl" />
        </span>
        <div>
          <h2 className="text-base font-semibold text-ink">{meta.title}</h2>
          <p className="text-xs text-ink-faint">Planned research module</p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <div className="stat-label mb-1">What this module will do</div>
          <p className="text-sm leading-relaxed text-ink-muted">{meta.about ?? meta.description}</p>
        </div>

        <div className="rounded-lg border border-panel-border bg-panel-raised px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="stat-label">Current Status</span>
            <span className="rounded-full border border-warning/40 bg-warning/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-warning">
              Coming Soon
            </span>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-ink-faint">
            This module is reserved in the navigation and will be built in a later
            phase. It will read only from data already in the application — no new
            calculations, no broker connection, and no predictions.
          </p>
        </div>
      </div>
    </section>
  );
}
