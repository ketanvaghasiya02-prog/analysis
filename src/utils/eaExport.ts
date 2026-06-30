/**
 * EA Export Engine — the official integration layer (pure, read-only).
 *
 * Converts VERIFIED historical research into standardized, machine-importable
 * configuration profiles. It is a serialisation layer only:
 *   - It NEVER generates Expert Advisor / MQL5 source code.
 *   - It NEVER generates trading logic of any kind.
 *   - It NEVER recalculates research — every value is read verbatim from the
 *     frozen engines (Research Repository, Reliability, Walk Forward, Market
 *     Context), so exports match GRT exactly and are deterministic.
 *
 * Output formats: JSON, CSV, YAML, XML (a future binary profile can be added
 * without changing the profile model). Every export carries metadata and a
 * manifest with a content checksum, export version, creation time and record
 * count. Future brokers / APIs / automation consume these profiles instead of
 * touching internal calculations.
 */

import type { RepositoryRecord } from '@/utils/researchRepository';
import type { Dossier } from '@/utils/strategyDossier';
import type { ReliabilityResult, ComponentKey } from '@/utils/reliability';
import type { WalkForwardResult } from '@/utils/walkForward';
import { robustnessGrade } from '@/utils/walkForward';
import type { MarketContext } from '@/utils/marketContext';
import type { SerializedExport } from '@/utils/reports';

export const EA_EXPORT_VERSION = '1.0';
export const DOCUMENT_VERSION = '1.0';
export const RESEARCH_VERSION = 'Research Engine v1.0';
export const ENGINE_VERSION = 'GRT Engines v1.0';
export const REPOSITORY_VERSION = '1';
const PROJECT = 'Gap Research Terminal';

export type ExportProfileType =
  | 'research'
  | 'strategy'
  | 'probability'
  | 'reliability'
  | 'validation'
  | 'market-context'
  | 'complete'
  | 'ea-config';

export const PROFILE_LABELS: Record<ExportProfileType, string> = {
  research: 'Research Profile',
  strategy: 'Strategy Profile',
  probability: 'Probability Profile',
  reliability: 'Reliability Profile',
  validation: 'Validation Profile',
  'market-context': 'Market Context Profile',
  complete: 'Complete Research Package',
  'ea-config': 'EA Config Export',
};

export type ExportFormat = 'json' | 'csv' | 'yaml' | 'xml';

