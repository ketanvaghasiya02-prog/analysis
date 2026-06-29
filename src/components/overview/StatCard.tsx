import type { ReactNode } from 'react';
import { InfoTip } from '@/components/common/InfoTip';

interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  tone?: 'default' | 'positive' | 'warning' | 'negative' | 'accent';
  /** Optional explanation shown as an info tooltip next to the label. */
  tooltip?: string;
}

const toneClass: Record<NonNullable<StatCardProps['tone']>, string> = {
  default: 'text-ink',
  positive: 'text-positive',
  warning: 'text-warning',
  negative: 'text-negative',
  accent: 'text-accent',
};

/** A single overview metric card. */
export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'default',
  tooltip,
}: StatCardProps) {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between">
        <span className="stat-label">
          {label}
          {tooltip ? <InfoTip text={tooltip} /> : null}
        </span>
        {icon ? <span className="text-ink-faint">{icon}</span> : null}
      </div>
      <div className={['stat-value mt-2', toneClass[tone]].join(' ')}>
        {value}
      </div>
      {hint ? <p className="mt-1 text-xs text-ink-faint">{hint}</p> : null}
    </div>
  );
}
