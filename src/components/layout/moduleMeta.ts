/**
 * Module metadata for the navigation architecture (presentation only).
 *
 * Maps every view to its display name, a short description, a maturity status
 * and — for placeholder modules — an "about" blurb describing what the module
 * will do. No business logic; consumed by the sidebar, the page header and the
 * coming-soon placeholders.
 */

import type { AppView } from '@/context/DataContext';

export type ModuleStatus = 'CSV Validated' | 'Validated' | 'Stable' | 'Experimental' | 'Coming Soon';

export interface ModuleMeta {
  title: string;
  description: string;
  status?: ModuleStatus;
  /** Longer explanation shown on placeholder pages. */
  about?: string;
}

export const MODULE_META: Record<AppView, ModuleMeta> = {
  overview: {
    title: 'Overview',
    description: 'High-level summary of the uploaded gap dataset.',
    status: 'Stable',
  },
  'market-intelligence': {
    title: 'Market Intelligence',
    description: 'Statistical description of the current market context from recent history.',
    status: 'Experimental',
  },
  events: {
    title: 'Events',
    description: 'Detected gap-zone entry/exit events across the dataset.',
    status: 'Stable',
  },
  explorer: {
    title: 'Event Explorer',
    description: 'Inspect and replay individual detected events.',
    status: 'Stable',
  },
  recovery: {
    title: 'Recovery Matrix',
    description: 'Recovery statistics by gap zone.',
    status: 'Stable',
  },
  mae: {
    title: 'MAE Analysis',
    description: 'Maximum adverse excursion distribution per zone.',
    status: 'Stable',
  },
  stoploss: {
    title: 'Stop-Loss Research',
    description: 'Survival curves and stop-loss statistics by zone.',
    status: 'Stable',
  },
  failed: {
    title: 'Failed Events',
    description: 'Events that did not recover, and what happened next.',
    status: 'Stable',
  },
  session: {
    title: 'Session Analysis',
    description: 'Recovery and risk broken down by trading session.',
    status: 'Stable',
  },
  lab: {
    title: 'Research Lab',
    description: 'Scenario testing on the frozen Research Engine v1.0.',
    status: 'CSV Validated',
  },
  'sl-optimizer': {
    title: 'Stop Loss Optimizer',
    description: 'Sweep stop-loss levels and read the historical outcome at each.',
    status: 'Validated',
  },
  'strategy-finder': {
    title: 'Historical Strategy Finder',
    description: 'Research historical parameter combinations from uploaded CSV datasets.',
    status: 'Validated',
  },
  repository: {
    title: 'Research Repository',
    description: 'Centralized store of completed strategy research results.',
    status: 'Stable',
  },
  ranking: {
    title: 'Strategy Ranking',
    description: 'Deterministic statistical ranking of stored strategies.',
    status: 'Experimental',
  },
  'strategy-details': {
    title: 'Strategy Details',
    description: 'Complete historical dossier for one selected strategy.',
    status: 'Stable',
  },
  replay: {
    title: 'Replay Engine',
    description: 'Replay one historical occurrence exactly as it happened.',
    status: 'Stable',
  },
  comparison: {
    title: 'Strategy Comparison',
    description: 'Compare 2–5 stored strategies side-by-side.',
    status: 'Experimental',
  },
  'probability-engine': {
    title: 'Probability Engine',
    description: 'Historical probability that a current gap compresses to lower target gaps.',
    status: 'Experimental',
  },
  'reliability-engine': {
    title: 'Reliability Engine',
    description: 'Stability and consistency scoring of historical results.',
    status: 'Coming Soon',
    about:
      'The Reliability Engine will measure how consistent a strategy has been across time, sessions and sub-samples of the uploaded data — surfacing variance, drawdown clusters and sample-size confidence — so you can see how stable a historical edge looks. It reads stored results only and makes no forward-looking claims.',
  },
  'walk-forward': {
    title: 'Walk Forward Validation',
    description: 'Out-of-sample style validation across historical windows.',
    status: 'Coming Soon',
    about:
      'Walk Forward Validation will split the uploaded history into sequential windows and check how a strategy’s historical statistics hold up window-to-window, highlighting periods of agreement and divergence. It is a descriptive robustness check over stored data — not a live test and not a prediction.',
  },
  'reports-daily': {
    title: 'Daily Reports',
    description: 'Per-day summaries of gap activity and outcomes.',
    status: 'Coming Soon',
    about:
      'Daily Reports will generate a clean, exportable per-day summary of gap activity, recoveries and outcomes from the uploaded dataset — suitable for record-keeping and review. It only formats data already computed by the existing modules.',
  },
  'reports-strategy': {
    title: 'Strategy Reports',
    description: 'Formatted research reports for stored strategies.',
    status: 'Coming Soon',
    about:
      'Strategy Reports will assemble the dossier, ranking context and comparison data for a strategy into a single formatted report for export. It composes existing stored results; no new research is run.',
  },
  'reports-probability': {
    title: 'Probability Reports',
    description: 'Exportable probability summaries for stored strategies.',
    status: 'Coming Soon',
    about:
      'Probability Reports will package the Probability Engine output into shareable, exportable summaries. It depends on the Probability Engine and reads stored historical evidence only.',
  },
  settings: {
    title: 'Settings',
    description: 'Configure analysis defaults and preferences.',
  },
};

/** Placeholder views — rendered with the coming-soon module placeholder. */
export const PLACEHOLDER_VIEWS: AppView[] = [
  'reliability-engine',
  'walk-forward',
  'reports-daily',
  'reports-strategy',
  'reports-probability',
];

export function isPlaceholderView(view: AppView): boolean {
  return PLACEHOLDER_VIEWS.includes(view);
}
