/**
 * Universal Search index registry (pure, read-only).
 *
 * Assembles the searchable index from two sources, WITHOUT recalculating any
 * research:
 *
 *   1. Stored Research Repository records → one searchable "research object" per
 *      record. Every field comes straight from the stored record.
 *   2. A static module registry → one navigation entry per GRT module, so search
 *      doubles as the universal navigation layer.
 *
 * Registering a future module with search is a one-line addition to
 * MODULE_REGISTRY below — modules never have to wire themselves into the search
 * UI directly.
 */

import type { RepositoryRecord } from '@/utils/researchRepository';
import type { SearchEntity, SearchModule } from '@/utils/searchEngine';
import type { AppView } from '@/context/DataContext';
import { fmtInt, fmtNumber } from '@/utils/format';

interface ModuleRegistration {
  module: SearchModule;
  view: AppView;
  title: string;
  summary: string;
  /** Extra keywords that should match this module. */
  keywords: string[];
}

/**
 * The official module registry. Every module that wants to be discoverable via
 * Universal Search registers itself here. Search retrieves; it never computes —
 * these are static navigation targets, not research results.
 */
export const MODULE_REGISTRY: ModuleRegistration[] = [
  {
    module: 'repository', view: 'repository', title: 'Research Repository',
    summary: 'Centralized store of completed strategy research results.',
    keywords: ['repository', 'store', 'records', 'strategies', 'saved'],
  },
  {
    module: 'ranking', view: 'ranking', title: 'Strategy Ranking',
    summary: 'Deterministic statistical ranking of stored strategies.',
    keywords: ['ranking', 'rank', 'score', 'leaderboard', 'best'],
  },
  {
    module: 'probability', view: 'probability-engine', title: 'Probability Engine',
    summary: 'Historical compression probability per target gap.',
    keywords: ['probability', 'compression', 'odds', 'likelihood'],
  },
  {
    module: 'opportunity', view: 'probability-engine', title: 'Opportunity Scanner',
    summary: 'Filtered, scored and ranked probability matrix.',
    keywords: ['opportunity', 'scanner', 'scan', 'opportunities'],
  },
  {
    module: 'reliability', view: 'reliability-engine', title: 'Reliability Engine',
    summary: 'How much to trust a stored result — deterministic reliability scoring.',
    keywords: ['reliability', 'trust', 'grade', 'confidence', 'stability'],
  },
  {
    module: 'walk-forward', view: 'walk-forward', title: 'Walk Forward Validation',
    summary: 'Validate a stored strategy on unseen training and validation windows.',
    keywords: ['walk forward', 'validation', 'robustness', 'unseen', 'passed'],
  },
  {
    module: 'replay', view: 'replay', title: 'Replay Engine',
    summary: 'Replay one historical occurrence exactly as it happened.',
    keywords: ['replay', 'occurrence', 'playback', 'reconstruct'],
  },
  {
    module: 'market', view: 'market-intelligence', title: 'Market Context',
    summary: 'Statistical description of the current market context from recent history.',
    keywords: ['market', 'context', 'regime', 'volatility', 'distribution'],
  },
  {
    module: 'reports', view: 'reports-daily', title: 'Reports',
    summary: 'Formatted, exportable research reports.',
    keywords: ['reports', 'export', 'pdf', 'daily', 'summary'],
  },
];

const n2 = (v: number | null) => fmtNumber(v, 2);

/** Builds one searchable research object from a stored Repository record. */
function entityFromRecord(rec: RepositoryRecord): SearchEntity {
  const sessions = rec.sessions.length ? rec.sessions.join(', ') : 'All sessions';
  const window = `${rec.dateFrom} → ${rec.dateTo}`;
  const title = `Entry ${n2(rec.entryGap)} → Recovery ${n2(rec.recoveryGap)} · SL ${n2(rec.stopLoss)}`;
  const summary =
    `${fmtInt(rec.historicalTrades)} historical positions · ` +
    `${fmtNumber(rec.recoveryBeforeSlPct, 1)}% recovered before SL · ` +
    `${rec.confidenceLabel} confidence`;

  const keyStats = [
    { label: 'Recovery %', value: `${fmtNumber(rec.recoveryBeforeSlPct, 1)}%` },
    { label: 'SL Hit %', value: `${fmtNumber(rec.slHitPct, 1)}%` },
    { label: 'Events', value: fmtInt(rec.historicalTrades) },
    { label: 'Holding', value: rec.avgHoldingSec == null ? '—' : `${fmtNumber(rec.avgHoldingSec / 60, 1)}m` },
    { label: 'Worst Gap', value: n2(rec.worstMaxGap) },
    { label: 'Confidence', value: rec.confidenceLabel },
  ];

  const haystack = [
    'repository strategy research',
    title,
    summary,
    sessions,
    window,
    rec.confidenceLabel,
    rec.id,
  ]
    .join(' ')
    .toLowerCase();

  return {
    id: `record:${rec.key}`,
    kind: 'record',
    module: 'repository',
    view: 'strategy-details',
    focusKey: rec.key,
    title,
    summary,
    keyStats,
    lastGenerated: rec.createdAt,
    researchWindow: `${window} · ${sessions}`,
    haystack,
    fields: {
      entryGap: rec.entryGap,
      recoveryGap: rec.recoveryGap,
      stopLoss: rec.stopLoss,
      recovery: rec.recoveryBeforeSlPct,
      sl: rec.slHitPct,
      events: rec.historicalTrades,
      holding: rec.avgHoldingSec == null ? null : rec.avgHoldingSec / 60,
      expansion: rec.avgMaxGap,
      worstExpansion: rec.worstMaxGap,
      p95Expansion: rec.p95MaxGap,
      sampleSize: rec.totalPositions,
      confidence: rec.confidenceLabel,
      session: sessions,
      date: `${rec.dateFrom} ${rec.dateTo}`,
      window,
    },
  };
}

function entityFromModule(reg: ModuleRegistration): SearchEntity {
  const haystack = [reg.title, reg.summary, ...reg.keywords].join(' ').toLowerCase();
  return {
    id: `module:${reg.module}`,
    kind: 'module',
    module: reg.module,
    view: reg.view,
    title: reg.title,
    summary: reg.summary,
    keyStats: [],
    lastGenerated: null,
    researchWindow: '—',
    haystack,
    fields: {},
  };
}

/**
 * Builds the complete search index. Pure: stored records + the static registry.
 * Records come first so research objects out-rank navigation entries on ties.
 */
export function buildSearchIndex(records: RepositoryRecord[]): SearchEntity[] {
  return [...records.map(entityFromRecord), ...MODULE_REGISTRY.map(entityFromModule)];
}
