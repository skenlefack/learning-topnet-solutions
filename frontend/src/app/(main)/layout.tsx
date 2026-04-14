import { Suspense } from 'react';
import ThemeProvider from '@/app/_components/ThemeProvider';
import DashboardShell from '@/app/_components/DashboardShell';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <Suspense
        fallback={
          <div className="min-h-screen bg-[var(--bg-primary)] animate-pulse">
            <div className="h-14 bg-white dark:bg-surface-dark-card border-b border-[var(--border)]" />
            <div className="flex">
              <div className="hidden lg:block w-56 h-screen bg-white dark:bg-surface-dark-card border-r border-[var(--border)]" />
              <div className="flex-1 p-6 space-y-6">
                <div className="h-44 rounded-2xl bg-brand-navy/10" />
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-28 rounded-xl bg-gray-100 dark:bg-gray-800" />
                  ))}
                </div>
              </div>
            </div>
          </div>
        }
      >
        <DashboardShell>{children}</DashboardShell>
      </Suspense>
    </ThemeProvider>
  );
}
