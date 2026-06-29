/**
 * Overview dashboard composition (Phase R1).
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

export function Dashboard() {
  const { hasData, selection } = useData();

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
          <OverviewCards />
          <GapTrendChart />
          {selection.mode === 'day-wise' && <DayWiseTable />}
          <ValidationPanel />
          <SampleTable />
        </div>
      )}
    </AppLayout>
  );
}
