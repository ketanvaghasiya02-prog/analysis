/**
 * Compact multi-select rendered as a wrapping row of toggle chips.
 * Used for session / sync-status / symbol-pair filters.
 */

interface ChipMultiSelectProps {
  label: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  /** Optional per-option count badge. */
  counts?: Record<string, number>;
}

export function ChipMultiSelect({
  label,
  options,
  selected,
  onChange,
  counts,
}: ChipMultiSelectProps) {
  const selectedSet = new Set(selected);

  const toggle = (value: string) => {
    if (selectedSet.has(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="stat-label">{label}</span>
        {selected.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-[10px] text-ink-faint transition-colors hover:text-accent"
          >
            clear
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {options.length === 0 ? (
          <span className="text-xs text-ink-faint">—</span>
        ) : (
          options.map((opt) => {
            const active = selectedSet.has(opt);
            return (
              <button
                key={opt}
                type="button"
                onClick={() => toggle(opt)}
                className={[
                  'rounded-md border px-2 py-1 text-xs font-medium transition-colors',
                  active
                    ? 'border-accent/70 bg-accent/10 text-accent'
                    : 'border-panel-border bg-panel text-ink-muted hover:border-accent/40 hover:text-ink',
                ].join(' ')}
              >
                {opt}
                {counts && counts[opt] !== undefined ? (
                  <span className="ml-1 font-mono text-[10px] text-ink-faint">
                    {counts[opt]}
                  </span>
                ) : null}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
