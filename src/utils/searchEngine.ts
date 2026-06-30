/**
 * Universal Search Engine (pure, read-only).
 *
 * A discovery layer over already-indexed research data. It NEVER performs
 * calculations and NEVER mutates research — it parses a query, filters the
 * pre-built search index, ranks and groups the matches, and serialises them.
 *
 * The index itself (the `SearchEntity[]`) is assembled in `searchRegistry.ts`
 * from stored Repository records and the static module registry. This file only
 * understands how to query that index.
 */

import type { AppView } from '@/context/DataContext';
import type { SerializedExport } from '@/utils/reports';

// --- entity model -------------------------------------------------------------

export type SearchModule =
  | 'repository'
  | 'ranking'
  | 'probability'
  | 'opportunity'
  | 'reliability'
  | 'walk-forward'
  | 'replay'
  | 'market'
  | 'reports';

export const MODULE_LABELS: Record<SearchModule, string> = {
  repository: 'Research Repository',
  ranking: 'Strategy Ranking',
  probability: 'Probability Engine',
  opportunity: 'Opportunity Scanner',
  reliability: 'Reliability Engine',
  'walk-forward': 'Walk Forward Validation',
  replay: 'Replay Engine',
  market: 'Market Context',
  reports: 'Reports',
};

/** Display order for grouped results. */
export const MODULE_ORDER: SearchModule[] = [
  'repository',
  'ranking',
  'probability',
  'opportunity',
  'reliability',
  'walk-forward',
  'replay',
  'market',
  'reports',
];

export interface KeyStat {
  label: string;
  value: string;
}

export interface SearchEntity {
  /** Unique within the index — guarantees no duplicate results. */
  id: string;
  /** 'record' = a stored research object; 'module' = a navigation entry. */
  kind: 'record' | 'module';
  module: SearchModule;
  /** Where Quick Open navigates. */
  view: AppView;
  /** Repository key to focus when opening (Details / Replay read this). */
  focusKey?: string;
  occurrenceIndex?: number | null;
  title: string;
  summary: string;
  keyStats: KeyStat[];
  /** Epoch ms the underlying object was generated (null for static modules). */
  lastGenerated: number | null;
  researchWindow: string;
  /** Pre-lowercased keyword haystack. */
  haystack: string;
  /** Field values for advanced numeric / text filtering. */
  fields: Partial<Record<SearchField, number | string | null>>;
}

// --- searchable fields --------------------------------------------------------

export type SearchField =
  | 'entryGap'
  | 'recoveryGap'
  | 'stopLoss'
  | 'probability'
  | 'reliability'
  | 'events'
  | 'recovery'
  | 'sl'
  | 'holding'
  | 'expansion'
  | 'worstExpansion'
  | 'p95Expansion'
  | 'sampleSize'
  | 'confidence'
  | 'validation'
  | 'session'
  | 'date'
  | 'window';

interface FieldDef {
  field: SearchField;
  label: string;
  kind: 'number' | 'text';
  /** Recognised aliases (lower-case, no spaces) used in advanced queries. */
  aliases: string[];
}

