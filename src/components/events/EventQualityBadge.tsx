/**
 * Colour-coded badge for an event-quality classification.
 */

import {
  EVENT_QUALITY_LABELS,
  type EventQuality,
} from '@/utils/events';

const TONE: Record<EventQuality, string> = {
  valid: 'border-positive/40 bg-positive/10 text-positive',
  invalid: 'border-negative/40 bg-negative/10 text-negative',
  'day-ended-before-recovery': 'border-warning/40 bg-warning/10 text-warning',
  'dataset-ended-before-recovery': 'border-accent/40 bg-accent/10 text-accent',
};

export function EventQualityBadge({ quality }: { quality: EventQuality }) {
  return (
    <span
      className={[
        'inline-block whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-medium',
        TONE[quality],
      ].join(' ')}
    >
      {EVENT_QUALITY_LABELS[quality]}
    </span>
  );
}
