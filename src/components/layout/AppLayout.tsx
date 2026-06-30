import type { ReactNode } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { PageHeader } from '@/components/layout/PageHeader';

/** Three-zone institutional shell: sidebar · header · scrollable main. */
export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-panel">
      {/* Sidebar hidden on small screens, content remains accessible */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main className="flex-1 overflow-y-auto px-6 py-5">
          <PageHeader />
          {children}
        </main>
      </div>
    </div>
  );
}
