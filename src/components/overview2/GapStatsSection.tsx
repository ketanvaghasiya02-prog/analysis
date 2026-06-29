/**
 * Section 2 — Gap Statistics (Overview 2.0). Pure descriptive stats.
 */

import { StatCard } from '@/components/overview/StatCard';
import { fmtNumber } from '@/utils/format';
import type { GapStats } from '@/utils/overviewStats';

export function GapStatsSection({ stats }: { stats: GapStats }) {
  const n = (v: number | null, d = 3) => fmtNumber(v, d);
  return (
    <section>
      <h2 className="stat-label mb-2">Gap Statistics</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Current Gap" value={n(stats.current)} tone="accent" tooltip="Most recent gap in the filtered data." />
        <StatCard label="Average Gap" value={n(stats.avg)} />
        <StatCard label="Median Gap" value={n(stats.median)} />
        <StatCard label="Mode Gap" value={n(stats.mode, 2)} tooltip="Most frequent gap value (rounded to 2 decimals)." />
        <StatCard label="Minimum Gap" value={n(stats.min)} tone="negative" />
        <StatCard label="Maximum Gap" value={n(stats.max)} tone="positive" />
        <StatCard label="Gap Range" value={n(stats.range)} tooltip="Maximum − Minimum." />
        <StatCard label="Standard Deviation" value={n(stats.stdDev)} />
        <StatCard label="Variance" value={n(stats.variance)} />
        <StatCard label="95 Percentile Gap" value={n(stats.p95)} tone="accent" />
        <StatCard label="99 Percentile Gap" value={n(stats.p99)} tone="warning" />
        <StatCard label="Average Daily Gap" value={n(stats.avgDailyGap)} tooltip="Mean of each day's average gap." />
        <StatCard label="Average Hourly Gap" value={n(stats.avgHourlyGap)} tooltip="Mean of each hour-of-day's average gap." />
      </div>
    </section>
  );
}
