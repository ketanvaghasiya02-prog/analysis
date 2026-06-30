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
  ChatIcon,
  ChevronIcon,
  CompareIcon,
  DatabaseIcon,
  FileIcon,
  FlaskIcon,
  GaugeIcon,
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
} from '@/components/common/icons';
import type { AppView } from '@/context/DataContext';

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

interface NavItem {
  /** Unique key for the list (not necessarily a view). */
  key: string;
  label: string;
  icon: Icon;
  /** Navigation target + active-state match. */
  view: AppView;
  badge?: string;
  /** Draw a subtle group separator above this item. */
  dividerBefore?: boolean;
  /** A shortcut to a shared page (e.g. a sub-feature): navigates but never
   *  shows as active, so the page's primary item keeps the highlight. */
  shortcut?: boolean;
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
  'assistant',
  'ea-export',
  'qa',
  'reports',
  'reports-daily',
  'reports-strategy',
  'reports-probability',
  'about',
]);

export function Sidebar() {
  const { dataset, validation, reset, view, setView, hasData } = useData();

  const sections: NavSection[] = [
    {
      id: 'dashboard',
      title: 'Dashboard',
      icon: ChartIcon,
      items: [
        { key: 'overview', label: 'Overview', icon: TableIcon, view: 'overview' },
        { key: 'search', label: 'Universal Search', icon: SearchIcon, view: 'search' },
        { key: 'market-intelligence', label: 'Market Intelligence', icon: GaugeIcon, view: 'market-intelligence' },
      ],
    },
    {
      id: 'research',
      title: 'Research',
      icon: FlaskIcon,
      items: [
        // Workflow: research → repository → investigation → quantification → events → AI.
        { key: 'lab', label: 'Research Lab', icon: FlaskIcon, view: 'lab' },
        { key: 'sl-optimizer', label: 'Stop Loss Optimizer', icon: SlidersIcon, view: 'sl-optimizer' },
        { key: 'strategy-finder', label: 'Historical Strategy Finder', icon: TargetIcon, view: 'strategy-finder' },

        { key: 'repository', label: 'Research Repository', icon: DatabaseIcon, view: 'repository', dividerBefore: true },
        { key: 'ranking', label: 'Strategy Ranking', icon: RankIcon, view: 'ranking' },
        { key: 'strategy-details', label: 'Strategy Details', icon: FileIcon, view: 'strategy-details' },
        { key: 'replay', label: 'Replay Engine', icon: ReplayIcon, view: 'replay' },
        { key: 'comparison', label: 'Strategy Comparison', icon: CompareIcon, view: 'comparison' },

        { key: 'probability-engine', label: 'Probability Engine', icon: GaugeIcon, view: 'probability-engine', dividerBefore: true },
        { key: 'reliability-engine', label: 'Reliability Engine', icon: ShieldIcon, view: 'reliability-engine' },
        { key: 'walk-forward', label: 'Walk Forward Validation', icon: TargetIcon, view: 'walk-forward' },

        { key: 'explorer', label: 'Event Explorer', icon: ReplayIcon, view: 'explorer', dividerBefore: true },
        { key: 'recovery', label: 'Recovery Matrix', icon: RecoveryIcon, view: 'recovery' },
        { key: 'stoploss', label: 'Stop-Loss Research', icon: ShieldIcon, view: 'stoploss' },

        { key: 'assistant', label: 'AI Research Assistant', icon: ChatIcon, view: 'assistant', dividerBefore: true },
      ],
    },
    {
      id: 'reports',
      title: 'Reports',
      icon: FileIcon,
      items: [
        { key: 'reports', label: 'Reporting Engine', icon: FileIcon, view: 'reports' },
        { key: 'ea-export', label: 'EA Export Engine', icon: DatabaseIcon, view: 'ea-export' },
        { key: 'reports-daily', label: 'Daily Reports', icon: FileIcon, view: 'reports-daily' },
        { key: 'reports-strategy', label: 'Strategy Reports', icon: FileIcon, view: 'reports-strategy' },
        { key: 'reports-probability', label: 'Probability Reports', icon: FileIcon, view: 'reports-probability' },
      ],
    },
    {
      id: 'settings',
      title: 'Settings',
      icon: SettingsIcon,
      items: [
        { key: 'settings', label: 'Application Settings', icon: SettingsIcon, view: 'settings' },
        { key: 'qa', label: 'Quality Assurance', icon: ShieldIcon, view: 'qa' },
        { key: 'about', label: 'About GRT', icon: ChartIcon, view: 'about' },
      ],
    },
  ];

  const activeSectionId = sections.find((s) => s.items.some((i) => !i.shortcut && i.view === view))?.id;

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
                      const active = !item.shortcut && view === item.view;
                      return (
                        <div key={item.key}>
                          {item.dividerBefore && <div className="mx-3 my-1.5 border-t border-panel-border/70" />}
                          <button
                            type="button"
                            onClick={() => setView(item.view)}
                            disabled={!hasData && !ALWAYS_ENABLED.has(item.view)}
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
                        </div>
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
