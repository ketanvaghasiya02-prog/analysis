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
          How Research Works
        </span>
        <span className="text-ink-faint">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="border-t border-panel-border px-5 py-4 text-sm text-ink-muted">
          <p className="text-xs text-ink-faint">
            Exact-touch model: an event starts on the first touch of the Entry
            Gap from below; after entry, every future sample is scanned in
            chronological order and the FIRST of recovery or stop-loss decides
            the path. Research education only — not a trading signal.
          </p>

          <H>Worked examples</H>
          <p className="mt-1">
            Scenario: Entry Gap = 18.00, Recovery Gap = 15.50, Stop Loss = 21.00.
          </p>
          <Code>{`Example 1  (SL hit, then recovered)
  entry on first touch of 18.00 (gap 18.02)
  path: 18.02 → 20.40 → 21.00 (SL HIT) → 17.20 → 15.50 (recovered)
  SL happened first, recovery happened later
  →  RECOVERED_AFTER_SL

Example 2  (recovered cleanly)
  entry on first touch of 18.00
  path: 18.00 → 17.60 → 16.20 → 15.50 (recovered)
  recovery reached, SL never touched
  →  RECOVERED_BEFORE_SL`}</Code>

          <H>Formulas</H>
          <Code>{`Total Events            = all detected first-touch entry events
Recovery Before SL %    = Recovered Before SL / Total × 100
Recovery After SL %     = Recovered After SL / Total × 100
Recovery Ignoring SL %  = (Recovered Before SL + Recovered After SL) / Total × 100
SL Hit %                = (Recovered After SL + SL Not Recovered) / Total × 100
Unresolved %            = (Day End + Dataset End + Holding Expired) / Total × 100`}</Code>

          <H>Numeric example (Total Events = 100)</H>
          <Code>{`Recovered Before SL    = 62
Recovered After SL     = 25
SL Not Recovered       = 8
Day End                = 3
Dataset End            = 2
Holding Time Expired   = 0

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
