/**
 * Section 1 — Dataset Information (Overview 2.0). Read-only stats + Research
 * Engine position count (consumed from computeScenario).
 */

import { StatCard } from '@/components/overview/StatCard';
import { fmtInt } from '@/utils/format';
import { formatDayLabel } from '@/utils/date';
import { RESEARCH_ENGINE_VERSION } from '@/utils/scenario';
import type { DatasetInfo } from '@/utils/overviewStats';

export function DatasetInfoSection({
  info,
  researchPositions,
}: {
  info: DatasetInfo;
  researchPositions: number;
}) {
  const rangeLabel =
    info.dateRange.start && info.dateRange.end
      ? info.dateRange.start === info.dateRange.end
        ? formatDayLabel(info.dateRange.start)
        : `${formatDayLabel(info.dateRange.start)} → ${formatDayLabel(info.dateRange.end)}`
      : '—';

  return (
    <section>
      <h2 className="stat-label mb-2">Dataset Information</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <StatCard label="CSV Files Loaded" value={fmtInt(info.filesLoaded)} />
        <StatCard label="Trading Days" value={fmtInt(info.tradingDays)} />
        <StatCard
          label="Date Range"
          value={<span className="text-base leading-snug">{rangeLabel}</span>}
        />
        <StatCard label="Total Samples" value={fmtInt(info.totalSamples)} />
        <StatCard
          label="Research Positions"
          value={fmtInt(researchPositions)}
          tone="accent"
          tooltip="Simulated positions from the Research Engine using a reference scenario derived from this dataset (entry P75, recovery P25, stop-loss P95). Consumed, not recalculated here."
        />
        <StatCard
          label="Rows Ignored"
          value={fmtInt(info.rowsIgnored)}
          tone={info.rowsIgnored > 0 ? 'warning' : 'default'}
        />
        <StatCard
          label="Duplicate Rows"
          value={fmtInt(info.duplicateRows)}
          tone={info.duplicateRows > 0 ? 'warning' : 'default'}
        />
        <StatCard
          label="Missing Samples"
          value={fmtInt(info.missingSamples)}
          tone={info.missingSamples > 0 ? 'warning' : 'default'}
          tooltip="Valid rows whose Gap value could not be parsed."
        />
        <StatCard
          label="Research Engine"
          value={<span className="text-sm leading-snug text-positive">{RESEARCH_ENGINE_VERSION}</span>}
        />
      </div>
    </section>
  );
}
