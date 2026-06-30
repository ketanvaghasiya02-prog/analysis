/**
 * AI Research Assistant — deterministic explanation engine (read-only).
 *
 * This is an EXPLANATION LAYER, not a model that reasons about markets. It never
 * calculates research, never predicts, never invents statistics and never emits
 * Buy/Sell advice. Every figure it states is read verbatim from the frozen
 * engines (Research, Probability, Reliability, Walk Forward, Market Context) —
 * the same numbers shown elsewhere in GRT — so it is impossible for it to
 * hallucinate a statistic. Intent is classified deterministically; forbidden
 * questions are refused.
 *
 * The assistant holds no memory: it answers only from the context bundle the
 * caller assembles for the current question.
 */

import type { RepositoryRecord } from '@/utils/researchRepository';
import type { Dossier } from '@/utils/strategyDossier';
import type { ReliabilityResult } from '@/utils/reliability';
import type { WalkForwardResult } from '@/utils/walkForward';
import type { MarketContext } from '@/utils/marketContext';
import { fmtDuration, fmtInt, fmtNumber } from '@/utils/format';

export type AssistantMode = 'explain' | 'compare' | 'summarize' | 'definition' | 'navigation' | 'refusal' | 'help';

export interface AssistantAnswer {
  mode: AssistantMode;
  title: string;
  /** Grounded statements — every number comes from existing research. */
  facts: string[];
  /** Objective observations derived from the facts (no recommendations). */
  observations: string[];
  /** Provenance: which research the answer was read from. */
  sources: string[];
  researchWindow: string | null;
  sampleSize: number | null;
  disclaimer: string;
  /** Suggested follow-up questions. */
  followups: string[];
}

/** One side of a comparison / the subject of an explanation. */
export interface ResearchSubject {
  record: RepositoryRecord;
  dossier: Dossier;
  reliability: ReliabilityResult;
  walk: WalkForwardResult | null;
  /** Ranking context, when the subject arrived from the Ranking page. */
  rank?: number | null;
  overall?: number | null;
  modeLabel?: string | null;
}

export interface AssistantContext {
  primary: ResearchSubject | null;
  secondary: ResearchSubject | null;
  market: MarketContext | null;
  repositorySize: number;
}

const DISCLAIMER =
  'Historical research does not guarantee future behaviour. This explanation depends entirely on existing research computed by the frozen engines — it performs no new analysis.';

const pct = (n: number | null | undefined, d = 1) =>
  n == null || Number.isNaN(n) ? '—' : `${fmtNumber(n, d)}%`;
const num = (n: number | null | undefined, d = 2) => fmtNumber(n, d);

function subjectLabel(s: ResearchSubject): string {
  const r = s.record;
  return `Entry ${num(r.entryGap)} → Recovery ${num(r.recoveryGap)} · SL ${num(r.stopLoss)}`;
}
function windowLabel(r: RepositoryRecord): string {
  return `${r.dateFrom} → ${r.dateTo}${r.sessions.length ? ` · ${r.sessions.join(', ')}` : ' · all sessions'}`;
}

// --- definitions knowledge base ----------------------------------------------

interface Definition {
  term: string;
  aliases: string[];
  body: string;
}

const DEFINITIONS: Definition[] = [
  { term: 'Probability', aliases: ['probability', 'compression probability'], body: 'The Probability Engine reports the historical share of past events in which the gap compressed from the current level down to a lower target gap, within the chosen research window. It is descriptive frequency over real history — never a forecast of the next move.' },
  { term: 'Reliability', aliases: ['reliability', 'trust score'], body: 'Reliability (0–100, graded A+ down to Low) measures how much to trust a stored historical result. It is the weighted sum of seven deterministic components — sample quality, probability stability, holding stability, expansion stability, historical consistency, session consistency and recent consistency. Probability tells you WHAT happened; Reliability tells you HOW MUCH to trust it.' },
  { term: 'Walk Forward Validation', aliases: ['walk forward', 'walkforward', 'validation'], body: 'Walk Forward Validation re-evaluates a stored strategy across rolling training and validation windows of previously unseen history, then measures the drift between them. It checks robustness on out-of-sample windows. It never optimises parameters and never predicts.' },
  { term: 'Expansion', aliases: ['expansion'], body: 'Expansion is how far the gap widened against the position — the gap rising above the entry level. It is the adverse excursion a position sat through before resolving.' },
  { term: 'Worst Expansion', aliases: ['worst expansion', 'worst gap'], body: 'Worst expansion is the single largest adverse gap observed across all historical occurrences of the strategy — the deepest the gap ever went against the position.' },
  { term: 'Holding', aliases: ['holding', 'holding time'], body: 'Holding time is how long a simulated position stayed open — from entry until it reached recovery or the scan ended. One position is evaluated at a time.' },
  { term: 'P90', aliases: ['p90'], body: 'P90 expansion is the 90th percentile of maximum gap across occurrences: 90% of historical cases expanded no further than this value.' },
  { term: 'P95', aliases: ['p95'], body: 'P95 expansion is the 95th percentile of maximum gap across occurrences: only 5% of historical cases expanded further than this. It is a tail-risk descriptor.' },
  { term: 'Opportunity Score', aliases: ['opportunity score', 'opportunity'], body: 'The Opportunity Scanner score is a deterministic weighted blend of historical probability, time, expansion, event count and confidence. It is a ranking aid over existing probability results — explicitly not a recommendation.' },
  { term: 'Research Window', aliases: ['research window'], body: 'The research window is the span of trading days the statistics were drawn from. Recent windows (default 15–30 days) are prioritised because Gold Spot vs Gold Futures converge toward expiry, so older gaps become less representative.' },
  { term: 'Confidence', aliases: ['confidence'], body: 'Confidence is an event-count band (Very Low → Very High) reflecting how many historical occurrences support a result. It speaks to sample size, not to the likelihood of any future outcome.' },
  { term: 'Recovery before SL', aliases: ['recovery before sl', 'recovery before stop', 'recovery %'], body: 'Recovery before SL is the share of historical occurrences that reached the recovery gap before the maximum gap touched the stop-loss boundary. In the Research Engine the SL boundary classifies outcomes; it does not terminate the scan.' },
];

