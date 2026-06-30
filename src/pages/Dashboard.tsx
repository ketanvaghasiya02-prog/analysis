/**
 * Top-level page shell. Renders the empty state until data is loaded, a loading
 * skeleton during the first parse, then switches the main content between the
 * analysis views based on the active view in the data store. Global filters and
 * the analysis-mode selection are shared across all views.
 */

import { useData } from '@/context/DataContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { EmptyState } from '@/components/common/EmptyState';
import { DashboardSkeleton } from '@/components/common/Skeleton';
import { FileUpload } from '@/components/upload/FileUpload';
import { OverviewView } from '@/pages/OverviewView';
import { EventsView } from '@/components/events/EventsView';
import { RecoveryView } from '@/components/recovery/RecoveryView';
import { MaeView } from '@/components/mae/MaeView';
import { StopLossView } from '@/components/stoploss/StopLossView';
import { FailedEventsView } from '@/components/failed/FailedEventsView';
import { ExplorerView } from '@/components/explorer/ExplorerView';
import { SessionView } from '@/components/session/SessionView';
import { SettingsView } from '@/components/settings/SettingsView';
import { ResearchLabView } from '@/components/lab/ResearchLabView';
import { SlOptimizerView } from '@/components/sloptimizer/SlOptimizerView';
import { StrategyFinderView } from '@/components/strategyfinder/StrategyFinderView';
import { RepositoryView } from '@/components/repository/RepositoryView';
import { StrategyRankingView } from '@/components/ranking/StrategyRankingView';
import { StrategyDetailsView } from '@/components/details/StrategyDetailsView';
import { ReplayView } from '@/components/replay/ReplayView';
import { ComparisonView } from '@/components/comparison/ComparisonView';
import { ModulePlaceholder } from '@/components/common/ModulePlaceholder';
import { isPlaceholderView } from '@/components/layout/moduleMeta';
import { ProbabilityView } from '@/components/probability/ProbabilityView';

export function Dashboard() {
  const { hasData, isParsing, view } = useData();

  // Settings is reachable without a dataset loaded.
  if (view === 'settings') {
    return (
      <AppLayout>
        <SettingsView />
      </AppLayout>
    );
  }

  // The Research Repository persists results independently of the dataset, so
  // it stays reachable even when no dataset is currently loaded.
  if (view === 'repository') {
    return (
      <AppLayout>
        <RepositoryView />
      </AppLayout>
    );
  }

  // Strategy Ranking reads the repository, so it is reachable without a dataset.
  if (view === 'ranking') {
    return (
      <AppLayout>
        <StrategyRankingView />
      </AppLayout>
    );
  }

  // The Strategy Dossier reads stored results, so it is also dataset-independent.
  if (view === 'strategy-details') {
    return (
      <AppLayout>
        <StrategyDetailsView />
      </AppLayout>
    );
  }

  // Replay reconstructs the path from stored data + the loaded dataset samples.
  if (view === 'replay') {
    return (
      <AppLayout>
        <ReplayView />
      </AppLayout>
    );
  }

  // Strategy Comparison reads stored results, so it is dataset-independent.
  if (view === 'comparison') {
    return (
      <AppLayout>
        <ComparisonView />
      </AppLayout>
    );
  }

  // Probability Engine handles its own no-data empty state.
  if (view === 'probability-engine') {
    return (
      <AppLayout>
        <ProbabilityView />
      </AppLayout>
    );
  }

  // Future modules — professional "coming soon" placeholders (no dataset needed).
  if (isPlaceholderView(view)) {
    return (
      <AppLayout>
        <ModulePlaceholder />
      </AppLayout>
    );
  }

  let content;
  if (!hasData && isParsing) {
    content = <DashboardSkeleton />;
  } else if (!hasData) {
    content = (
      <EmptyState
        title="No dataset loaded"
        description="Upload one or more GapMonitor CSV exports to build a combined, day-aware research dataset. Files are parsed entirely in your browser — nothing is uploaded to a server."
        action={
          <div className="w-full max-w-md">
            <FileUpload variant="hero" />
          </div>
        }
      />
    );
  } else if (view === 'events') {
    content = <EventsView />;
  } else if (view === 'recovery') {
    content = <RecoveryView />;
  } else if (view === 'mae') {
    content = <MaeView />;
  } else if (view === 'stoploss') {
    content = <StopLossView />;
  } else if (view === 'failed') {
    content = <FailedEventsView />;
  } else if (view === 'explorer') {
    content = <ExplorerView />;
  } else if (view === 'session') {
    content = <SessionView />;
  } else if (view === 'lab') {
    content = <ResearchLabView />;
  } else if (view === 'sl-optimizer') {
    content = <SlOptimizerView />;
  } else if (view === 'strategy-finder') {
    content = <StrategyFinderView />;
  } else {
    content = <OverviewView />;
  }

  return <AppLayout>{content}</AppLayout>;
}
