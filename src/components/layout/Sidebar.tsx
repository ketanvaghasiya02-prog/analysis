/**
 * Left navigation sidebar — dependency-aware research workflow.
 *
 * Navigation is organised into collapsible sections (Dashboard / Research /
 * Results / Validation / Reports / System). Every page stays present; items are
 * never deleted. Instead each item is *dependency-aware*: it reports whether it
 * is AVAILABLE or LOCKED behind a prerequisite (CSV data, stored research, a
 * selected strategy, etc.). Locked items show a lock + badge + tooltip and, on
 * click, surface a small toast explaining the requirement instead of navigating
 * to an empty page. A compact workflow progress strip summarises the state.
 *
 * Presentation only — no calculations, no engine logic, no page logic.
 */

import { useEffect, useState, type ComponentType, type SVGProps } from 'react';
import { useData } from '@/context/DataContext';
import { useRepository } from '@/context/RepositoryContext';
import { useStrategyFocus } from '@/context/StrategyFocusContext';
import { FileUpload } from '@/components/upload/FileUpload';
import { fmtInt } from '@/utils/format';
import {
  ChartIcon,
  ChevronIcon,
  CompareIcon,
  DatabaseIcon,
  FileIcon,
  FlaskIcon,
  GaugeIcon,
  LockIcon,
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
  label: string;
  icon: Icon;
  view: AppView;
}

interface NavSection {
  id: string;
  title: string;
  icon: Icon;
  items: NavItem[];
}

const STORAGE_KEY = 'grt.sidebar.sections.v2';
const DEFAULT_EXPANDED: Record<string, boolean> = {
  dashboard: true,
  research: true,
  results: true,
  validation: true,
  reports: true,
  system: true,
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

const SECTIONS: NavSection[] = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    icon: ChartIcon,
    items: [
      { label: 'Overview', icon: TableIcon, view: 'overview' },
      { label: 'Universal Search', icon: SearchIcon, view: 'search' },
      { label: 'Market Intelligence', icon: GaugeIcon, view: 'market-intelligence' },
    ],
  },
  {
    id: 'research',
    title: 'Research',
    icon: FlaskIcon,
    items: [
      { label: 'Research Lab', icon: FlaskIcon, view: 'lab' },
      { label: 'Stop Loss Optimizer', icon: SlidersIcon, view: 'sl-optimizer' },
      { label: 'Historical Strategy Finder', icon: TargetIcon, view: 'strategy-finder' },
      { label: 'Probability Engine', icon: GaugeIcon, view: 'probability-engine' },
    ],
  },
  {
    id: 'results',
    title: 'Results',
    icon: DatabaseIcon,
    items: [
      { label: 'Research Repository', icon: DatabaseIcon, view: 'repository' },
      { label: 'Strategy Ranking', icon: RankIcon, view: 'ranking' },
      { label: 'Strategy Details', icon: FileIcon, view: 'strategy-details' },
      { label: 'Replay Engine', icon: ReplayIcon, view: 'replay' },
      { label: 'Strategy Comparison', icon: CompareIcon, view: 'comparison' },
    ],
  },
  {
    id: 'validation',
    title: 'Validation',
    icon: ShieldIcon,
    items: [
      { label: 'Reliability Engine', icon: ShieldIcon, view: 'reliability-engine' },
      { label: 'Walk Forward Validation', icon: TargetIcon, view: 'walk-forward' },
      { label: 'Event Explorer', icon: ReplayIcon, view: 'explorer' },
      { label: 'Recovery Matrix', icon: RecoveryIcon, view: 'recovery' },
      { label: 'Stop-Loss Research', icon: ShieldIcon, view: 'stoploss' },
    ],
  },
  {
    id: 'reports',
    title: 'Reports',
    icon: FileIcon,
    items: [
      { label: 'Reporting Engine', icon: FileIcon, view: 'reports' },
      { label: 'EA Export Engine', icon: DatabaseIcon, view: 'ea-export' },
    ],
  },
  {
    id: 'system',
    title: 'System',
    icon: SettingsIcon,
    items: [
      { label: 'Quality Assurance', icon: ShieldIcon, view: 'qa' },
      { label: 'Settings', icon: SettingsIcon, view: 'settings' },
    ],
  },
];

// --- dependency gating --------------------------------------------------------

type GateStatus =
  | 'available'
  | 'limited' // navigable, but degraded (search with empty repo)
  | 'coming-soon' // navigable placeholder
  | 'needs-data'
  | 'needs-results'
  | 'needs-repository'
  | 'needs-strategy'
  | 'needs-occurrence'
  | 'needs-comparison'
  | 'needs-probability'
  | 'needs-reliability'
  | 'needs-events';

interface Gate {
  status: GateStatus;
  /** Right-aligned badge text. */
  badge?: string;
  /** Hover tooltip. */
  tooltip?: string;
  /** Toast shown when a locked item is clicked. */
  toast?: string;
}

interface WorkflowState {
  hasData: boolean;
  recordCount: number;
  hasFocus: boolean;
  eventsCount: number;
}

