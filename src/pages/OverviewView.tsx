/**
 * Overview page composition (Phase R1–R3).
 *
 *   Analysis mode → Global filters → Overview cards → Gap trend
 *   → Gap distribution (histogram + zone summary)
 *   → [Day-wise modules when in Day Wise mode] → Validation → Sample inspector
 */

import { useData } from '@/context/DataContext';
import { OverviewCards } from '@/components/overview/OverviewCards';
import { ValidationPanel } from '@/components/validation/ValidationPanel';
import { AnalysisModeSelector } from '@/components/common/AnalysisModeSelector';
import { SampleTable } from '@/components/overview/SampleTable';
import { DayWiseTable } from '@/components/overview/DayWiseTable';
import { GapTrendChart } from '@/components/overview/GapTrendChart';
import { FilterBar } from '@/components/filters/FilterBar';
import { DayComparisonCharts } from '@/components/comparison/DayComparisonCharts';
import { DayComparisonTable } from '@/components/comparison/DayComparisonTable';
import { GapDistribution } from '@/components/distribution/GapDistribution';

export function OverviewView() {
  const { selection } = useData();
  const showDayModules = selection.mode === 'day-wise';

  return (
    <div className="space-y-5">
      <AnalysisModeSelector />
      <FilterBar />
      <OverviewCards />
      <GapTrendChart />
      <GapDistribution />

      {showDayModules && (
        <>
          <DayComparisonCharts />
          <DayWiseTable />
          <DayComparisonTable />
        </>
      )}

      <ValidationPanel />
      <SampleTable />
    </div>
  );
}