export const FIELD_DEFS: FieldDef[] = [
  { field: 'entryGap', label: 'Entry Gap', kind: 'number', aliases: ['entry gap', 'entrygap', 'entry'] },
  { field: 'recoveryGap', label: 'Recovery Gap', kind: 'number', aliases: ['recovery gap', 'recoverygap', 'recgap'] },
  { field: 'stopLoss', label: 'Stop Loss', kind: 'number', aliases: ['stop loss', 'stoploss', 'sl', 'stop'] },
  { field: 'probability', label: 'Probability', kind: 'number', aliases: ['probability', 'prob'] },
  { field: 'reliability', label: 'Reliability', kind: 'number', aliases: ['reliability', 'trust'] },
  { field: 'events', label: 'Historical Events', kind: 'number', aliases: ['historical events', 'events', 'trades', 'occurrences'] },
  { field: 'recovery', label: 'Recovery %', kind: 'number', aliases: ['recovery', 'recoverypct', 'rec'] },
  { field: 'sl', label: 'SL Hit %', kind: 'number', aliases: ['sl hit', 'slpct', 'slhit', 'slhitpct'] },
  { field: 'holding', label: 'Holding (min)', kind: 'number', aliases: ['holding', 'hold', 'holdingmin'] },
  { field: 'expansion', label: 'Avg Expansion', kind: 'number', aliases: ['expansion', 'avgexpansion', 'exp'] },
  { field: 'worstExpansion', label: 'Worst Expansion', kind: 'number', aliases: ['worst expansion', 'worstexpansion', 'worst gap', 'worstgap', 'worst'] },
  { field: 'p95Expansion', label: 'P95 Expansion', kind: 'number', aliases: ['p95 expansion', 'p95expansion', 'p95 gap', 'p95gap', 'p95'] },
  { field: 'sampleSize', label: 'Sample Size', kind: 'number', aliases: ['sample size', 'samplesize', 'samples', 'positions'] },
  { field: 'confidence', label: 'Confidence', kind: 'text', aliases: ['confidence', 'conf'] },
  { field: 'validation', label: 'Validation Grade', kind: 'text', aliases: ['validation grade', 'validation', 'valid', 'grade'] },
  { field: 'session', label: 'Session', kind: 'text', aliases: ['session'] },
  { field: 'date', label: 'Date', kind: 'text', aliases: ['date'] },
  { field: 'window', label: 'Research Window', kind: 'text', aliases: ['research window', 'window', 'researchwindow'] },
];

const ALIAS_TO_FIELD = new Map<string, SearchField>();
for (const def of FIELD_DEFS) for (const a of def.aliases) ALIAS_TO_FIELD.set(a, def.field);
const FIELD_KIND = new Map<SearchField, 'number' | 'text'>(FIELD_DEFS.map((d) => [d.field, d.kind]));
// Longest aliases first so multi-word names ("worst expansion") win over the
// single words they contain ("worst", "expansion").
const ALIASES_BY_LENGTH = [...ALIAS_TO_FIELD.keys()].sort((a, b) => b.length - a.length);

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
const ALIAS_PATTERN = ALIASES_BY_LENGTH.map(escapeRegex).join('|');

// --- query parsing ------------------------------------------------------------

export type CompareOp = 'gt' | 'lt' | 'gte' | 'lte' | 'eq' | 'neq' | 'between';

export interface NumberCondition {
  kind: 'number';
  field: SearchField;
  label: string;
  op: CompareOp;
  value: number;
  value2: number | null; // for "between"
  raw: string;
}

export interface TextCondition {
  kind: 'text';
  field: SearchField;
  label: string;
  op: 'eq' | 'neq';
  value: string;
  raw: string;
}

export type Condition = NumberCondition | TextCondition;

export interface ParsedQuery {
  keywords: string[];
  conditions: Condition[];
  errors: string[];
  isEmpty: boolean;
}

const OP_MAP: Record<string, CompareOp> = {
  '>': 'gt',
  '<': 'lt',
  '>=': 'gte',
  '<=': 'lte',
  '=': 'eq',
  '==': 'eq',
  '!=': 'neq',
  ':': 'eq',
};

function labelFor(field: SearchField): string {
  return FIELD_DEFS.find((d) => d.field === field)?.label ?? field;
}

/**
 * Parses a free-form query into keyword tokens and structured conditions.
 * Supported: `field > n`, `field >= n`, `field = x`, `field != x`,
 * `field between a and b`, `field a..b`. Field names accept aliases. Anything
 * that is not a recognised condition is treated as a keyword.
 */
