/**
 * Top header: title, active selection summary and detected date range.
 */

import { useData } from '@/context/DataContext';
import { describeSelection } from '@/utils/selection';
import { formatDayLabel } from '@/utils/date';
import { fmtInt } from '@/utils/format';
import { activeFilterCount } from '@/utils/filters';
import { CalendarIcon } from '@/components/common/icons';
import { ExportMenu } from '@/components/export/ExportMenu';

export function Header() {
  const {
    dataset,
    validation,
    selection,
    filteredSamples,
    filters,
    isParsing,
    view,
  } = useData();

  const title =
    view === 'events'
      ? 'Zone Event Analysis'
      : view === 'recovery'
        ? 'Recovery Matrix'
        : view === 'mae'
          ? 'MAE Analysis'
          : view === 'stoploss'
            ? 'Stop-Loss Research'
            : view === 'failed'
              ? 'Failed Recovery Analysis'
              : view === 'explorer'
                ? 'Event Explorer & Replay'
                : view === 'session'
                  ? 'Session Recovery & Risk'
                  : view === 'lab'
                    ? 'Research Lab — Scenario Testing'
                    : view === 'sl-optimizer'
                      ? 'Stop Loss Optimizer'
                      : view === 'strategy-finder'
                        ? 'Historical Strategy Finder'
                        : view === 'repository'
                          ? 'Research Repository'
                          : view === 'ranking'
                            ? 'Strategy Ranking'
                            : view === 'strategy-details'
                              ? 'Historical Strategy Details'
                              : view === 'replay'
                                ? 'Historical Evidence Replay'
                                : view === 'settings'
                                  ? 'Settings'
                                  : 'Gap Analysis Overview';

  const range = validation?.dateRange;
  const rangeLabel =
    range?.start && range?.end
      ? range.start === range.end
        ? formatDayLabel(range.start)
        : `${formatDayLabel(range.start)} — ${formatDayLabel(range.end)}`
      : 'No data loaded';

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-panel-border bg-panel-raised px-6 py-3">
      <div>
        <h1 className="text-base font-semibold text-ink">{title}</h1>
        <p className="text-xs text-ink-muted">
          {dataset ? describeSelection(selection) : 'Upload CSV files to begin'}
          {dataset ? ` · ${fmtInt(filteredSamples.length)} samples in view` : ''}
          {dataset && activeFilterCount(filters) > 0
            ? ` · ${activeFilterCount(filters)} filter${
                activeFilterCount(filters) > 1 ? 's' : ''
              } active`
            : ''}
        </p>
      </div>

      <div className="flex items-center gap-3">
        {isParsing && (
          <span className="flex items-center gap-2 text-xs text-accent">
            <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
            Parsing…
          </span>
        )}
        <div className="flex items-center gap-2 rounded-md border border-panel-border bg-panel px-3 py-1.5">
          <CalendarIcon className="text-base text-accent" />
          <span className="text-sm font-medium text-ink">{rangeLabel}</span>
        </div>
        <ExportMenu />
      </div>
    </header>
  );
}
