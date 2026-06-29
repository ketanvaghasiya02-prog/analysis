import { DataProvider } from '@/context/DataContext';
import { RepositoryProvider } from '@/context/RepositoryContext';
import { StrategyFocusProvider } from '@/context/StrategyFocusContext';
import { Dashboard } from '@/pages/Dashboard';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';

export default function App() {
  return (
    <ErrorBoundary>
      <DataProvider>
        <RepositoryProvider>
          <StrategyFocusProvider>
            <Dashboard />
          </StrategyFocusProvider>
        </RepositoryProvider>
      </DataProvider>
    </ErrorBoundary>
  );
}