const NEEDS_DATA: Gate = {
  status: 'needs-data',
  badge: 'Needs CSV',
  tooltip: 'Upload a GapMonitor CSV export to enable this module.',
  toast: 'Upload a CSV export first.',
};
const COMING_SOON: Gate = {
  status: 'coming-soon',
  badge: 'Soon',
  tooltip: 'This module is planned for a future release.',
};

/** Navigable statuses — everything else is locked (toast on click). */
const NAVIGABLE = new Set<GateStatus>(['available', 'limited', 'coming-soon']);

function gateFor(view: AppView, s: WorkflowState): Gate {
  switch (view) {
    // Always available.
    case 'overview':
    case 'qa':
    case 'settings':
    case 'about':
      return { status: 'available' };

    // Always available, but degraded when the repository is empty.
    case 'search':
      return s.recordCount > 0
        ? { status: 'available', badge: fmtInt(s.recordCount), tooltip: `${s.recordCount} stored result(s) indexed.` }
        : { status: 'limited', badge: 'Limited', tooltip: 'Search limited — no research results yet. Modules are still searchable.' };

    // Need CSV data.
    case 'market-intelligence':
    case 'lab':
    case 'sl-optimizer':
    case 'strategy-finder':
    case 'probability-engine':
    case 'explorer':
      return s.hasData ? { status: 'available' } : NEEDS_DATA;

    // Repository: needs completed research results.
    case 'repository':
      return s.recordCount > 0
        ? { status: 'available', badge: fmtInt(s.recordCount), tooltip: `${s.recordCount} stored research record(s).` }
        : {
            status: 'needs-results',
            badge: 'Needs Results',
            tooltip: 'Run the Historical Strategy Finder to produce research results.',
            toast: 'Run the Historical Strategy Finder to produce research results first.',
          };

    // Ranking: needs repository records.
    case 'ranking':
      return s.recordCount > 0
        ? { status: 'available' }
        : {
            status: 'needs-repository',
            badge: 'Needs Repository',
            tooltip: 'Store research results in the Repository to rank them.',
            toast: 'Store research results in the Repository first.',
          };

    // Details: needs a selected strategy.
    case 'strategy-details':
      return s.hasFocus
        ? { status: 'available' }
        : {
            status: 'needs-strategy',
            badge: 'Select Strategy',
            tooltip: 'Select a strategy from Ranking or Repository to open its dossier.',
            toast: 'Select a strategy from Ranking or Repository first.',
          };

    // Replay: needs a selected strategy + occurrence.
    case 'replay':
      return s.hasFocus
        ? { status: 'available' }
        : {
            status: 'needs-occurrence',
            badge: 'Select Occurrence',
            tooltip: 'Open a strategy and select one occurrence to replay.',
            toast: 'Open a strategy and select an occurrence to replay.',
          };

    // Comparison: unlocked as soon as the Repository / Ranking holds at least
    // one strategy. Selecting strategies is optional (the page defaults to all,
    // or a single strategy vs the repository baseline).
    case 'comparison':
      return s.recordCount >= 1
        ? { status: 'available', badge: 'Ready', tooltip: 'Compare stored strategies. Selecting strategies is optional.' }
        : {
            status: 'needs-repository',
            badge: 'Needs Repository',
            tooltip: 'Store research results in the Repository to compare strategies.',
            toast: 'Store research results in the Repository first.',
          };

    // Reliability: needs Probability Engine (CSV) or Repository results.
    case 'reliability-engine':
      return s.recordCount > 0 || s.hasData
        ? { status: 'available' }
        : {
            status: 'needs-probability',
            badge: 'Needs Probability',
            tooltip: 'Run the Probability Engine or store research results first.',
            toast: 'Run the Probability Engine or store research results first.',
          };

    // Walk Forward: needs Repository + Reliability results.
    case 'walk-forward':
      return s.recordCount > 0
        ? { status: 'available' }
        : {
            status: 'needs-reliability',
            badge: 'Needs Reliability',
            tooltip: 'Stored research (Repository) and Reliability results are needed first.',
            toast: 'Reliability results from stored research are needed first.',
          };

    // Recovery Matrix: needs detected events.
    case 'recovery':
      if (!s.hasData) return NEEDS_DATA;
      return s.eventsCount > 0
        ? { status: 'available', badge: fmtInt(s.eventsCount) }
        : {
            status: 'needs-events',
            badge: 'Needs Events',
            tooltip: 'No zone events detected in the loaded data yet.',
            toast: 'No events detected yet in the loaded data.',
          };

    // Stop-Loss Research: needs CSV / Research Engine results.
    case 'stoploss':
      return s.hasData ? { status: 'available' } : NEEDS_DATA;

    // Reporting Engine: after any completed research (CSV data or repository).
    case 'reports':
      return s.hasData || s.recordCount > 0
        ? { status: 'available' }
        : {
            status: 'needs-results',
            badge: 'Needs Data',
            tooltip: 'Load CSV data or store research results to build a report.',
            toast: 'Load CSV data or store research results first.',
          };

    // EA Export: after stored research (+ Reliability + Walk Forward).
    case 'ea-export':
      return s.recordCount > 0
        ? { status: 'available' }
        : {
            status: 'needs-results',
            badge: 'Needs Results',
            tooltip: 'Store research results, then Reliability and Walk Forward, before exporting.',
            toast: 'Store research results before exporting.',
          };

    // Report placeholders (planned).
    case 'reports-daily':
    case 'reports-strategy':
    case 'reports-probability':
      return COMING_SOON;

    default:
      return { status: 'available' };
  }
}

