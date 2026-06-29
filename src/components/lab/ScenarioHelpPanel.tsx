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
            This Research Lab simulates ONE position at a time. A position opens
            on the first touch of the Entry Gap from below; while it is open,
            every new Entry Gap touch is ignored. After entry, each future sample
            is scanned in chronological order and the FIRST of recovery or
            stop-loss decides the path. Research education only — not a trading
            signal, gap points only.
          </p>

          <H>Worked examples</H>
          <p className="mt-1">
            Scenario: Entry Gap = 14.00, Recovery Gap = 13.50, Stop Loss = 14.44.
          </p>
          <Code>{`Example 1  (SL hit, then recovered)
  13.98 → 14.02 (ENTRY) → 14.20 → 14.46 (SL HIT) → 14.10 → 13.50 (RECOVERY)
  SL happened first, recovery happened later
  →  RECOVERED_AFTER_SL
  Meaning: the gap eventually recovered, but the SL was too tight.

Example 2  (recovered cleanly)
  13.98 → 14.01 (ENTRY) → 13.80 → 13.50 (RECOVERY)
  recovery reached, SL never touched
  →  RECOVERED_BEFORE_SL`}</Code>

          <H>Formulas</H>
          <Code>{`Total Events            = all detected first-touch entry events
Recovery Before SL %    = Recovered Before SL / Total × 100
Recovery After SL %     = Recovered After SL / Total × 100
Recovery Ignoring SL %  = (Recovered Before SL + Recovered After SL) / Total × 100
SL Hit %                = (Recovered After SL + SL Not Recovered) / Total × 100
Unresolved %            = (Day End + Dataset End + Holding Expired) / Total × 100`}</Code>

          <H>Numeric example (Total Positions = 100)</H>
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
            <li>With SL at 14.44, practical success was only 62%.</li>
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
