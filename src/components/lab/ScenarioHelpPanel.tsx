/**
 * "How calculations work" explanation panel (additive).
 *
 * Collapsible help with worked examples, formulas and a numeric example.
 * Research education only — no signals.
 */

import { useState } from 'react';

function Code({ children }: { children: React.ReactNode }) {
  return (
    <pre className="mt-1 overflow-x-auto rounded-md border border-panel-border bg-panel p-3 font-mono text-xs leading-relaxed text-ink-muted">
      {children}
    </pre>
  );
}

function H({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-accent">
      {children}
    </h3>
  );
}

export function ScenarioHelpPanel() {
  const [open, setOpen] = useState(false);

  return (
    <section className="card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-5 py-3 text-left"
      >
        <span className="text-sm font-semibold uppercase tracking-wide text-ink">
          How calculations work
        </span>
        <span className="text-ink-faint">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="border-t border-panel-border px-5 py-4 text-sm text-ink-muted">
          <p className="text-xs text-ink-faint">
            This explains what each metric means. It is research education, not a
            trading signal. No buy/sell orders are generated.
          </p>

          <H>Worked examples</H>
          <p className="mt-1">
            Scenario: Entry Gap Zone = 18.00–18.50, Recovery Target To = 15.50,
            Stop Loss Gap = 19.00.
          </p>
          <Code>{`Event-1  entry 18.20
  path: 18.20 → 18.10 → 17.30 → 15.50
  recovery reached before SL  →  RECOVERED_BEFORE_SL

Event-2  entry 18.30
  path: 18.30 → 18.80 → 19.10 → 18.50 → 15.50
  SL hit first at 19.00, recovery later at 15.50  →  SL_HIT_THEN_RECOVERED

Event-3  entry 18.10
  path: 18.10 → 18.70 → 19.20 → 20.10 → 20.80
  SL hit, recovery never happened  →  SL_HIT_NOT_RECOVERED

Event-4  entry 18.40
  path: 18.40 → 18.10 → 17.60 → 16.30 (day ends before 15.50)
  →  DAY_END_NO_RESOLUTION`}</Code>

          <H>Formulas</H>
          <Code>{`Total Events            = all detected entry-zone events
Recovery Before SL %    = Recovered Before SL / Total × 100
Recovery After SL %     = SL Hit Then Recovered / Total × 100
Recovery Ignoring SL %  = (Recovered Before SL + SL Hit Then Recovered) / Total × 100
SL Hit %                = (SL Hit Then Recovered + SL Hit Not Recovered) / Total × 100
Unresolved %            = (Day End + Dataset End + Max Holding Expired) / Total × 100

Recovered Events Stopped By SL = SL Hit Then Recovered
  → events where the idea eventually worked, but the SL was too tight.`}</Code>

          <H>Numeric example (Total Events = 100)</H>
          <Code>{`Recovered Before SL    = 62
SL Hit Then Recovered  = 25
SL Hit Not Recovered   = 8
Day End No Resolution  = 3
Dataset End No Res.    = 2
Max Holding Expired    = 0

Recovery Before SL %    = 62 / 100 = 62%
Recovery After SL %     = 25 / 100 = 25%
Recovery Ignoring SL %  = (62 + 25) / 100 = 87%
SL Hit %                = (25 + 8) / 100 = 33%
Unresolved %            = (3 + 2 + 0) / 100 = 5%`}</Code>

          <H>Interpretation</H>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-xs">
            <li>Without SL, historical recovery was 87%.</li>
            <li>With SL at 19.00, practical success was only 62%.</li>
            <li>
              25% hit SL first but recovered later — the SL may be too tight.
            </li>
            <li>8% hit SL and never recovered — the SL helped cut bad cases.</li>
            <li>5% were unresolved within the selected scan limit.</li>
          </ul>
        </div>
      )}
    </section>
  );
}