function findDefinition(q: string): Definition | null {
  const lower = q.toLowerCase();
  // Longest aliases first so "worst expansion" beats "expansion".
  const ranked = DEFINITIONS.flatMap((d) => d.aliases.map((a) => ({ d, a }))).sort((x, y) => y.a.length - x.a.length);
  for (const { d, a } of ranked) {
    if (new RegExp(`\\b${a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(lower)) return d;
  }
  return null;
}

// --- navigation map -----------------------------------------------------------

interface NavEntry {
  keywords: string[];
  name: string;
  section: string;
  how: string;
}

const NAV: NavEntry[] = [
  { keywords: ['probability', 'opportunity', 'scanner'], name: 'Probability Engine', section: 'Research', how: 'Open the Research section in the sidebar and choose Probability Engine. It needs a loaded dataset.' },
  { keywords: ['reliability', 'trust'], name: 'Reliability Engine', section: 'Research', how: 'Sidebar → Research → Reliability Engine. It reads stored repository results.' },
  { keywords: ['walk forward', 'walkforward', 'validate', 'validation', 'robust'], name: 'Walk Forward Validation', section: 'Research', how: 'Sidebar → Research → Walk Forward Validation. Pick a stored strategy to validate it across training/validation windows.' },
  { keywords: ['replay'], name: 'Replay Engine', section: 'Research', how: 'Open a strategy in Strategy Details, choose an occurrence, then Replay — or Sidebar → Research → Replay Engine.' },
  { keywords: ['report', 'pdf', 'export report'], name: 'Reporting Engine', section: 'Reports', how: 'Sidebar → Reports → Reporting Engine. Choose a report type, theme and format (PDF/CSV/JSON).' },
  { keywords: ['market', 'context', 'regime'], name: 'Market Context', section: 'Dashboard', how: 'Sidebar → Dashboard → Market Intelligence.' },
  { keywords: ['repository', 'stored', 'saved'], name: 'Research Repository', section: 'Research', how: 'Sidebar → Research → Research Repository.' },
  { keywords: ['ranking', 'rank', 'best strategy'], name: 'Strategy Ranking', section: 'Research', how: 'Sidebar → Research → Strategy Ranking.' },
  { keywords: ['finder', 'find strategy', 'generate strateg'], name: 'Historical Strategy Finder', section: 'Research', how: 'Sidebar → Research → Historical Strategy Finder. This is where new research is run.' },
  { keywords: ['search', 'find anything'], name: 'Universal Search', section: 'Dashboard', how: 'Sidebar → Dashboard → Universal Search, or press ⌘K / Ctrl-K anywhere.' },
  { keywords: ['compare', 'comparison'], name: 'Strategy Comparison', section: 'Research', how: 'Sidebar → Research → Strategy Comparison.' },
];

// --- intent classification ----------------------------------------------------

const FORBIDDEN = /\b(should i (?:buy|sell|enter|exit|trade)|buy|sell|go long|go short|will (?:it|price|gold|the market|this) (?:rise|fall|go up|go down|recover|drop|moon|crash)|predict|forecast tomorrow|tomorrow'?s? (?:price|move)|price target|entry signal|exit signal|trade signal|generate (?:a |an |some )?(?:signals?|entr(?:y|ies)|exits?|trades?)|what will happen|is it going to)\b/i;

type ExplainSub = 'general' | 'ranking' | 'reliability-lower' | 'validation-fail' | 'probability-vs-reliability' | 'market';

type Intent =
  | { kind: 'refusal' }
  | { kind: 'definition'; def: Definition }
  | { kind: 'navigation'; entry: NavEntry | null }
  | { kind: 'compare' }
  | { kind: 'summarize' }
  | { kind: 'explain'; sub: ExplainSub }
  | { kind: 'help' };

export function classify(question: string): Intent {
  const q = question.trim();
  const lower = q.toLowerCase();
  if (!q) return { kind: 'help' };
  if (FORBIDDEN.test(lower)) return { kind: 'refusal' };

  // Conceptual contrast (handle before the generic "reliability" term match).
  if (/(probability).*(vs|versus|differ|difference|compared).*(reliability)|(reliability).*(vs|versus|differ|difference|compared).*(probability)/.test(lower)) {
    return { kind: 'explain', sub: 'probability-vs-reliability' };
  }

  // Sub-explanations that reference a specific stored result.
  if (/(why|which|what).*(reliability).*(low|lower|reduced|drop|down)|which (metric|component).*(reduce|lower|hurt|drag)|what (reduced|lowered|hurt).*(score|reliability)/.test(lower)) {
    return { kind: 'explain', sub: 'reliability-lower' };
  }
  if (/(why).*(validation|walk ?forward).*(fail|failed|borderline)|(why).*(fail).*(validation)|did.*(validation|walk ?forward).*(fail)/.test(lower)) {
    return { kind: 'explain', sub: 'validation-fail' };
  }
  if (/(why).*(rank|ranked|first|top|#1|number one)/.test(lower)) {
    return { kind: 'explain', sub: 'ranking' };
  }
  if (/(market context|current market).*(unusual|why|differ|regime|context)|why.*(market).*(unusual|differ)/.test(lower)) {
    return { kind: 'explain', sub: 'market' };
  }

  // Compare two strategies.
  if (/\bcompare\b|\bvs\b|\bversus\b|difference between .* and /.test(lower)) {
    return { kind: 'compare' };
  }

  // Summarize a report / strategy.
  if (/\b(summari[sz]e|summary|tl;?dr|recap|overview of)\b/.test(lower)) {
    return { kind: 'summarize' };
  }

  // Navigation: where / how to open a module.
  if (/\b(where|how do i|how can i|open|navigate|go to|find|take me to|show me)\b/.test(lower)) {
    let entry: NavEntry | null = null;
    for (const e of NAV) if (e.keywords.some((k) => lower.includes(k))) { entry = e; break; }
    // Only treat as navigation when it actually targets a module or is clearly locational.
    if (entry || /\b(where|navigate|go to|take me to|open)\b/.test(lower)) return { kind: 'navigation', entry };
  }

  // Definitions: "explain/define/what is <term>" or a bare known term.
  if (/\b(explain|define|definition of|what(?:'s| is| are)|meaning of)\b/.test(lower)) {
    const def = findDefinition(lower);
    if (def && !/this (strategy|result|record|replay)|\bit\b/.test(lower)) return { kind: 'definition', def };
  }

  // Explain a strategy / this result.
  if (/\bexplain\b|why is this|tell me about|describe/.test(lower)) {
    return { kind: 'explain', sub: 'general' };
  }

  // Bare term → definition.
  const bare = findDefinition(lower);
  if (bare) return { kind: 'definition', def: bare };

  return { kind: 'help' };
}

// --- answer builders ----------------------------------------------------------

function needSubject(mode: AssistantMode, repositorySize: number): AssistantAnswer {
  return {
    mode,
    title: 'Select a strategy first',
    facts: repositorySize === 0
      ? ['The Research Repository is empty — there is no stored research to explain yet.']
      : ['No strategy is currently selected as the subject of this question.'],
    observations: repositorySize === 0
      ? ['Run the Historical Strategy Finder to research and store strategies; the assistant can then explain them.']
      : ['Choose a strategy from the subject selector, then ask again.'],
    sources: ['Research Repository'],
    researchWindow: null,
    sampleSize: null,
    disclaimer: DISCLAIMER,
    followups: repositorySize === 0 ? ['Where is the Historical Strategy Finder?'] : ['Explain this strategy', 'Why is reliability lower?'],
  };
}

function validationVerdict(w: WalkForwardResult | null): string {
  if (!w || w.aggregate.totalWalks === 0) return 'not available (insufficient history for walks)';
  const a = w.aggregate;
  if (a.failed > a.passed) return `failed more walks than it passed (${a.passed}/${a.totalWalks} passed)`;
  if (a.passed >= a.totalWalks * 0.6) return `passed (${a.passed}/${a.totalWalks} walks)`;
  return `borderline (${a.passed}/${a.totalWalks} walks passed)`;
}

function explainGeneral(s: ResearchSubject, market: MarketContext | null): AssistantAnswer {
  const r = s.record;
  const facts: string[] = [
    `Over ${fmtInt(r.historicalTrades)} historical occurrences in the window ${windowLabel(r)}, ${pct(r.recoveryBeforeSlPct)} recovered before the stop-loss boundary and ${pct(r.slHitPct)} reached it.`,
    `Historical recovery probability (recovered before SL) is ${pct(r.recoveryBeforeSlPct)}; recovery after SL adds ${pct(r.recoveryAfterSlPct)}.`,
    `Reliability is ${num(s.reliability.overall, 0)}/100 (grade ${s.reliability.grade}) across ${fmtInt(s.reliability.sampleSize)} occurrences — this is trust in the evidence, distinct from probability.`,
    `Walk Forward Validation ${validationVerdict(s.walk)}.`,
    `Worst expansion was ${num(r.worstMaxGap)} and P95 expansion ${num(r.p95MaxGap)}; average holding ${fmtDuration(r.avgHoldingSec)}.`,
  ];
  if (market && market.current) {
    facts.push(`Current Market Context: the live gap sits at the ${pct(market.gapPercentileRecent, 0)} percentile of the last ${fmtInt(market.windowDayCount)} trading days, regime ${market.marketRegime.kind}.`);
  } else {
    facts.push('Current Market Context is unavailable because no dataset is loaded.');
  }
  const observations: string[] = [...s.dossier.observations.slice(0, 2)];
  if (r.totalPositions < 25) observations.push('Historical sample is limited; treat the figures as specific to the studied window.');
  observations.push(`Confidence band: ${r.confidenceLabel}.`);

  return {
    mode: 'explain',
    title: `Explanation — ${subjectLabel(s)}`,
    facts,
    observations,
    sources: ['Research Repository', 'Reliability Engine', 'Walk Forward Validation', market?.current ? 'Market Context' : 'Repository only'],
    researchWindow: windowLabel(r),
    sampleSize: r.totalPositions,
    disclaimer: DISCLAIMER,
    followups: ['Why is reliability lower?', 'Why did validation fail?', 'Summarize this strategy'],
  };
}

function explainReliabilityLower(s: ResearchSubject): AssistantAnswer {
  const comps = s.reliability.components;
  // Rank by points LOST = weight × (100 − score). Presentation arithmetic over
  // already-computed component scores — no new research.
  const ranked = [...comps].map((c) => ({ c, lost: (c.weight * (100 - c.score)) / 100 })).sort((a, b) => b.lost - a.lost);
  const top = ranked.slice(0, 3);
  const facts = [
    `Overall reliability is ${num(s.reliability.overall, 0)}/100 (grade ${s.reliability.grade}) over ${fmtInt(s.reliability.sampleSize)} occurrences.`,
    ...top.map(({ c, lost }) => `${c.label}: scored ${num(c.score, 0)}/100 (weight ${c.weight}) — it cost about ${num(lost, 1)} points. ${c.detail}`),
  ];
  const observations = [
    `The biggest drag is ${top[0]?.c.label ?? '—'}; raising it would lift the score the most.`,
    'Each component is deterministic and explicitly weighted — there is no hidden adjustment.',
  ];
  return {
    mode: 'explain',
    title: `Why reliability is ${s.reliability.grade} — ${subjectLabel(s)}`,
    facts,
    observations,
    sources: ['Reliability Engine'],
    researchWindow: windowLabel(s.record),
    sampleSize: s.reliability.sampleSize,
    disclaimer: DISCLAIMER,
    followups: ['How does Probability differ from Reliability?', 'Explain reliability'],
  };
}

function explainValidationFail(s: ResearchSubject): AssistantAnswer {
  const w = s.walk;
  if (!w || w.aggregate.totalWalks === 0) {
    return {
      mode: 'explain',
      title: `Validation — ${subjectLabel(s)}`,
      facts: ['Walk Forward Validation could not run: the stored history does not span enough days to form training and validation windows.'],
      observations: ['A longer research window (more trading days) is needed before robustness can be validated.'],
      sources: ['Walk Forward Validation'],
      researchWindow: windowLabel(s.record),
      sampleSize: s.record.totalPositions,
      disclaimer: DISCLAIMER,
      followups: ['Explain walk forward', 'Explain this strategy'],
    };
  }
  const a = w.aggregate;
  const facts = [
    `Across ${fmtInt(a.totalWalks)} rolling walks: ${fmtInt(a.passed)} passed, ${fmtInt(a.borderline)} borderline, ${fmtInt(a.failed)} failed.`,
    `Average robustness ${a.avgRobustness == null ? '—' : num(a.avgRobustness, 0)}/100; mean recovery drift between training and validation windows ${a.avgDrift == null ? '—' : `${num(a.avgDrift, 1)} points`}.`,
  ];
  const observations: string[] = [];
  if (a.failed > a.passed) observations.push('More walks failed than passed — recovery did not hold up consistently on unseen windows.');
  else if (a.passed >= a.totalWalks * 0.6) observations.push('The majority of walks passed — recovery stayed consistent across unseen windows.');
  else observations.push('Results are mixed (borderline) — robustness is partial.');
  if (a.avgDrift != null && a.avgDrift >= 10) observations.push(`A drift of ${num(a.avgDrift, 1)} points indicates the validation windows behaved noticeably differently from training.`);
  return {
    mode: 'explain',
    title: `Why validation is ${validationVerdict(w)} — ${subjectLabel(s)}`,
    facts,
    observations,
    sources: ['Walk Forward Validation'],
    researchWindow: windowLabel(s.record),
    sampleSize: s.record.totalPositions,
    disclaimer: DISCLAIMER,
    followups: ['Explain walk forward', 'Why is reliability lower?'],
  };
}

function explainRanking(s: ResearchSubject): AssistantAnswer {
  const facts: string[] = [];
  if (s.rank != null) {
    facts.push(`This strategy is ranked #${s.rank}${s.modeLabel ? ` under the "${s.modeLabel}" mode` : ''}${s.overall != null ? ` with an overall score of ${num(s.overall, 1)}` : ''}.`);
  } else {
    facts.push('No ranking context was carried into this question. Open the Strategy Ranking module to see this strategy ranked.');
  }
  facts.push(`Supporting figures: recovery ${pct(s.record.recoveryBeforeSlPct)}, reliability ${num(s.reliability.overall, 0)}/100, ${fmtInt(s.record.totalPositions)} historical events, confidence ${s.record.confidenceLabel}.`);
  return {
    mode: 'explain',
    title: `Ranking context — ${subjectLabel(s)}`,
    facts,
    observations: [
      'Ranking is deterministic: a fixed, explicit weighting over recovery, reliability, sample size and risk. No AI or hidden weighting is involved.',
      'A high rank reflects historical evidence in the studied window only.',
    ],
    sources: ['Strategy Ranking', 'Research Repository', 'Reliability Engine'],
    researchWindow: windowLabel(s.record),
    sampleSize: s.record.totalPositions,
    disclaimer: DISCLAIMER,
    followups: ['Explain this strategy', 'Why is reliability lower?'],
  };
}

function explainProbabilityVsReliability(): AssistantAnswer {
  const probDef = DEFINITIONS.find((d) => d.term === 'Probability')!;
  const relDef = DEFINITIONS.find((d) => d.term === 'Reliability')!;
  return {
    mode: 'explain',
    title: 'Probability vs Reliability',
    facts: [
      `Probability — ${probDef.body}`,
      `Reliability — ${relDef.body}`,
    ],
    observations: [
      'In short: Probability answers "what happened, how often?"; Reliability answers "how much should I trust that number?".',
      'A high probability with low reliability means the pattern was strong but thinly or unevenly evidenced.',
    ],
    sources: ['Probability Engine', 'Reliability Engine'],
    researchWindow: null,
    sampleSize: null,
    disclaimer: DISCLAIMER,
    followups: ['Explain reliability', 'Explain probability'],
  };
}

function explainMarket(market: MarketContext | null): AssistantAnswer {
  if (!market || !market.current) {
    return {
      mode: 'explain',
      title: 'Current Market Context',
      facts: ['Market Context is unavailable because no dataset is loaded.'],
      observations: ['Upload a GapMonitor CSV export to describe the current market context.'],
      sources: ['Market Context'],
      researchWindow: null,
      sampleSize: null,
      disclaimer: DISCLAIMER,
      followups: ['Where is Market Context?'],
    };
  }
  const facts = [
    `The current gap (${num(market.current.gap)}) is at the ${pct(market.gapPercentileRecent, 0)} percentile of the last ${fmtInt(market.windowDayCount)} trading days.`,
    `Market regime is ${market.marketRegime.kind}: ${market.marketRegime.reason}`,
    `Relative volatility is ${market.relativeVolatility == null ? '—' : `${num(market.relativeVolatility, 2)}×`} the recent daily average; expansion moves ${pct(market.expansionPct, 0)} vs compression ${pct(market.compressionPct, 0)}.`,
  ];
  return {
    mode: 'explain',
    title: 'Why the current market context looks the way it does',
    facts,
    observations: market.observations.slice(0, 3),
    sources: ['Market Context'],
    researchWindow: `${market.windowStartDay ?? '—'} → ${market.windowEndDay ?? '—'} · ${fmtInt(market.windowDayCount)} days`,
    sampleSize: market.windowSampleCount,
    disclaimer: DISCLAIMER,
    followups: ['Explain expansion', 'Explain research window'],
  };
}

function compareSubjects(a: ResearchSubject, b: ResearchSubject): AssistantAnswer {
  const ra = a.record;
  const rb = b.record;
  const diff = (x: number, y: number, unit = '') => {
    const d = x - y;
    const who = Math.abs(d) < 1e-9 ? 'equal' : d > 0 ? 'A is higher' : 'B is higher';
    return `${who} by ${num(Math.abs(d), 1)}${unit}`;
  };
  const facts = [
    `Recovery before SL — A ${pct(ra.recoveryBeforeSlPct)} vs B ${pct(rb.recoveryBeforeSlPct)} (${diff(ra.recoveryBeforeSlPct, rb.recoveryBeforeSlPct, ' pts')}).`,
    `Reliability — A ${num(a.reliability.overall, 0)}/100 (${a.reliability.grade}) vs B ${num(b.reliability.overall, 0)}/100 (${b.reliability.grade}) (${diff(a.reliability.overall, b.reliability.overall)}).`,
    `Validation — A ${validationVerdict(a.walk)}; B ${validationVerdict(b.walk)}.`,
    `Worst expansion — A ${num(ra.worstMaxGap)} vs B ${num(rb.worstMaxGap)}; P95 — A ${num(ra.p95MaxGap)} vs B ${num(rb.p95MaxGap)}.`,
    `Average holding — A ${fmtDuration(ra.avgHoldingSec)} vs B ${fmtDuration(rb.avgHoldingSec)}.`,
    `Historical sample — A ${fmtInt(ra.totalPositions)} events vs B ${fmtInt(rb.totalPositions)} events.`,
  ];
  const observations: string[] = [];
  observations.push(ra.recoveryBeforeSlPct > rb.recoveryBeforeSlPct ? 'Strategy A recovered more often in its window; Strategy B less so.' : rb.recoveryBeforeSlPct > ra.recoveryBeforeSlPct ? 'Strategy B recovered more often in its window; Strategy A less so.' : 'Both recovered at a similar historical rate.');
  observations.push(a.reliability.overall === b.reliability.overall ? 'Both carry similar reliability.' : `Reliability favours Strategy ${a.reliability.overall > b.reliability.overall ? 'A' : 'B'} — its evidence is more trustworthy.`);
  observations.push('Windows and sessions may differ; compare like-for-like before drawing conclusions.');
  return {
    mode: 'compare',
    title: `Comparison — A: ${subjectLabel(a)} vs B: ${subjectLabel(b)}`,
    facts,
    observations,
    sources: ['Research Repository', 'Reliability Engine', 'Walk Forward Validation'],
    researchWindow: `A: ${windowLabel(ra)} | B: ${windowLabel(rb)}`,
    sampleSize: Math.min(ra.totalPositions, rb.totalPositions),
    disclaimer: DISCLAIMER,
    followups: ['Explain strategy A', 'Why is reliability lower?'],
  };
}

function summarizeSubject(s: ResearchSubject): AssistantAnswer {
  const r = s.record;
  const facts = [
    `Subject: ${subjectLabel(s)} · window ${windowLabel(r)}.`,
    `Key findings: ${fmtInt(r.historicalTrades)} events, ${pct(r.recoveryBeforeSlPct)} recovered before SL, reliability ${num(s.reliability.overall, 0)}/100 (${s.reliability.grade}), validation ${validationVerdict(s.walk)}.`,
    `Risk profile: worst expansion ${num(r.worstMaxGap)}, P95 ${num(r.p95MaxGap)}, average holding ${fmtDuration(r.avgHoldingSec)}.`,
  ];
  const observations = [
    ...s.dossier.observations.slice(0, 3),
  ];
  const limitations = [
    'Historical observations only; not predictive.',
    r.totalPositions < 25 ? 'Sample size is limited.' : 'Sample size is adequate for the studied window.',
  ];
  return {
    mode: 'summarize',
    title: `Summary — ${subjectLabel(s)}`,
    facts,
    observations: [...observations, ...limitations],
    sources: ['Research Repository', 'Reliability Engine', 'Walk Forward Validation'],
    researchWindow: windowLabel(r),
    sampleSize: r.totalPositions,
    disclaimer: DISCLAIMER,
    followups: ['Explain this strategy', 'Compare with another strategy'],
  };
}

function definitionAnswer(def: Definition): AssistantAnswer {
  return {
    mode: 'definition',
    title: `Definition — ${def.term}`,
    facts: [def.body],
    observations: [],
    sources: ['GRT definitions'],
    researchWindow: null,
    sampleSize: null,
    disclaimer: DISCLAIMER,
    followups: ['How does Probability differ from Reliability?', 'Explain P95'],
  };
}

function navigationAnswer(entry: NavEntry | null): AssistantAnswer {
  if (!entry) {
    return {
      mode: 'navigation',
      title: 'Navigation',
      facts: [
        'GRT is organised into Dashboard, Research, Reports and Settings sections in the left sidebar.',
        'Press ⌘K / Ctrl-K anywhere to open Universal Search and jump to any module or stored result.',
      ],
      observations: [],
      sources: ['Navigation'],
      researchWindow: null,
      sampleSize: null,
      disclaimer: DISCLAIMER,
      followups: ['Where is the Probability Engine?', 'How do I validate a strategy?'],
    };
  }
  return {
    mode: 'navigation',
    title: `Find: ${entry.name}`,
    facts: [`${entry.name} lives in the ${entry.section} section.`, entry.how],
    observations: [],
    sources: ['Navigation'],
    researchWindow: null,
    sampleSize: null,
    disclaimer: DISCLAIMER,
    followups: ['Open Reports', 'Where is Replay?'],
  };
}

function refusalAnswer(): AssistantAnswer {
  return {
    mode: 'refusal',
    title: 'That question is outside what this assistant does',
    facts: [
      'The AI Research Assistant explains existing historical research. It does not give Buy/Sell advice, generate signals, or predict future prices or market direction.',
    ],
    observations: [
      'I can instead explain what the history shows — for example: "Explain this strategy", "Why is reliability lower?", "How does probability differ from reliability?", or "Why is the current market context unusual?".',
    ],
    sources: [],
    researchWindow: null,
    sampleSize: null,
    disclaimer: DISCLAIMER,
    followups: ['Explain this strategy', 'Summarize this strategy', 'Explain probability'],
  };
}

function helpAnswer(): AssistantAnswer {
  return {
    mode: 'help',
    title: 'Ask about your research',
    facts: [
      'I explain, compare and summarise existing research, and define metrics. I read only what the frozen engines have already computed.',
    ],
    observations: [
      'Try: "Explain this strategy", "Compare A vs B", "Why did validation fail?", "Explain P95", or "Where is the Probability Engine?".',
    ],
    sources: [],
    researchWindow: null,
    sampleSize: null,
    disclaimer: DISCLAIMER,
    followups: ['Explain this strategy', 'How does Probability differ from Reliability?', 'Where is Reporting Engine?'],
  };
}

/** Main entry: deterministically answers one question from existing research. */
export function answerQuestion(question: string, ctx: AssistantContext): AssistantAnswer {
  const intent = classify(question);
  switch (intent.kind) {
    case 'refusal':
      return refusalAnswer();
    case 'definition':
      return definitionAnswer(intent.def);
    case 'navigation':
      return navigationAnswer(intent.entry);
    case 'help':
      return helpAnswer();
    case 'compare':
      if (!ctx.primary || !ctx.secondary) {
        const a = needSubject('compare', ctx.repositorySize);
        a.observations = ctx.primary ? ['Select a second strategy to compare against.'] : a.observations;
        return a;
      }
      return compareSubjects(ctx.primary, ctx.secondary);
    case 'summarize':
      return ctx.primary ? summarizeSubject(ctx.primary) : needSubject('summarize', ctx.repositorySize);
    case 'explain':
      switch (intent.sub) {
        case 'probability-vs-reliability':
          return explainProbabilityVsReliability();
        case 'market':
          return explainMarket(ctx.market);
        case 'reliability-lower':
          return ctx.primary ? explainReliabilityLower(ctx.primary) : needSubject('explain', ctx.repositorySize);
        case 'validation-fail':
          return ctx.primary ? explainValidationFail(ctx.primary) : needSubject('explain', ctx.repositorySize);
        case 'ranking':
          return ctx.primary ? explainRanking(ctx.primary) : needSubject('explain', ctx.repositorySize);
        default:
          return ctx.primary ? explainGeneral(ctx.primary, ctx.market) : needSubject('explain', ctx.repositorySize);
      }
  }
}

// --- export -------------------------------------------------------------------

export interface AssistantTurn {
  question: string;
  answer: AssistantAnswer;
}

export function answerMarkdown(answer: AssistantAnswer): string {
  const lines: string[] = [`### ${answer.title}`, ''];
  if (answer.facts.length) {
    lines.push('**Facts (from existing research):**');
    for (const f of answer.facts) lines.push(`- ${f}`);
    lines.push('');
  }
  if (answer.observations.length) {
    lines.push('**Observations:**');
    for (const o of answer.observations) lines.push(`- ${o}`);
    lines.push('');
  }
  const meta: string[] = [];
  if (answer.researchWindow) meta.push(`Research window: ${answer.researchWindow}`);
  if (answer.sampleSize != null) meta.push(`Sample size: ${fmtInt(answer.sampleSize)} occurrences`);
  if (answer.sources.length) meta.push(`Sources: ${answer.sources.join(', ')}`);
  if (meta.length) {
    for (const m of meta) lines.push(`_${m}_  `);
    lines.push('');
  }
  lines.push(`> ${answer.disclaimer}`);
  return lines.join('\n');
}

export function transcriptMarkdown(turns: AssistantTurn[], generatedAt: string): string {
  const head = [
    '# Gap Research Terminal — AI Research Assistant',
    '',
    `_Generated ${generatedAt}. Deterministic explanation of existing research — no prediction, no recommendation._`,
    '',
  ];
  const body = turns.map((t) => `**Q:** ${t.question}\n\n${answerMarkdown(t.answer)}`).join('\n\n---\n\n');
  return [...head, body].join('\n');
}

export function transcriptText(turns: AssistantTurn[], generatedAt: string): string {
  const out: string[] = ['GAP RESEARCH TERMINAL — AI RESEARCH ASSISTANT', `Generated ${generatedAt}`, ''];
  for (const t of turns) {
    out.push(`Q: ${t.question}`);
    out.push(`A: ${t.answer.title}`);
    if (t.answer.facts.length) {
      out.push('Facts:');
      for (const f of t.answer.facts) out.push(`  - ${f}`);
    }
    if (t.answer.observations.length) {
      out.push('Observations:');
      for (const o of t.answer.observations) out.push(`  - ${o}`);
    }
    if (t.answer.researchWindow) out.push(`Research window: ${t.answer.researchWindow}`);
    if (t.answer.sampleSize != null) out.push(`Sample size: ${fmtInt(t.answer.sampleSize)} occurrences`);
    if (t.answer.sources.length) out.push(`Sources: ${t.answer.sources.join(', ')}`);
    out.push(t.answer.disclaimer);
    out.push('');
  }
  return out.join('\n');
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Opens a print-ready window of the conversation (browser Save as PDF). */
export function printTranscriptPdf(turns: AssistantTurn[], generatedAt: string): void {
  const body = turns
    .map((t) => {
      const a = t.answer;
      const facts = a.facts.map((f) => `<li>${esc(f)}</li>`).join('');
      const obs = a.observations.map((o) => `<li>${esc(o)}</li>`).join('');
      const meta: string[] = [];
      if (a.researchWindow) meta.push(`Research window: ${esc(a.researchWindow)}`);
      if (a.sampleSize != null) meta.push(`Sample size: ${fmtInt(a.sampleSize)} occurrences`);
      if (a.sources.length) meta.push(`Sources: ${esc(a.sources.join(', '))}`);
      return `<div class="turn"><div class="q">Q: ${esc(t.question)}</div>
<div class="a-title">${esc(a.title)}</div>
${facts ? `<div class="lbl">Facts</div><ul>${facts}</ul>` : ''}
${obs ? `<div class="lbl">Observations</div><ul>${obs}</ul>` : ''}
${meta.length ? `<div class="meta">${meta.join(' · ')}</div>` : ''}
<div class="disc">${esc(a.disclaimer)}</div></div>`;
    })
    .join('');
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<title>AI Research Assistant — Transcript</title>
<style>
  body{font-family:Inter,system-ui,sans-serif;color:#0b1220;margin:24px;font-size:12.5px;line-height:1.5}
  h1{font-size:18px;margin:0 0 2px} .sub{color:#64748b;font-size:11px;margin-bottom:16px}
  .turn{border:1px solid #e2e8f0;border-radius:8px;padding:12px 14px;margin-bottom:14px;break-inside:avoid}
  .q{font-weight:600;color:#0369a1;margin-bottom:6px}
  .a-title{font-weight:600;margin-bottom:6px}
  .lbl{font-size:9.5px;text-transform:uppercase;letter-spacing:.05em;color:#64748b;margin-top:6px}
  ul{margin:4px 0 4px 18px} li{margin:2px 0;color:#334155}
  .meta{font-size:11px;color:#475569;margin-top:6px}
  .disc{font-size:10.5px;color:#64748b;font-style:italic;margin-top:6px;border-top:1px solid #e2e8f0;padding-top:6px}
  @media print{body{margin:0 12px}}
</style></head><body>
<h1>Gap Research Terminal — AI Research Assistant</h1>
<div class="sub">Generated ${esc(generatedAt)}. Deterministic explanation of existing research — no prediction, no recommendation.</div>
${body}
</body></html>`;
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 300);
}
