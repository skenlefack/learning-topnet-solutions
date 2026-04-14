// ============================================================================
// AU-IBAR Learning — Dashboard Page
// Server component that renders the main dashboard
// ============================================================================
import { Suspense } from 'react';
import DashboardShell from './_components/DashboardShell';

export default function HomePage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardShell />
    </Suspense>
  );
}

function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-surface-DEFAULT dark:bg-surface-dark animate-pulse">
      <div className="h-14 bg-white dark:bg-surface-dark-card border-b border-gray-200 dark:border-gray-800" />
      <div className="flex">
        <div className="w-56 h-screen bg-white dark:bg-surface-dark-card border-r border-gray-200 dark:border-gray-800" />
        <div className="flex-1 p-6 space-y-6">
          <div className="h-44 rounded-2xl bg-brand-navy/10" />
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-28 rounded-xl bg-gray-100 dark:bg-gray-800" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
