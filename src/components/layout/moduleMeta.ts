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
  search: {
    title: 'Universal Search',
    description: 'Locate any stored research result or module — discovery only, no calculations.',
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
    description: 'How much to trust a stored historical result — deterministic reliability scoring.',
    status: 'Experimental',
  },
  'walk-forward': {
    title: 'Walk Forward Validation',
    description: 'Validate a stored strategy on unseen historical windows (training vs validation).',
    status: 'Experimental',
  },
  assistant: {
    title: 'AI Research Assistant',
    description: 'Explains, compares and summarises existing research — interpretive only, never calculates or predicts.',
    status: 'Experimental',
  },
  reports: {
    title: 'Reporting Engine',
    description: 'Generate professional, descriptive reports from existing research (PDF / CSV / JSON).',
    status: 'Experimental',
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
  'reports-daily',
  'reports-strategy',
  'reports-probability',
];

export function isPlaceholderView(view: AppView): boolean {
  return PLACEHOLDER_VIEWS.includes(view);
}
