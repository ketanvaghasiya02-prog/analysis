/**
 * Left navigation sidebar: brand, collapsible section navigation, upload
 * control, loaded-file list and day-bucket overview.
 *
 * Navigation is organised into collapsible sections (Dashboard, Research,
 * Reports, Settings). Every existing route remains accessible — modules are
 * only grouped, never removed. Expanded/collapsed state is remembered, and the
 * section containing the active page is expanded automatically.
 */

import { useEffect, useState, type ComponentType, type SVGProps } from 'react';
import { useData } from '@/context/DataContext';
import { FileUpload } from '@/components/upload/FileUpload';
import { fmtInt } from '@/utils/format';
import {
  ChartIcon,
  ChevronIcon,
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
  SearchIcon,
  SettingsIcon,
  ShieldIcon,
  SlidersIcon,
  TableIcon,
  TargetIcon,
  TrashIcon,
  WarningIcon,
} from '@/components/common/icons';
import type { AppView } from '@/context/DataContext';

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

interface NavItem {
  id: AppView;
  label: string;
  icon: Icon;
  badge?: string;
}

interface NavSection {
  id: string;
  title: string;
  icon: Icon;
  items: NavItem[];
}

const STORAGE_KEY = 'grt.sidebar.sections.v1';
const DEFAULT_EXPANDED: Record<string, boolean> = {
  dashboard: true,
  research: true,
  reports: true,
  settings: true,
};

function loadExpanded(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_EXPANDED };
    return { ...DEFAULT_EXPANDED, ...(JSON.parse(raw) as Record<string, boolean>) };
  } catch {
    return { ...DEFAULT_EXPANDED };
  }
}

function saveExpanded(state: Record<string, boolean>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore persistence errors */
  }
}

// Views reachable without a loaded dataset (read stored results, render a
// graceful empty state, or are static placeholders).
const ALWAYS_ENABLED = new Set<AppView>([
  'overview',
  'search',
  'settings',
  'repository',
  'ranking',
  'strategy-details',
  'replay',
  'comparison',
  'market-intelligence',
  'probability-engine',
  'reliability-engine',
  'walk-forward',
  'reports',
  'reports-daily',
  'reports-strategy',
  'reports-probability',
]);

export function Sidebar() {
  const { dataset, validation, reset, view, setView, hasData, events } = useData();

  const sections: NavSection[] = [
    {
      id: 'dashboard',
      title: 'Dashboard',
      icon: ChartIcon,
      items: [
        { id: 'overview', label: 'Overview', icon: TableIcon },
        { id: 'search', label: 'Universal Search', icon: SearchIcon },
        { id: 'market-intelligence', label: 'Market Intelligence', icon: GaugeIcon },
        {
          id: 'events',
          label: 'Events',
          icon: LayersIcon,
          badge: hasData ? fmtInt(events.events.length) : undefined,
        },
        { id: 'explorer', label: 'Event Explorer', icon: ReplayIcon },
        { id: 'recovery', label: 'Recovery Matrix', icon: RecoveryIcon },
        { id: 'mae', label: 'MAE Analysis', icon: GaugeIcon },
        { id: 'stoploss', label: 'Stop-Loss Research', icon: ShieldIcon },
        { id: 'failed', label: 'Failed Events', icon: WarningIcon },
        { id: 'session', label: 'Session Analysis', icon: ClockIcon },
      ],
    },
    {
      id: 'research',
      title: 'Research',
      icon: FlaskIcon,
      items: [
        { id: 'lab', label: 'Research Lab', icon: FlaskIcon },
        { id: 'sl-optimizer', label: 'Stop Loss Optimizer', icon: SlidersIcon },
        { id: 'strategy-finder', label: 'Historical Strategy Finder', icon: TargetIcon },
        { id: 'repository', label: 'Research Repository', icon: DatabaseIcon },
        { id: 'ranking', label: 'Strategy Ranking', icon: RankIcon },
        { id: 'strategy-details', label: 'Strategy Details', icon: FileIcon },
        { id: 'replay', label: 'Replay Engine', icon: ReplayIcon },
        { id: 'comparison', label: 'Strategy Comparison', icon: CompareIcon },
        { id: 'probability-engine', label: 'Probability Engine', icon: GaugeIcon },
        { id: 'reliability-engine', label: 'Reliability Engine', icon: ShieldIcon },
        { id: 'walk-forward', label: 'Walk Forward Validation', icon: TargetIcon },
      ],
    },
    {
      id: 'reports',
      title: 'Reports',
      icon: FileIcon,
      items: [
        { id: 'reports', label: 'Reporting Engine', icon: FileIcon },
        { id: 'reports-daily', label: 'Daily Reports', icon: FileIcon },
        { id: 'reports-strategy', label: 'Strategy Reports', icon: FileIcon },
        { id: 'reports-probability', label: 'Probability Reports', icon: FileIcon },
      ],
    },
    {
      id: 'settings',
      title: 'Settings',
      icon: SettingsIcon,
      items: [{ id: 'settings', label: 'Settings', icon: SettingsIcon }],
    },
  ];

  const activeSectionId = sections.find((s) => s.items.some((i) => i.id === view))?.id;

  const [expanded, setExpanded] = useState<Record<string, boolean>>(loadExpanded);

  useEffect(() => {
    saveExpanded(expanded);
  }, [expanded]);

  // Auto-expand the section that contains the active page.
  useEffect(() => {
    if (!activeSectionId) return;
    setExpanded((prev) => (prev[activeSectionId] ? prev : { ...prev, [activeSectionId]: true }));
  }, [activeSectionId]);

  const toggleSection = (id: string) =>
    setExpanded((prev) => ({ ...prev, [id]: !(prev[id] ?? true) }));

  return (
    <aside className="flex h-full w-72 flex-col border-r border-panel-border bg-panel">
      {/* Brand */}
      <div className="flex items-center gap-2.5 border-b border-panel-border px-5 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/15 text-accent">
          <ChartIcon className="text-xl" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold text-ink">Gap Research Terminal</div>
          <div className="text-[11px] text-ink-faint">Professional CSV-Based Pair Research Platform</div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {/* Nav */}
        <nav className="mb-5 space-y-3">
          {sections.map((section) => {
            const SectionIcon = section.icon;
            const open = expanded[section.id] ?? true;
            return (
              <div key={section.id}>
                <button
                  type="button"
                  onClick={() => toggleSection(section.id)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-faint transition-colors hover:text-ink"
                >
                  <SectionIcon className="text-sm" />
                  <span>{section.title}</span>
                  <ChevronIcon
                    className={['ml-auto text-sm transition-transform', open ? '' : '-rotate-90'].join(' ')}
                  />
                </button>
                {open && (
                  <div className="mt-1 space-y-1">
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      const active = view === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setView(item.id)}
                          disabled={!hasData && !ALWAYS_ENABLED.has(item.id)}
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
                  </div>
                )}
              </div>
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
