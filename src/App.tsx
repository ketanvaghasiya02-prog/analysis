import { DataProvider } from '@/context/DataContext';
import { RepositoryProvider } from '@/context/RepositoryContext';
import { StrategyFocusProvider } from '@/context/StrategyFocusContext';
import { ComparisonProvider } from '@/context/ComparisonContext';
import { Dashboard } from '@/pages/Dashboard';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';

export default function App() {
  return (
    <ErrorBoundary>
      <DataProvider>
        <RepositoryProvider>
          <StrategyFocusProvider>
            <ComparisonProvider>
              <Dashboard />
            </ComparisonProvider>
          </StrategyFocusProvider>
        </RepositoryProvider>
      </DataProvider>
    </ErrorBoundary>
  );
}
