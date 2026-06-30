import { useEffect, type ReactNode } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { PageHeader } from '@/components/layout/PageHeader';
import { useData } from '@/context/DataContext';

/** Three-zone institutional shell: sidebar · header · scrollable main. */
export function AppLayout({ children }: { children: ReactNode }) {
  const { setView } = useData();

  // Global shortcut: ⌘K / Ctrl-K (anywhere) and "/" (outside text fields) open
  // Universal Search — the official navigation layer.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        !!target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setView('search');
      } else if (e.key === '/' && !typing) {
        e.preventDefault();
        setView('search');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setView]);

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
