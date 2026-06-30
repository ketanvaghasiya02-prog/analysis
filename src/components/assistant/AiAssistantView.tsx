/**
 * AI Research Assistant — view (explanation layer, read-only).
 *
 * A chat-style surface over the deterministic assistant engine. It assembles a
 * context bundle from existing research (a chosen subject strategy, an optional
 * comparison strategy, and Market Context when a dataset is loaded) using the
 * SAME frozen engines the rest of GRT uses, then asks the engine to explain.
 * It never triggers new research and holds no persistent memory — the
 * conversation lives only in component state.
 */

import { useMemo, useRef, useState } from 'react';
import { useData } from '@/context/DataContext';
import { useRepository } from '@/context/RepositoryContext';
import { useStrategyFocus } from '@/context/StrategyFocusContext';
import type { RepositoryRecord } from '@/utils/researchRepository';
import { buildDossier } from '@/utils/strategyDossier';
import { buildReliability, DEFAULT_RELIABILITY_CONFIG } from '@/utils/reliability';
import { buildWalkForward, DEFAULT_WALK_FORWARD_CONFIG } from '@/utils/walkForward';
import { buildMarketContext, DEFAULT_MARKET_CONTEXT_INPUT } from '@/utils/marketContext';
import {
  answerQuestion,
  printTranscriptPdf,
  transcriptMarkdown,
  transcriptText,
  type AssistantContext,
  type AssistantTurn,
  type ResearchSubject,
} from '@/utils/aiAssistant';
import { downloadExport } from '@/utils/reports';
import { EmptyState } from '@/components/common/EmptyState';
import { ChatIcon, DownloadIcon, TrashIcon } from '@/components/common/icons';

const QUICK_QUESTIONS = [
  'Explain this strategy',
  'Why is reliability lower?',
  'Why did validation fail?',
  'Why is this ranked first?',
  'Compare A vs B',
  'Summarize this strategy',
  'How does Probability differ from Reliability?',
  'Why is the current market context unusual?',
  'Explain P95',
  'Explain expansion',
  'Where is the Reporting Engine?',
];

const MODE_TONE: Record<string, string> = {
  explain: 'border-accent/40 bg-accent/10 text-accent',
  compare: 'border-positive/40 bg-positive/10 text-positive',
  summarize: 'border-warning/40 bg-warning/10 text-warning',
  definition: 'border-accent/40 bg-accent/10 text-accent',
  navigation: 'border-ink-faint/30 bg-panel-raised text-ink-muted',
  refusal: 'border-negative/40 bg-negative/10 text-negative',
  help: 'border-ink-faint/30 bg-panel-raised text-ink-muted',
};

function buildSubject(record: RepositoryRecord, focus?: { rank?: number | null; overall?: number | null; modeLabel?: string | null }): ResearchSubject {
  return {
    record,
    dossier: buildDossier(record),
    reliability: buildReliability(record, DEFAULT_RELIABILITY_CONFIG),
    walk: buildWalkForward(record, DEFAULT_WALK_FORWARD_CONFIG),
    rank: focus?.rank ?? null,
    overall: focus?.overall ?? null,
    modeLabel: focus?.modeLabel ?? null,
  };
}

