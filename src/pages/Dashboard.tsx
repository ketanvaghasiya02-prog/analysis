/**
 * Overview dashboard composition (Phase R1 + R2).
 *
 * Layout order:
 *   Analysis mode → Global filters → Overview cards → Gap trend
 *   → Gap distribution (histogram + zone summary)
 *   → [Day-wise modules when in Day Wise mode] → Validation → Sample inspector
 *
 * Day-wise modules (analysis table, comparison charts, comparison table) show
 * in "Day Wise Analysis" mode. Single Day / Custom Range narrow the whole
 * dashboard via the shared `filteredSamples` selection.
 */

import { useData } from '@/context/DataContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { EmptyState } from '@/components/common/EmptyState';
import { FileUpload } from '@/components/upload/FileUpload';
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

export function Dashboard() {
  const { hasData, selection } = useData();
  const showDayModules = selection.mode === 'day-wise';

  return (
    <AppLayout>
      {!hasData ? (
        <EmptyState
          title="No dataset loaded"
          description="Upload one or more GapMonitor CSV exports to build a combined, day-aware research dataset. Files are parsed entirely in your browser — nothing is uploaded to a server."
          action={
            <div className="w-full max-w-md">
              <FileUpload variant="hero" />
            </div>
          }
        />
      ) : (
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
      )}
    </AppLayout>
  );
}
