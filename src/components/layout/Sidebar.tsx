/**
 * Left navigation sidebar: brand, view navigation, upload control, loaded-file
 * list and day-bucket overview.
 */

import { useData } from '@/context/DataContext';
import { FileUpload } from '@/components/upload/FileUpload';
import { fmtInt } from '@/utils/format';
import {
  ChartIcon,
  ClockIcon,
  CompareIcon,
  DatabaseIcon,
  FileIcon,
  FlaskIcon,
  GaugeIcon,
  LayersIcon,
  RankIcon,
  RecoveryIcon,
  ReplayIcon,
  SettingsIcon,
  ShieldIcon,
  SlidersIcon,
  TableIcon,
  TargetIcon,
  TrashIcon,
  WarningIcon,
} from '@/components/common/icons';
import type { AppView } from '@/context/DataContext';

export function Sidebar() {
  const { dataset, validation, reset, view, setView, hasData, events } =
    useData();

  const navItems: Array<{
    id: AppView;
    label: string;
    icon: typeof TableIcon;
    badge?: string;
  }> = [
    { id: 'overview', label: 'Overview', icon: TableIcon },
    {
      id: 'events',
      label: 'Events',
      icon: LayersIcon,
      badge: hasData ? fmtInt(events.events.length) : undefined,
    },
    { id: 'recovery', label: 'Recovery Matrix', icon: RecoveryIcon },
    { id: 'mae', label: 'MAE Analysis', icon: GaugeIcon },
    { id: 'stoploss', label: 'Stop-Loss Research', icon: ShieldIcon },
    { id: 'failed', label: 'Failed Events', icon: WarningIcon },
    { id: 'explorer', label: 'Event Explorer', icon: ReplayIcon },
    { id: 'session', label: 'Session Analysis', icon: ClockIcon },
    { id: 'lab', label: 'Research Lab', icon: FlaskIcon },
    { id: 'sl-optimizer', label: 'Stop Loss Optimizer', icon: SlidersIcon },
    { id: 'strategy-finder', label: 'Historical Strategy Finder', icon: TargetIcon },
    { id: 'repository', label: 'Research Repository', icon: DatabaseIcon },
    { id: 'ranking', label: 'Strategy Ranking', icon: RankIcon },
    { id: 'comparison', label: 'Strategy Comparison', icon: CompareIcon },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ];

  const alwaysEnabled = new Set<AppView>(['overview', 'settings', 'repository', 'ranking', 'comparison']);

  return (
    <aside className="flex h-full w-72 flex-col border-r border-panel-border bg-panel">
      {/* Brand */}
      <div className="flex items-center gap-2.5 border-b border-panel-border px-5 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/15 text-accent">
          <ChartIcon className="text-xl" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold text-ink">MT5 Gap Monitor</div>
          <div className="text-[11px] text-ink-faint">CSV Research Console</div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {/* Nav */}
        <nav className="mb-5 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = view === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setView(item.id)}
                disabled={!hasData && !alwaysEnabled.has(item.id)}
                className={[
                  'flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'border border-accent/40 bg-accent/10 text-accent'
                    : 'border border-transparent text-ink-muted hover:bg-panel-raised hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent',
                ].join(' ')}
              >
                <Icon className="text-base" />
                {item.label}
                {item.badge !== undefined && (
                  <span className="ml-auto font-mono text-[11px] text-ink-faint">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Upload */}
        <div className="mb-5">
          <div className="stat-label mb-2">Upload Data</div>
          <FileUpload variant="compact" />
        </div>

        {/* Loaded files */}
        {dataset && validation && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="stat-label">
                Files ({validation.filesUploaded})
              </span>
              <button
                type="button"
                onClick={reset}
                className="flex items-center gap-1 text-xs text-ink-faint transition-colors hover:text-negative"
                title="Clear all loaded data"
              >
                <TrashIcon className="text-sm" /> Clear
              </button>
            </div>
            <ul className="space-y-1">
              {dataset.files.map((f) => (
                <li
                  key={f.fileName}
                  className="flex items-center gap-2 rounded-md border border-panel-border bg-panel-raised px-2.5 py-1.5"
                >
                  <FileIcon className="shrink-0 text-sm text-ink-faint" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-mono text-[11px] text-ink">
                      {f.fileName}
                    </div>
                    <div className="text-[10px] text-ink-faint">
                      {fmtInt(f.validSamples.length)} valid
                      {f.invalidRows.length > 0
                        ? ` · ${fmtInt(f.invalidRows.length)} invalid`
                        : ''}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Footer disclaimer */}
      <div className="border-t border-panel-border px-5 py-3">
        <p className="text-[10px] leading-relaxed text-ink-faint">
          Research tool for statistical analysis of CSV exports. Not a trading
          application — no broker connection, orders or signals.
        </p>
      </div>
    </aside>
  );
}