export function AiAssistantView() {
  const { dataset } = useData();
  const { records } = useRepository();
  const { focus } = useStrategyFocus();

  const [primaryKey, setPrimaryKey] = useState<string | null>(null);
  const [secondaryKey, setSecondaryKey] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [turns, setTurns] = useState<AssistantTurn[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const samples = dataset?.samples ?? [];

  const primaryRecord = useMemo(
    () => records.find((r) => r.key === (primaryKey ?? focus?.key)) ?? records[0] ?? null,
    [records, primaryKey, focus],
  );
  const secondaryRecord = useMemo(
    () => records.find((r) => r.key === secondaryKey) ?? null,
    [records, secondaryKey],
  );

  const ctx: AssistantContext = useMemo(() => {
    const primary = primaryRecord
      ? buildSubject(primaryRecord, primaryRecord.key === focus?.key ? focus ?? undefined : undefined)
      : null;
    const secondary = secondaryRecord ? buildSubject(secondaryRecord) : null;
    const market = samples.length ? buildMarketContext(samples, DEFAULT_MARKET_CONTEXT_INPUT) : null;
    return { primary, secondary, market, repositorySize: records.length };
  }, [primaryRecord, secondaryRecord, samples, records.length, focus]);

  const ask = (question: string) => {
    const q = question.trim();
    if (!q) return;
    const answer = answerQuestion(q, ctx);
    setTurns((prev) => [...prev, { question: q, answer }]);
    setDraft('');
    // Scroll to the newest turn after render.
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    });
  };

  const generatedAt = () => new Date().toISOString();
  const exportMd = () => downloadExport({ filename: 'AI_Assistant_Transcript.md', content: transcriptMarkdown(turns, generatedAt()), mime: 'text/markdown' });
  const exportTxt = () => downloadExport({ filename: 'AI_Assistant_Transcript.txt', content: transcriptText(turns, generatedAt()), mime: 'text/plain' });
  const exportPdf = () => printTranscriptPdf(turns, generatedAt());

  return (
    <div className="space-y-5">
      {/* Header + disclaimer */}
      <section className="card flex flex-wrap items-start gap-3 border-accent/30 bg-accent/5 p-4">
        <ChatIcon className="mt-0.5 text-base text-accent" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-ink">AI Research Assistant</p>
            <span className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
              Explanation Layer
            </span>
          </div>
          <p className="mt-1 text-sm leading-relaxed text-ink-muted">
            I explain, compare and summarise <span className="text-ink">existing</span> research and define metrics. I read only
            what the frozen engines have already computed — I never calculate research, predict markets, or give Buy/Sell advice.
          </p>
        </div>
      </section>

      {/* Subject selectors */}
      <section className="card p-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <span className="stat-label mb-1.5 block">Subject Strategy (A)</span>
            {records.length === 0 ? (
              <p className="text-xs text-ink-faint">No stored strategies yet.</p>
            ) : (
              <select
                value={primaryRecord?.key ?? ''}
                onChange={(e) => setPrimaryKey(e.target.value)}
                className="w-full rounded-md border border-panel-border bg-panel px-3 py-1.5 text-sm text-ink focus:border-accent focus:outline-none"
              >
                {records.map((r) => (
                  <option key={r.key} value={r.key}>
                    Entry {r.entryGap} → Rec {r.recoveryGap} · SL {r.stopLoss} · {r.totalPositions} events
                  </option>
                ))}
              </select>
            )}
          </div>
          <div>
            <span className="stat-label mb-1.5 block">Compare With (B) — optional</span>
            <select
              value={secondaryRecord?.key ?? ''}
              onChange={(e) => setSecondaryKey(e.target.value || null)}
              disabled={records.length === 0}
              className="w-full rounded-md border border-panel-border bg-panel px-3 py-1.5 text-sm text-ink focus:border-accent focus:outline-none disabled:opacity-40"
            >
              <option value="">— none —</option>
              {records.filter((r) => r.key !== primaryRecord?.key).map((r) => (
                <option key={r.key} value={r.key}>
                  Entry {r.entryGap} → Rec {r.recoveryGap} · SL {r.stopLoss} · {r.totalPositions} events
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="mt-3 text-[11px] text-ink-faint">
          {ctx.market?.current ? 'Market Context is available (dataset loaded).' : 'Market Context is unavailable — load a dataset to ask about the current market.'}
        </p>
      </section>

      {/* Quick questions */}
      <section>
        <span className="stat-label mb-2 block">Ask about your research</span>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_QUESTIONS.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => ask(q)}
              className="rounded-md border border-panel-border bg-panel px-2.5 py-1 text-xs text-ink-muted transition-colors hover:border-accent hover:text-accent"
            >
              {q}
            </button>
          ))}
        </div>
      </section>

      {/* Conversation */}
      {records.length === 0 && turns.length === 0 ? (
        <EmptyState
          title="No research to explain yet"
          description="The Research Repository is empty. Run the Historical Strategy Finder to research and store strategies — then the assistant can explain, compare and summarise them. You can still ask for definitions and navigation."
        />
      ) : (
        <section className="card flex flex-col overflow-hidden p-0">
          <header className="flex items-center gap-2 border-b border-panel-border px-4 py-2.5">
            <ChatIcon className="text-base text-accent" />
            <h3 className="text-sm font-semibold text-ink">Conversation</h3>
            <span className="text-[11px] text-ink-faint">{turns.length} {turns.length === 1 ? 'answer' : 'answers'}</span>
            <div className="ml-auto flex items-center gap-2">
              <button type="button" onClick={exportMd} disabled={!turns.length} className="rounded-md border border-panel-border bg-panel px-2 py-1 text-[11px] text-ink-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-40">MD</button>
              <button type="button" onClick={exportTxt} disabled={!turns.length} className="rounded-md border border-panel-border bg-panel px-2 py-1 text-[11px] text-ink-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-40">Text</button>
              <button type="button" onClick={exportPdf} disabled={!turns.length} className="flex items-center gap-1 rounded-md border border-panel-border bg-panel px-2 py-1 text-[11px] text-ink-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-40"><DownloadIcon className="text-xs" /> PDF</button>
              <button type="button" onClick={() => setTurns([])} disabled={!turns.length} className="flex items-center gap-1 rounded-md border border-panel-border bg-panel px-2 py-1 text-[11px] text-ink-faint transition-colors hover:border-negative hover:text-negative disabled:opacity-40"><TrashIcon className="text-xs" /> Clear</button>
            </div>
          </header>

          <div ref={scrollRef} className="max-h-[58vh] space-y-4 overflow-y-auto px-4 py-4">
            {turns.length === 0 ? (
              <p className="py-6 text-center text-xs text-ink-faint">Ask a question above to begin. The conversation is not stored anywhere.</p>
            ) : (
              turns.map((t, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex justify-end">
                    <div className="max-w-[85%] rounded-lg rounded-br-sm border border-accent/30 bg-accent/10 px-3 py-1.5 text-sm text-ink">{t.question}</div>
                  </div>
                  <div className="flex justify-start">
                    <div className="max-w-[92%] rounded-lg rounded-bl-sm border border-panel-border bg-panel-raised px-3.5 py-3">
                      <div className="mb-2 flex items-center gap-2">
                        <span className={['rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide', MODE_TONE[t.answer.mode] ?? MODE_TONE.help].join(' ')}>{t.answer.mode}</span>
                        <span className="text-sm font-semibold text-ink">{t.answer.title}</span>
                      </div>

                      {t.answer.facts.length > 0 && (
                        <div className="mb-2">
                          <div className="stat-label mb-1">Facts — from existing research</div>
                          <ul className="space-y-1">
                            {t.answer.facts.map((f, j) => (
                              <li key={j} className="flex gap-2 text-sm leading-relaxed text-ink-muted">
                                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent/70" />
                                <span>{f}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {t.answer.observations.length > 0 && (
                        <div className="mb-2">
                          <div className="stat-label mb-1">Observations</div>
                          <ul className="space-y-1">
                            {t.answer.observations.map((o, j) => (
                              <li key={j} className="flex gap-2 text-sm leading-relaxed text-ink-muted">
                                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-warning/60" />
                                <span>{o}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {(t.answer.researchWindow || t.answer.sampleSize != null || t.answer.sources.length > 0) && (
                        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 border-t border-panel-border pt-2 text-[10px] text-ink-faint">
                          {t.answer.researchWindow && <span>Research window: {t.answer.researchWindow}</span>}
                          {t.answer.sampleSize != null && <span>Sample: {t.answer.sampleSize} occurrences</span>}
                          {t.answer.sources.length > 0 && <span>Sources: {t.answer.sources.join(', ')}</span>}
                        </div>
                      )}

                      <p className="mt-2 text-[10px] italic leading-relaxed text-ink-faint">{t.answer.disclaimer}</p>

                      {t.answer.followups.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {t.answer.followups.map((fu) => (
                            <button key={fu} type="button" onClick={() => ask(fu)} className="rounded-md border border-panel-border bg-panel px-2 py-0.5 text-[11px] text-ink-muted transition-colors hover:border-accent hover:text-accent">
                              {fu}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Composer */}
          <div className="flex items-center gap-2 border-t border-panel-border px-3 py-2.5">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') ask(draft); }}
              placeholder="Ask to explain, compare, summarise or define — e.g. “Why is reliability lower?”"
              className="min-w-0 flex-1 rounded-md border border-panel-border bg-panel px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
            />
            <button
              type="button"
              onClick={() => ask(draft)}
              disabled={!draft.trim()}
              className="rounded-md border border-accent/50 bg-accent/15 px-4 py-2 text-sm font-semibold text-accent transition-colors hover:bg-accent/25 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Ask
            </button>
          </div>
        </section>
      )}

      <p className="text-[11px] text-ink-faint">
        The assistant is interpretive, not authoritative — the deterministic research engines remain the source of truth. It keeps
        no memory: nothing here is stored, and every answer is rebuilt from the current repository.
      </p>
    </div>
  );
}