/** Round to kill float artefacts while preserving the stored value. */
function r(n: number | null | undefined, d = 4): number | null {
  if (n == null || Number.isNaN(n)) return null;
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

// --- deterministic content checksum (FNV-1a, no crypto, no async) -------------

function fnv1a(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** Stable JSON (objects are built in fixed key order → stable stringify). */
function stableJson(value: unknown): string {
  return JSON.stringify(value);
}

/** Deterministic content checksum, independent of the volatile creation time. */
export function checksumOf(content: unknown): string {
  return `grt1-${fnv1a(stableJson(content))}`;
}

// --- per-profile builders -----------------------------------------------------

/** Provenance for a strategy's research. */
export interface ProfileInput {
  record: RepositoryRecord;
  dossier: Dossier;
  reliability: ReliabilityResult;
  walk: WalkForwardResult | null;
}

export function buildResearchProfile(record: RepositoryRecord, csvSource: string[]) {
  return {
    project: PROJECT,
    researchVersion: RESEARCH_VERSION,
    researchDate: new Date(record.createdAt).toISOString(),
    researchWindow: record.sameDayOnly ? 'same-day-only' : 'multi-day',
    csvSource: csvSource.length ? csvSource : ['repository-only (source dataset not loaded)'],
    sessionFilter: record.sessions.length ? record.sessions : ['ALL'],
    dateRange: { from: record.dateFrom, to: record.dateTo },
  };
}

export function buildStrategyProfile(record: RepositoryRecord) {
  return {
    id: record.id,
    entryGap: r(record.entryGap),
    recoveryGap: r(record.recoveryGap),
    stopLoss: r(record.stopLoss),
    holdingSeconds: r(record.avgHoldingSec, 0),
    maximumHoldingSeconds: null as number | null, // not constrained in the stored research
    historicalEvents: record.historicalTrades,
    confidence: record.confidenceLabel,
  };
}

export function buildProbabilityProfile(record: RepositoryRecord, dossier: Dossier) {
  return {
    historicalProbabilityPct: r(record.recoveryBeforeSlPct, 2),
    recoveryAfterSlPct: r(record.recoveryAfterSlPct, 2),
    recoveryIgnoringSlPct: r(record.recoveryIgnoringSlPct, 2),
    stopLossHitPct: r(record.slHitPct, 2),
    // The per-session recovery matrix already computed for the dossier.
    probabilityMatrix: dossier.sessions.map((s) => ({
      session: s.session,
      occurrences: s.occurrences,
      recoveryPct: r(s.recoveryPct, 2),
      slHitPct: r(s.slHitPct, 2),
    })),
    averageRecoverySeconds: r(record.avgRecoverySec, 0),
    medianRecoverySeconds: r(record.medianRecoverySec, 0),
    fastestRecoverySeconds: r(dossier.recoveryTime.fastestSec, 0),
    slowestRecoverySeconds: r(dossier.recoveryTime.slowestSec, 0),
  };
}

function componentScore(rel: ReliabilityResult, key: ComponentKey): number | null {
  return r(rel.components.find((c) => c.key === key)?.score ?? null, 2);
}

export function buildReliabilityProfile(rel: ReliabilityResult) {
  return {
    reliabilityScore: r(rel.overall, 2),
    grade: rel.grade,
    sampleQuality: componentScore(rel, 'sampleSize'),
    probabilityStability: componentScore(rel, 'probabilityStability'),
    holdingStability: componentScore(rel, 'holdingStability'),
    expansionStability: componentScore(rel, 'expansionStability'),
    historicalConsistency: componentScore(rel, 'historicalConsistency'),
    sessionStability: componentScore(rel, 'sessionConsistency'),
    recentConsistency: componentScore(rel, 'recentConsistency'),
    sampleSize: rel.sampleSize,
    stars: rel.stars,
  };
}

export function buildValidationProfile(walk: WalkForwardResult | null) {
  if (!walk || walk.aggregate.totalWalks === 0) {
    return {
      available: false,
      note: 'Walk Forward Validation could not run: insufficient history for training/validation windows.',
      walkForwardGrade: null as string | null,
      validationPassed: 0,
      validationBorderline: 0,
      validationFailed: 0,
      robustnessScore: null as number | null,
      historicalDrift: null as number | null,
    };
  }
  const a = walk.aggregate;
  return {
    available: true,
    walkForwardGrade: a.avgRobustness == null ? null : robustnessGrade(a.avgRobustness),
    totalWalks: a.totalWalks,
    validationPassed: a.passed,
    validationBorderline: a.borderline,
    validationFailed: a.failed,
    robustnessScore: r(a.avgRobustness, 2),
    historicalDrift: r(a.avgDrift, 3),
    spanDays: walk.spanDays,
  };
}

export function buildMarketContextProfile(market: MarketContext | null) {
  if (!market || !market.current) {
    return { available: false, note: 'Market Context unavailable: no dataset loaded.' };
  }
  return {
    available: true,
    researchWindow: {
      days: market.windowDays,
      maxDays: market.maxWindowDays,
      start: market.windowStartDay,
      end: market.windowEndDay,
      daysCovered: market.windowDayCount,
      samples: market.windowSampleCount,
    },
    gapPercentileRecent: r(market.gapPercentileRecent, 2),
    session: market.current.session,
    marketRegime: { kind: market.marketRegime.kind, reason: market.marketRegime.reason },
    volatilityContext: {
      recentVolatility: r(market.recentVolatility, 4),
      averageDailyVolatility: r(market.averageDailyVolatility, 4),
      relativeVolatility: r(market.relativeVolatility, 4),
      volatilityPercentile: r(market.volPercentile, 2),
      expansionFrequencyPct: r(market.expansionPct, 2),
      compressionFrequencyPct: r(market.compressionPct, 2),
    },
    historicalPosition: {
      gapPercentileAll: r(market.gapPercentileAll, 2),
      currentGap: r(market.current.gap, 4),
    },
  };
}

/**
 * Flat EA configuration parameters — values only, NO executable code and NO
 * trading logic. A downstream system maps these to its own parameters.
 */
export function buildEaConfig(input: ProfileInput) {
  const { record, reliability, walk } = input;
  const v = buildValidationProfile(walk);
  return {
    name: record.id,
    entryGap: r(record.entryGap),
    recoveryGap: r(record.recoveryGap),
    stopLoss: r(record.stopLoss),
    holdingSeconds: r(record.avgHoldingSec, 0),
    maximumHoldingSeconds: null as number | null,
    historicalEvents: record.historicalTrades,
    historicalProbabilityPct: r(record.recoveryBeforeSlPct, 2),
    reliabilityScore: r(reliability.overall, 2),
    reliabilityGrade: reliability.grade,
    validationStatus: v.available ? `${v.validationPassed}/${(v as { totalWalks?: number }).totalWalks ?? 0} walks passed` : 'not-validated',
    validationRobustness: v.robustnessScore,
    note: 'Configuration parameters only. Contains no executable code and no trading logic. The export engine never trades.',
  };
}

function fullProfile(input: ProfileInput, csvSource: string[]) {
  return {
    research: buildResearchProfile(input.record, csvSource),
    strategy: buildStrategyProfile(input.record),
    probability: buildProbabilityProfile(input.record, input.dossier),
    reliability: buildReliabilityProfile(input.reliability),
    validation: buildValidationProfile(input.walk),
  };
}

// --- export document assembly -------------------------------------------------

export interface ExportParams {
  type: ExportProfileType;
  profiles: ProfileInput[];
  market: MarketContext | null;
  csvSource: string[];
  generatedAt: string;
}

export interface ExportDocument {
  project: string;
  exportType: string;
  metadata: {
    generatedTime: string;
    documentVersion: string;
    researchVersion: string;
    engineVersion: string;
    repositoryVersion: string;
  };
  manifest: {
    checksum: string;
    exportVersion: string;
    creationTime: string;
    recordCount: number;
  };
  content: Record<string, unknown>;
}

/** Assembles the export document. Pure; reuses already-computed research. */
export function buildExport(params: ExportParams): ExportDocument {
  const { type, profiles, market, csvSource } = params;

  let content: Record<string, unknown>;
  let recordCount = profiles.length;

  switch (type) {
    case 'research':
      content = { researchProfiles: profiles.map((p) => buildResearchProfile(p.record, csvSource)) };
      break;
    case 'strategy':
      content = { strategies: profiles.map((p) => buildStrategyProfile(p.record)) };
      break;
    case 'probability':
      content = { probability: profiles.map((p) => buildProbabilityProfile(p.record, p.dossier)) };
      break;
    case 'reliability':
      content = { reliability: profiles.map((p) => buildReliabilityProfile(p.reliability)) };
      break;
    case 'validation':
      content = { validation: profiles.map((p) => buildValidationProfile(p.walk)) };
      break;
    case 'market-context':
      content = { marketContext: buildMarketContextProfile(market) };
      recordCount = market?.current ? 1 : 0;
      break;
    case 'ea-config':
      content = { eaConfigs: profiles.map((p) => buildEaConfig(p)) };
      break;
    case 'complete':
    default:
      content = {
        strategies: profiles.map((p) => fullProfile(p, csvSource)),
        marketContext: buildMarketContextProfile(market),
      };
      break;
  }

  // Checksum covers ONLY the research content + project/type — never the
  // volatile timestamps — so the same research always checksums identically.
  const checksum = checksumOf({ project: PROJECT, type, content });

  return {
    project: PROJECT,
    exportType: PROFILE_LABELS[type],
    metadata: {
      generatedTime: params.generatedAt,
      documentVersion: DOCUMENT_VERSION,
      researchVersion: RESEARCH_VERSION,
      engineVersion: ENGINE_VERSION,
      repositoryVersion: REPOSITORY_VERSION,
    },
    manifest: {
      checksum,
      exportVersion: EA_EXPORT_VERSION,
      creationTime: params.generatedAt,
      recordCount,
    },
    content,
  };
}

// --- serialisers --------------------------------------------------------------

function sanitizeName(s: string): string {
  return s.replace(/[^a-z0-9_-]+/gi, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'export';
}

// CSV: flatten the document into dot-path Key,Value rows.
function flatten(value: unknown, path: string, out: Array<[string, string]>): void {
  if (value === null || value === undefined) {
    out.push([path, '']);
  } else if (Array.isArray(value)) {
    if (value.length === 0) out.push([path, '[]']);
    else value.forEach((v, i) => flatten(v, `${path}[${i}]`, out));
  } else if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) out.push([path, '{}']);
    else for (const [k, v] of entries) flatten(v, path ? `${path}.${k}` : k, out);
  } else {
    out.push([path, String(value)]);
  }
}

function csvCell(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function toCsv(doc: ExportDocument): string {
  const rows: Array<[string, string]> = [];
  flatten(doc, '', rows);
  const lines = ['Key,Value', ...rows.map(([k, v]) => `${csvCell(k)},${csvCell(v)}`)];
  return lines.join('\n');
}

// YAML: minimal, correct emitter for plain objects/arrays/primitives.
function yamlScalar(v: unknown): string {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  const s = String(v);
  // Quote any string that would otherwise be read back as a number, boolean,
  // null or empty — so types round-trip losslessly (e.g. version "1.0").
  const looksNonString = s === '' || /^(true|false|null|~|yes|no)$/i.test(s) || /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(s);
  if (!looksNonString && /^[\w.@/+-]+$/.test(s)) return s;
  return JSON.stringify(s);
}

function toYaml(value: unknown, indent: number): string {
  const pad = '  '.repeat(indent);
  if (Array.isArray(value)) {
    if (value.length === 0) return `${pad}[]\n`;
    return value
      .map((item) => {
        if (item !== null && typeof item === 'object') {
          // Render the item one level in, then turn the first line's indent
          // into a "- " bullet so subsequent lines stay aligned under it.
          const block = toYaml(item, indent + 1);
          const childPad = '  '.repeat(indent + 1);
          return block.replace(childPad, `${pad}- `);
        }
        return `${pad}- ${yamlScalar(item)}\n`;
      })
      .join('');
  }
  if (value !== null && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => {
        const key = xmlTagSafeYamlKey(k);
        if (Array.isArray(v)) {
          if (v.length === 0) return `${pad}${key}: []\n`;
          return `${pad}${key}:\n${toYaml(v, indent + 1)}`;
        }
        if (v !== null && typeof v === 'object') {
          return `${pad}${key}:\n${toYaml(v, indent + 1)}`;
        }
        return `${pad}${key}: ${yamlScalar(v)}\n`;
      })
      .join('');
  }
  return `${pad}${yamlScalar(value)}\n`;
}

function xmlTagSafeYamlKey(k: string): string {
  return /^[\w.-]+$/.test(k) ? k : JSON.stringify(k);
}

// XML: safe, generic emitter.
function xmlEsc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function xmlTag(key: string): string {
  const t = key.replace(/[^a-zA-Z0-9_.-]/g, '_');
  return /^[a-zA-Z_]/.test(t) ? t : `_${t}`;
}
function toXml(value: unknown, tag: string, indent: number): string {
  const pad = '  '.repeat(indent);
  const t = xmlTag(tag);
  if (value === null || value === undefined) return `${pad}<${t}/>\n`;
  if (Array.isArray(value)) {
    if (value.length === 0) return `${pad}<${t}/>\n`;
    const inner = value.map((item) => toXml(item, 'item', indent + 1)).join('');
    return `${pad}<${t}>\n${inner}${pad}</${t}>\n`;
  }
  if (typeof value === 'object') {
    const inner = Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => toXml(v, k, indent + 1))
      .join('');
    return `${pad}<${t}>\n${inner}${pad}</${t}>\n`;
  }
  return `${pad}<${t}>${xmlEsc(String(value))}</${t}>\n`;
}

/** Serialises an export document to the requested format. */
export function serializeExport(doc: ExportDocument, format: ExportFormat): SerializedExport {
  const base = `GRT_${sanitizeName(doc.exportType)}`;
  switch (format) {
    case 'json':
      return { filename: `${base}.json`, content: JSON.stringify(doc, null, 2), mime: 'application/json' };
    case 'csv':
      return { filename: `${base}.csv`, content: toCsv(doc), mime: 'text/csv' };
    case 'yaml':
      return { filename: `${base}.yaml`, content: toYaml(doc, 0), mime: 'text/yaml' };
    case 'xml':
      return { filename: `${base}.xml`, content: `<?xml version="1.0" encoding="UTF-8"?>\n${toXml(doc, 'GapResearchExport', 0)}`, mime: 'application/xml' };
  }
}

// --- export history -----------------------------------------------------------

export interface ExportHistoryEntry {
  time: string;
  type: string;
  format: ExportFormat;
  version: string;
  recordCount: number;
  checksum: string;
  status: 'success' | 'empty';
}
