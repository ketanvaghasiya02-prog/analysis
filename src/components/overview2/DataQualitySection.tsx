/**
 * Section 7 — Data Quality (Overview 2.0).
 */

import { StatCard } from '@/components/overview/StatCard';
import { fmtInt, fmtNumber, fmtPercent } from '@/utils/format';
import type { DataQuality, QualityBand } from '@/utils/overviewStats';

const BAND: Record<QualityBand, { dot: string; text: string; label: string }> = {
  green: { dot: 'bg-positive', text: 'text-positive', label: 'Good' },
  yellow: { dot: 'bg-warning', text: 'text-warning', label: 'Fair' },
  red: { dot: 'bg-negative', text: 'text-negative', label: 'Poor' },
};

export function DataQualitySection({ quality }: { quality: DataQuality }) {
  const b = BAND[quality.band];
  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <h2 className="stat-label">Data Quality</h2>
        <span className={['flex items-center gap-1.5 text-xs', b.text].join(' ')}>
          <span className={['h-2.5 w-2.5 rounded-full', b.dot].join(' ')} />
          {b.label} · {fmtNumber(quality.confidenceScore, 0)}/100
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Valid Samples" value={fmtInt(quality.validSamples)} tone="positive" />
        <StatCard label="Invalid Samples" value={fmtInt(quality.invalidSamples)} tone={quality.invalidSamples > 0 ? 'warning' : 'default'} />
        <StatCard label="Duplicate Samples" value={fmtInt(quality.duplicateSamples)} tone={quality.duplicateSamples > 0 ? 'warning' : 'default'} />
        <StatCard label="Missing Samples" value={fmtInt(quality.missingSamples)} tone={quality.missingSamples > 0 ? 'warning' : 'default'} />
        <StatCard label="Sync Failures" value={fmtInt(quality.syncFailures)} tone={quality.syncFailures > 0 ? 'negative' : 'default'} />
        <StatCard label="Coverage %" value={fmtPercent(quality.coveragePct)} tooltip="Valid rows / (valid + ignored rows)." />
      </div>
    </section>
  );
}
