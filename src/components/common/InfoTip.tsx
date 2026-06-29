/**
 * Small inline information tooltip (Phase R12).
 *
 * Uses an accessible native title tooltip plus a subtle marker, so every metric
 * can carry an explanation without a heavy popover dependency.
 */

interface InfoTipProps {
  text: string;
  className?: string;
}

export function InfoTip({ text, className }: InfoTipProps) {
  return (
    <span
      title={text}
      aria-label={text}
      tabIndex={0}
      className={[
        'ml-1 inline-flex h-3.5 w-3.5 cursor-help items-center justify-center rounded-full border border-panel-border text-[9px] font-semibold text-ink-faint transition-colors hover:border-accent/60 hover:text-accent',
        className ?? '',
      ].join(' ')}
    >
      i
    </span>
  );
}
