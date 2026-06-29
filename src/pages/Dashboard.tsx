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
import { RecoveryView } from '@/components/recovery/RecoveryView';
import { MaeView } from '@/components/mae/MaeView';
import { StopLossView } from '@/components/stoploss/StopLossView';
import { FailedEventsView } from '@/components/failed/FailedEventsView';
import { ExplorerView } from '@/components/explorer/ExplorerView';
import { SessionView } from '@/components/session/SessionView';

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
      ) : view === 'recovery' ? (
        <RecoveryView />
      ) : view === 'mae' ? (
        <MaeView />
      ) : view === 'stoploss' ? (
        <StopLossView />
      ) : view === 'failed' ? (
        <FailedEventsView />
      ) : view === 'explorer' ? (
        <ExplorerView />
      ) : view === 'session' ? (
        <SessionView />
      ) : (
        <OverviewView />
      )}
    </AppLayout>
  );
}