// --- badge tones --------------------------------------------------------------

function badgeClass(status: GateStatus, badge?: string): string {
  if (status === 'available') {
    if (badge === 'Ready' || badge === 'Validated')
      return 'rounded border border-positive/30 bg-positive/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-positive';
    return 'font-mono text-[11px] text-ink-faint';
  }
  if (status === 'limited' || status === 'coming-soon')
    return 'rounded border border-panel-border bg-panel-raised px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-ink-faint';
  // any needs-* (locked)
  return 'rounded border border-warning/30 bg-warning/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-warning';
}

function Stat({ label, ok, value }: { label: string; ok: boolean; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-faint">{label}</span>
      <span className={['inline-flex items-center gap-1 font-mono', ok ? 'text-positive' : 'text-ink-muted'].join(' ')}>
        <span className={['h-1.5 w-1.5 rounded-full', ok ? 'bg-positive' : 'bg-ink-faint'].join(' ')} />
        {value}
      </span>
    </div>
  );
}

export function Sidebar() {
  const { dataset, validation, reset, view, setView, hasData, events } = useData();
  const { records } = useRepository();
  const { focus } = useStrategyFocus();

  const workflow: WorkflowState = {
    hasData,
    recordCount: records.length,
    hasFocus: focus !== null,
    eventsCount: events.events.length,
  };

  const activeSectionId = SECTIONS.find((s) => s.items.some((i) => i.view === view))?.id;

  const [expanded, setExpanded] = useState<Record<string, boolean>>(loadExpanded);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    saveExpanded(expanded);
  }, [expanded]);

  // Auto-dismiss the locked-item toast.
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(id);
  }, [toast]);

  // Auto-expand the section that contains the active page.
  useEffect(() => {
    if (!activeSectionId) return;
    setExpanded((prev) => (prev[activeSectionId] ? prev : { ...prev, [activeSectionId]: true }));
  }, [activeSectionId]);

  const toggleSection = (id: string) =>
    setExpanded((prev) => ({ ...prev, [id]: !(prev[id] ?? true) }));

  return (
    <aside className="relative flex h-full w-72 flex-col border-r border-panel-border bg-panel">
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
        {/* Workflow progress */}
        <div className="mb-4 rounded-lg border border-panel-border bg-panel-raised/40 p-3">
          <div className="stat-label mb-2">Workflow</div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
            <Stat label="Data" ok={hasData} value={hasData ? 'Yes' : 'No'} />
            <Stat label="Repository" ok={workflow.recordCount > 0} value={fmtInt(workflow.recordCount)} />
            <Stat label="Strategy" ok={workflow.hasFocus} value={workflow.hasFocus ? 'Yes' : 'No'} />
            <Stat label="Probability" ok={hasData} value={hasData ? 'Yes' : 'No'} />
          </div>
        </div>

        {/* Nav */}
        <nav className="mb-5 space-y-3">
          {SECTIONS.map((section) => {
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
                  <div className="mt-1 space-y-0.5">
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      const gate = gateFor(item.view, workflow);
                      const navigable = NAVIGABLE.has(gate.status);
                      const locked = !navigable;
                      const active = view === item.view;
                      return (
                        <button
                          key={item.view}
                          type="button"
                          title={gate.tooltip ?? gate.toast ?? item.label}
                          onClick={() => {
                            if (locked) setToast(gate.toast ?? 'Not available yet.');
                            else setView(item.view);
                          }}
                          className={[
                            'flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                            active
                              ? 'border border-accent/40 bg-accent/10 text-accent'
                              : locked
                                ? 'border border-transparent text-ink-faint/70 hover:bg-panel-raised/40'
                                : 'border border-transparent text-ink-muted hover:bg-panel-raised hover:text-ink',
                          ].join(' ')}
                        >
                          <Icon className={['text-base', locked ? 'opacity-60' : ''].join(' ')} />
                          <span className="truncate">{item.label}</span>
                          <span className="ml-auto flex items-center gap-1">
                            {gate.badge && <span className={badgeClass(gate.status, gate.badge)}>{gate.badge}</span>}
                            {locked && <LockIcon className="text-xs text-ink-faint" />}
                          </span>
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

      {/* Locked-item toast */}
      {toast && (
        <div
          role="status"
          className="absolute inset-x-3 bottom-3 z-20 flex items-start gap-2 rounded-md border border-warning/40 bg-panel-raised px-3 py-2 text-[11px] leading-relaxed text-ink shadow-lg"
        >
          <LockIcon className="mt-0.5 shrink-0 text-warning" />
          <span>{toast}</span>
        </div>
      )}
    </aside>
  );
}
