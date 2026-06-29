import { DataProvider } from '@/context/DataContext';
import { Dashboard } from '@/pages/Dashboard';

export default function App() {
  return (
    <DataProvider>
      <Dashboard />
    </DataProvider>
  );
}
