/**
 * Top-level page shell. Renders the empty state until data is loaded, then
 * switches the main content between the Overview and Events views based on the
 * active view in the data store. Global filters and the analysis-mode selection
 * are shared across both views.
 */

import { useData } from '@/context/DataContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { EmptyState } from '@/components/common/EmptyState';
import { FileUpload } from '@/components/upload/FileUpload';
import { OverviewView } from '@/pages/OverviewView';
import { EventsView } from '@/components/events/EventsView';

export function Dashboard() {
  const { hasData, view } = useData();

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
      ) : view === 'events' ? (
        <EventsView />
      ) : (
        <OverviewView />
      )}
    </AppLayout>
  );
}
