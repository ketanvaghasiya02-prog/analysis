import { DataProvider } from '@/context/DataContext';
import { Dashboard } from '@/pages/Dashboard';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';

export default function App() {
  return (
    <ErrorBoundary>
      <DataProvider>
        <Dashboard />
      </DataProvider>
    </ErrorBoundary>
  );
}