export function parseQuery(raw: string): ParsedQuery {
  const errors: string[] = [];
  const conditions: Condition[] = [];
  let remaining = ` ${raw} `;

  // 1) "field between a and b"
  const betweenRe = new RegExp(`\\b(${ALIAS_PATTERN})\\s+between\\s+(-?\\d+(?:\\.\\d+)?)\\s+and\\s+(-?\\d+(?:\\.\\d+)?)`, 'gi');
  remaining = remaining.replace(betweenRe, (_m, alias: string, a: string, b: string) => {
    const field = ALIAS_TO_FIELD.get(alias.toLowerCase());
    if (field && FIELD_KIND.get(field) === 'number') {
      conditions.push({
        kind: 'number', field, label: labelFor(field), op: 'between',
        value: Number(a), value2: Number(b), raw: `${labelFor(field)} between ${a} and ${b}`,
      });
    }
    return ' ';
  });

  // 2) "field <op> value"  (value may be a number, a a..b range, a word, or "quoted text")
  const condRe = new RegExp(`\\b(${ALIAS_PATTERN})\\s*(>=|<=|==|!=|>|<|=|:)\\s*("[^"]*"|[^\\s]+)`, 'gi');
  remaining = remaining.replace(condRe, (_m, alias: string, opRaw: string, valRaw: string) => {
    const field = ALIAS_TO_FIELD.get(alias.toLowerCase());
    if (!field) return _m;
    const op = OP_MAP[opRaw] ?? 'eq';
    const value = valRaw.replace(/^"|"$/g, '').trim();
    const kind = FIELD_KIND.get(field)!;

    if (kind === 'number') {
      const range = value.match(/^(-?\d+(?:\.\d+)?)\.\.(-?\d+(?:\.\d+)?)$/);
      if (range) {
        conditions.push({
          kind: 'number', field, label: labelFor(field), op: 'between',
          value: Number(range[1]), value2: Number(range[2]),
          raw: `${labelFor(field)} ${range[1]}..${range[2]}`,
        });
        return ' ';
      }
      const num = Number(value);
      if (!Number.isFinite(num)) {
        errors.push(`"${labelFor(field)}" expects a number (got "${value}").`);
        return ' ';
      }
      conditions.push({
        kind: 'number', field, label: labelFor(field), op: op === 'between' ? 'eq' : op,
        value: num, value2: null, raw: `${labelFor(field)} ${opRaw} ${value}`,
      });
      return ' ';
    }

    // text field
    const textOp: 'eq' | 'neq' = op === 'neq' ? 'neq' : 'eq';
    conditions.push({
      kind: 'text', field, label: labelFor(field), op: textOp,
      value, raw: `${labelFor(field)} ${textOp === 'neq' ? '≠' : '='} ${value}`,
    });
    return ' ';
  });

  const keywords = remaining
    .split(/\s+/)
    .map((t) => t.replace(/^"|"$/g, '').trim().toLowerCase())
    .filter((t) => t.length > 0);

  return {
    keywords,
    conditions,
    errors,
    // "Empty" means a genuine browse (no input at all) — NOT a query that
    // parsed down to nothing because it was invalid.
    isEmpty: keywords.length === 0 && conditions.length === 0 && errors.length === 0,
  };
}

// --- matching -----------------------------------------------------------------

const EPS = 1e-6;

function matchNumber(value: number, c: NumberCondition): boolean {
  switch (c.op) {
    case 'gt':
      return value > c.value;
    case 'lt':
      return value < c.value;
    case 'gte':
      return value >= c.value - EPS;
    case 'lte':
      return value <= c.value + EPS;
    case 'eq':
      return Math.abs(value - c.value) < EPS;
    case 'neq':
      return Math.abs(value - c.value) >= EPS;
    case 'between': {
      const lo = Math.min(c.value, c.value2 ?? c.value);
      const hi = Math.max(c.value, c.value2 ?? c.value);
      return value >= lo - EPS && value <= hi + EPS;
    }
  }
}

function matchCondition(entity: SearchEntity, c: Condition): boolean {
  const fv = entity.fields[c.field];
  if (fv == null) return false;
  if (c.kind === 'number') {
    if (typeof fv !== 'number') return false;
    return matchNumber(fv, c);
  }
  const hay = String(fv).toLowerCase();
  const needle = c.value.toLowerCase();
  const contains = hay.includes(needle);
  return c.op === 'neq' ? !contains : contains;
}

