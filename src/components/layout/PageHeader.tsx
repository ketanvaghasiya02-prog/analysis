/**
 * Per-page header (presentation only).
 *
 * Shows the active module's name, a short description and its maturity status.
 * Rendered centrally above the page content so individual pages are not
 * modified. The existing top bar is left unchanged.
 */

import { useData } from '@/context/DataContext';
import { MODULE_META, type ModuleStatus } from '@/components/layout/moduleMeta';

const STATUS_CLASS: Record<ModuleStatus, string> = {
  'CSV Validated': 'border-positive/40 bg-positive/10 text-positive',
  Validated: 'border-positive/40 bg-positive/10 text-positive',
  Stable: 'border-accent/40 bg-accent/10 text-accent',
  Experimental: 'border-warning/40 bg-warning/10 text-warning',
  'Coming Soon': 'border-panel-border bg-panel-raised text-ink-faint',
};

export function StatusBadge({ status }: { status: ModuleStatus }) {
  return (
    <span className={['rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide', STATUS_CLASS[status]].join(' ')}>
      {status}
    </span>
  );
}

export function PageHeader() {
  const { view } = useData();
  const meta = MODULE_META[view];
  if (!meta) return null;

  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-2 border-b border-panel-border/70 pb-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="text-base font-semibold text-ink">{meta.title}</h1>
          {meta.status ? <StatusBadge status={meta.status} /> : null}
        </div>
        <p className="mt-1 text-sm text-ink-muted">{meta.description}</p>
      </div>
    </div>
  );
}
