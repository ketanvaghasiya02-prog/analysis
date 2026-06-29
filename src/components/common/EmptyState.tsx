import type { ReactNode } from 'react';
import { ChartIcon } from '@/components/common/icons';

interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
}

/** Centered placeholder shown before any data is loaded. */
export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-panel-border bg-panel-raised text-accent">
        <ChartIcon className="text-3xl" />
      </div>
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      <p className="mt-2 max-w-md text-sm text-ink-muted">{description}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