function matchKeywords(entity: SearchEntity, keywords: string[]): boolean {
  for (const k of keywords) if (!entity.haystack.includes(k)) return false;
  return true;
}

/** Relevance score (higher = better). Pure, deterministic. */
function relevance(entity: SearchEntity, keywords: string[]): number {
  let score = 0;
  const title = entity.title.toLowerCase();
  for (const k of keywords) {
    if (title.startsWith(k)) score += 6;
    else if (title.includes(k)) score += 3;
    else score += 1; // matched elsewhere in the haystack
  }
  // Module entries surface first when the query is purely navigational.
  if (entity.kind === 'module') score += keywords.length ? 1 : 4;
  return score;
}

export interface SearchOutcome {
  results: SearchEntity[];
  grouped: Array<{ module: SearchModule; label: string; items: SearchEntity[] }>;
  total: number;
}

/**
 * Runs the parsed query over the index. AND semantics across every condition and
 * keyword. Results are de-duplicated by id and ranked by relevance, then recency.
 */
export function runSearch(index: SearchEntity[], parsed: ParsedQuery): SearchOutcome {
  // An invalid-only query (e.g. "recovery > abc") parses to no usable terms.
  // Treat it as "no matches" rather than silently returning the whole index.
  if (parsed.conditions.length === 0 && parsed.keywords.length === 0 && parsed.errors.length > 0) {
    return { results: [], grouped: [], total: 0 };
  }

  const seen = new Set<string>();
  const matched: SearchEntity[] = [];

  for (const entity of index) {
    if (seen.has(entity.id)) continue;
    if (!parsed.conditions.every((c) => matchCondition(entity, c))) continue;
    if (!matchKeywords(entity, parsed.keywords)) continue;
    seen.add(entity.id);
    matched.push(entity);
  }

  matched.sort((a, b) => {
    const r = relevance(b, parsed.keywords) - relevance(a, parsed.keywords);
    if (r !== 0) return r;
    const t = (b.lastGenerated ?? 0) - (a.lastGenerated ?? 0);
    if (t !== 0) return t;
    return a.title.localeCompare(b.title);
  });

  const byModule = new Map<SearchModule, SearchEntity[]>();
  for (const e of matched) {
    const list = byModule.get(e.module);
    if (list) list.push(e);
    else byModule.set(e.module, [e]);
  }
  const grouped = MODULE_ORDER.filter((m) => byModule.has(m)).map((module) => ({
    module,
    label: MODULE_LABELS[module],
    items: byModule.get(module)!,
  }));

  return { results: matched, grouped, total: matched.length };
}

// --- export -------------------------------------------------------------------

function csvCell(v: string | number | null): string {
  if (v == null) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function searchResultsCsv(results: SearchEntity[]): SerializedExport {
  const lines = ['Module,Title,Summary,Research Window,Last Generated'];
  for (const r of results) {
    lines.push(
      [
        MODULE_LABELS[r.module],
        r.title,
        r.summary,
        r.researchWindow,
        r.lastGenerated ? new Date(r.lastGenerated).toISOString() : '',
      ]
        .map(csvCell)
        .join(','),
    );
  }
  return { filename: 'SearchResults.csv', content: lines.join('\n'), mime: 'text/csv' };
}

export function searchResultsJson(
  results: SearchEntity[],
  query: string,
  generatedAt: string,
): SerializedExport {
  const payload = {
    note: 'Universal Search results. A discovery layer only — no calculations are performed and no research is modified.',
    generatedAt,
    query,
    count: results.length,
    results: results.map((r) => ({
      module: MODULE_LABELS[r.module],
      title: r.title,
      summary: r.summary,
      keyStats: r.keyStats,
      researchWindow: r.researchWindow,
      lastGenerated: r.lastGenerated ? new Date(r.lastGenerated).toISOString() : null,
    })),
  };
  return { filename: 'SearchResults.json', content: JSON.stringify(payload, null, 2), mime: 'application/json' };
}
