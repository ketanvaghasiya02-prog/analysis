/**
 * Quality Assurance — view (read-only).
 *
 * Runs the permanent QA framework against the frozen engines and renders the
 * results: a release certificate, per-suite check results, the module test
 * matrix, the bug classification and quality levels. Exportable as the official
 * Quality Certificate. It modifies nothing — it only verifies.
 */

import { useMemo, useState } from 'react';
import {
  runQa,
  qaReportJson,
  qaReportMarkdownExport,
  MODULE_TEST_MATRIX,
  BUG_CLASSES,
  type QaReport,
  type QaSeverity,
} from '@/utils/qa';
import { downloadExport } from '@/utils/reports';
import { CheckIcon, DownloadIcon, ShieldIcon, WarningIcon } from '@/components/common/icons';

const QUALITY_LEVELS = [
  'Unit Testing', 'Integration Testing', 'Regression Testing', 'Manual CSV Validation',
  'Performance Testing', 'Stress Testing', 'Release Testing',
];

const SEVERITY_TONE: Record<QaSeverity, string> = {
  critical: 'text-negative',
  high: 'text-warning',
  medium: 'text-accent',
  low: 'text-ink-muted',
  cosmetic: 'text-ink-faint',
};

export function QaView() {
  // A nonce lets the user re-run; the report is memoized against it.
  const [nonce, setNonce] = useState(0);
  const report: QaReport = useMemo(() => runQa(new Date().toISOString()), [nonce]);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const exportJson = () => downloadExport(qaReportJson(report));
  const exportMd = () => downloadExport(qaReportMarkdownExport(report));

  return (
    <div className="space-y-5">
      {/* Header */}
      <section className="card flex flex-wrap items-start gap-3 border-accent/30 bg-accent/5 p-4">
        <ShieldIcon className="mt-0.5 text-base text-accent" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-ink">Quality Assurance</p>
            <span className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
              Permanent Framework
            </span>
          </div>
          <p className="mt-1 text-sm leading-relaxed text-ink-muted">
            Trust before features. Every statistic GRT shows must be reproducible from uploaded CSV, every calculation
            deterministic. This framework verifies the frozen engines against built-in golden datasets — it never modifies them.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button type="button" onClick={() => setNonce((n) => n + 1)} className="rounded-md border border-accent/50 bg-accent/15 px-3 py-1.5 text-xs font-semibold text-accent transition-colors hover:bg-accent/25">Re-run</button>
          <button type="button" onClick={exportMd} className="flex items-center gap-1.5 rounded-md border border-panel-border bg-panel px-3 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:border-accent hover:text-accent"><DownloadIcon className="text-sm" /> MD</button>
          <button type="button" onClick={exportJson} className="flex items-center gap-1.5 rounded-md border border-panel-border bg-panel px-3 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:border-accent hover:text-accent"><DownloadIcon className="text-sm" /> JSON</button>
        </div>
      </section>

      {/* Release certificate */}
      <section className={['card border p-5', report.releasePassed ? 'border-positive/40 bg-positive/10' : 'border-negative/40 bg-negative/10'].join(' ')}>
        <div className="flex flex-wrap items-center gap-3">
          {report.releasePassed ? <CheckIcon className="text-2xl text-positive" /> : <WarningIcon className="text-2xl text-negative" />}
          <div>
            <div className={['text-lg font-semibold', report.releasePassed ? 'text-positive' : 'text-negative'].join(' ')}>
              {report.releasePassed ? 'Release Approved' : 'Release Blocked'}
            </div>
            <div className="text-[11px] text-ink-faint">Release Certificate · generated {report.generatedAt.replace('T', ' ').slice(0, 19)} · {report.durationMs.toFixed(0)} ms</div>
          </div>
          <div className="ml-auto grid grid-cols-3 gap-3 text-center">
            <div><div className="font-mono text-xl font-semibold text-ink">{report.passRate.toFixed(0)}%</div><div className="stat-label">Pass Rate</div></div>
            <div><div className="font-mono text-xl font-semibold text-negative">{report.criticalFailures}</div><div className="stat-label">Critical</div></div>
            <div><div className="font-mono text-xl font-semibold text-warning">{report.highFailures}</div><div className="stat-label">High</div></div>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-ink-muted sm:grid-cols-4">
          <div>Checks: <span className="font-mono text-ink">{report.passed}/{report.total}</span></div>
          <div>CSV reproducibility: <span className="text-positive">{report.suites.find((s) => s.id === 'csv')?.checks.every((c) => c.passed) ? 'pass' : 'fail'}</span></div>
          <div>Deterministic: <span className="text-positive">{report.suites.find((s) => s.id === 'determinism')?.checks.every((c) => c.passed) ? 'pass' : 'fail'}</span></div>
          <div>No critical bugs: <span className={report.criticalFailures === 0 ? 'text-positive' : 'text-negative'}>{report.criticalFailures === 0 ? 'yes' : 'no'}</span></div>
        </div>
      </section>

      {/* Quality levels */}
      <section className="card p-5">
        <h2 className="stat-label mb-2">Quality Levels</h2>
        <div className="flex flex-wrap gap-1.5">
          {QUALITY_LEVELS.map((l) => (
            <span key={l} className="rounded-md border border-panel-border bg-panel px-2.5 py-1 text-xs text-ink-muted">{l}</span>
          ))}
        </div>
      </section>

      {/* Suites */}
      <section className="space-y-3">
        {report.suites.map((suite) => {
          const passed = suite.checks.filter((c) => c.passed).length;
          const allPass = passed === suite.checks.length;
          const isOpen = open[suite.id] ?? !allPass; // failing suites expanded by default
          return (
            <div key={suite.id} className="card overflow-hidden p-0">
              <button type="button" onClick={() => setOpen((p) => ({ ...p, [suite.id]: !isOpen }))} className="flex w-full items-center gap-2 px-4 py-3 text-left">
                {allPass ? <CheckIcon className="text-base text-positive" /> : <WarningIcon className="text-base text-negative" />}
                <span className="text-sm font-semibold text-ink">{suite.title}</span>
                <span className="rounded border border-panel-border px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-ink-faint">{suite.level}</span>
                <span className={['ml-auto font-mono text-xs', allPass ? 'text-positive' : 'text-negative'].join(' ')}>{passed}/{suite.checks.length}</span>
              </button>
              {isOpen && (
                <div className="divide-y divide-panel-border border-t border-panel-border">
                  {suite.checks.map((c) => (
                    <div key={c.id} className="flex items-start gap-2 px-4 py-2.5">
                      {c.passed ? <CheckIcon className="mt-0.5 text-sm text-positive" /> : <WarningIcon className="mt-0.5 text-sm text-negative" />}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-ink">{c.name}</span>
                          <span className={['text-[10px] font-semibold uppercase', SEVERITY_TONE[c.severity]].join(' ')}>{c.severity}</span>
                        </div>
                        <div className="font-mono text-[11px] text-ink-faint">{c.detail}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </section>

      {/* Module test matrix */}
      <section className="card p-5">
        <h2 className="stat-label mb-3">Module Test Matrix</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-panel-border text-ink-faint">
                <th className="py-1.5 pr-3 font-medium">Module</th>
                <th className="py-1.5 pr-3 font-medium">Coverage</th>
                <th className="py-1.5 pr-3 font-medium">Suites</th>
                <th className="py-1.5 pr-3 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody className="text-ink-muted">
              {MODULE_TEST_MATRIX.map((m) => (
                <tr key={m.module} className="border-b border-panel-border/60">
                  <td className="py-1.5 pr-3 font-medium text-ink">{m.module}</td>
                  <td className="py-1.5 pr-3">
                    <span className={['rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase', m.coverage === 'automated' ? 'bg-positive/15 text-positive' : m.coverage === 'visual' ? 'bg-accent/15 text-accent' : 'bg-warning/15 text-warning'].join(' ')}>{m.coverage}</span>
                  </td>
                  <td className="py-1.5 pr-3 font-mono text-[11px]">{m.suites.join(', ') || '—'}</td>
                  <td className="py-1.5 pr-3 text-[11px]">{m.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Bug classification */}
      <section className="card p-5">
        <h2 className="stat-label mb-3">Bug Classification</h2>
        <div className="space-y-2">
          {BUG_CLASSES.map((b) => (
            <div key={b.level} className="flex items-start gap-2 text-sm">
              <span className={['mt-0.5 text-[10px] font-semibold uppercase', SEVERITY_TONE[b.level]].join(' ')}>{b.label}</span>
              {b.blocksRelease && <span className="rounded bg-negative/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-negative">blocks release</span>}
              <span className="flex-1 text-ink-muted">{b.description}</span>
            </div>
          ))}
        </div>
      </section>

      <p className="text-[11px] text-ink-faint">
        Release gate: no release is allowed unless all unit and integration tests pass, CSV validation passes, performance targets
        pass, regression passes and no critical bugs remain. Every future feature must add unit, integration, CSV and regression
        coverage before merging.
      </p>
    </div>
  );
}
