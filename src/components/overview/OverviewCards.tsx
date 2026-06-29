/**
 * Overview metric grid: files, samples, date range, gap stats, sync quality.
 */

import { useMemo } from 'react';
import { useData } from '@/context/DataContext';
import { StatCard } from '@/components/overview/StatCard';
import { gapSummary, syncQualityPct } from '@/utils/statistics';
import { fmtInt, fmtNumber, fmtPercent } from '@/utils/format';
import { formatDayLabel } from '@/utils/date';
import {
  CalendarIcon,
  CheckIcon,
  FileIcon,
  LayersIcon,
} from '@/components/common/icons';

export function OverviewCards() {
  const { dataset, filteredSamples, validation } = useData();

  const stats = useMemo(() => {
    const gaps = gapSummary(filteredSamples);
    const sync = syncQualityPct(filteredSamples);
    return { gaps, sync };
  }, [filteredSamples]);

  if (!dataset || !validation) return null;

  const { dateRange } = validation;
  const rangeLabel =
    dateRange.start && dateRange.end
      ? dateRange.start === dateRange.end
        ? formatDayLabel(dateRange.start)
        : `${formatDayLabel(dateRange.start)} → ${formatDayLabel(dateRange.end)}`
      : '—';

  const syncTone =
    stats.sync === null
      ? 'default'
      : stats.sync >= 95
        ? 'positive'
        : stats.sync >= 80
          ? 'warning'
          : 'negative';

  return (
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="Total Files"
        value={fmtInt(validation.filesUploaded)}
        hint={`${dataset.dayKeys.length} day buckets`}
        icon={<FileIcon className="text-base" />}
      />
      <StatCard
        label="Total Samples"
        value={fmtInt(filteredSamples.length)}
        hint={`${fmtInt(validation.validRows)} valid in dataset`}
        icon={<LayersIcon className="text-base" />}
      />
      <StatCard
        label="Date Range"
        value={<span className="text-base leading-snug">{rangeLabel}</span>}
        hint={`${dataset.dayKeys.length} trading day(s)`}
        icon={<CalendarIcon className="text-base" />}
      />
      <StatCard
        label="Sync Quality"
        value={fmtPercent(stats.sync)}
        hint="Share of in-sync samples"
        tone={syncTone}
        icon={<CheckIcon className="text-base" />}
      />
      <StatCard
        label="Average Gap"
        value={fmtNumber(stats.gaps.mean, 4)}
        hint={`σ ${fmtNumber(stats.gaps.stdDev, 4)}`}
        tone="accent"
      />
      <StatCard
        label="Max Gap"
        value={fmtNumber(stats.gaps.max, 4)}
        hint="Largest observed gap"
        tone="positive"
      />
      <StatCard
        label="Min Gap"
        value={fmtNumber(stats.gaps.min, 4)}
        hint="Smallest observed gap"
        tone="negative"
      />
      <StatCard
        label="Median Gap"
        value={fmtNumber(stats.gaps.median, 4)}
        hint={`${fmtInt(stats.gaps.count)} numeric samples`}
      />
    </section>
  );
}
