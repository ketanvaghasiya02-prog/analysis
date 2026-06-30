/**
 * About GRT — static product information (presentation only).
 *
 * No business logic and no calculations: this page describes the product, its
 * version and its governing principles. It reads nothing from the dataset.
 */

import { ChartIcon } from '@/components/common/icons';

const VERSION = '1.0.0';

const PRINCIPLES = [
  'The Research Engine is the single source of truth.',
  'No duplicate calculations.',
  'Every number is reproducible from the uploaded CSV.',
  'Historical evidence only — no predictions.',
  'Probability and Reliability are separate concerns.',
  'One research question per module.',
  'Recent windows are prioritised (default 15–30 days).',
  'All scoring is deterministic.',
  'No hidden weighting or AI scoring of research.',
  'CSV verification is mandatory.',
];

const FACTS: Array<{ label: string; value: string }> = [
  { label: 'Product', value: 'Gap Research Terminal' },
  { label: 'Short name', value: 'GRT' },
  { label: 'Version', value: VERSION },
  { label: 'Research methodology', value: 'Research Engine v1.0 (frozen)' },
  { label: 'Documentation', value: '16 governance documents' },
  { label: 'Release status', value: 'Production — v1.0' },
];

export function AboutView() {
  return (
    <div className="space-y-5">
      {/* Identity */}
      <section className="card flex flex-wrap items-start gap-4 p-5">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/15 text-accent">
          <ChartIcon className="text-2xl" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold text-ink">Gap Research Terminal</h1>
          <p className="text-sm text-ink-faint">Professional CSV-Based Pair Spread Research Platform</p>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted">
            GRT is a browser-based platform for historical statistical research on pair-spread
            (“gap”) behaviour from MT5 GapMonitor CSV exports. It is <span className="text-ink">not</span> a trading
            application — no broker connection, no orders, no signals, and no predictions or recommendations.
          </p>
        </div>
        <span className="rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">v{VERSION}</span>
      </section>

      {/* Facts */}
      <section className="card p-5">
        <h2 className="stat-label mb-3">Product</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {FACTS.map((f) => (
            <div key={f.label} className="rounded-md border border-panel-border bg-panel px-3 py-2">
              <div className="stat-label">{f.label}</div>
              <div className="text-sm font-semibold text-ink">{f.value}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Governing principles */}
      <section className="card p-5">
        <h2 className="stat-label mb-3">Governing Principles</h2>
        <ol className="space-y-2">
          {PRINCIPLES.map((p, i) => (
            <li key={i} className="flex items-start gap-2 text-sm leading-relaxed text-ink-muted">
              <span className="mt-0.5 font-mono text-[11px] text-accent">{String(i + 1).padStart(2, '0')}</span>
              <span>{p}</span>
            </li>
          ))}
        </ol>
      </section>

      <p className="text-[11px] text-ink-faint">
        Research stays authoritative, deterministic and CSV-verified. Research ends at the export stage; any trading
        system begins after export.
      </p>
    </div>
  );
}
