export default function RootLoading() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] animate-pulse">
      {/* Header skeleton */}
      <div className="sticky top-0 z-30 h-14 flex items-center justify-between px-4 lg:px-6 bg-white dark:bg-surface-dark-card border-b border-[var(--border)]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gray-200 dark:bg-gray-700" />
          <div className="w-24 h-4 rounded bg-gray-200 dark:bg-gray-700" />
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gray-200 dark:bg-gray-700" />
          <div className="w-8 h-8 rounded-lg bg-gray-200 dark:bg-gray-700" />
          <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700" />
        </div>
      </div>

      <div className="flex">
        {/* Sidebar skeleton */}
        <aside className="hidden lg:flex flex-col w-56 h-[calc(100vh-3.5rem)] bg-white dark:bg-surface-dark-card border-r border-[var(--border)]">
          {/* Brand */}
          <div className="flex items-center gap-2.5 h-14 px-4 border-b border-[var(--border)]">
            <div className="w-8 h-8 rounded-lg bg-brand-navy/10 dark:bg-brand-navy/30" />
            <div className="w-16 h-5 rounded bg-gray-200 dark:bg-gray-700" />
          </div>
          {/* Nav items */}
          <div className="px-3 py-3 space-y-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                <div className="w-[18px] h-[18px] rounded bg-gray-200 dark:bg-gray-700" />
                <div className="h-3.5 rounded bg-gray-200 dark:bg-gray-700" style={{ width: `${60 + i * 10}px` }} />
              </div>
            ))}
          </div>
          {/* Progression */}
          <div className="mt-auto px-3 pb-4">
            <div className="w-16 h-2.5 rounded bg-gray-200 dark:bg-gray-700 mb-3" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2.5 px-2.5 py-2">
                <div className="w-6 h-6 rounded-md bg-gray-200 dark:bg-gray-700" />
                <div className="h-3 rounded bg-gray-200 dark:bg-gray-700 flex-1" />
              </div>
            ))}
          </div>
        </aside>

        {/* Main content skeleton */}
        <main className="flex-1 p-6 space-y-6">
          {/* Hero banner */}
          <div className="h-44 rounded-2xl bg-brand-navy/[0.06] dark:bg-brand-navy/20" />

          {/* Stats grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-28 rounded-xl bg-white dark:bg-surface-dark-card border border-[var(--border)]">
                <div className="p-4 space-y-3">
                  <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800" />
                  <div className="w-12 h-6 rounded bg-gray-200 dark:bg-gray-700" />
                  <div className="w-20 h-3 rounded bg-gray-100 dark:bg-gray-800" />
                </div>
              </div>
            ))}
          </div>

          {/* Content grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Course cards */}
            <div className="lg:col-span-2 space-y-4">
              <div className="w-32 h-5 rounded bg-gray-200 dark:bg-gray-700" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-48 rounded-xl bg-white dark:bg-surface-dark-card border border-[var(--border)]" />
                ))}
              </div>
            </div>
            {/* Side panels */}
            <div className="space-y-6">
              <div className="h-52 rounded-xl bg-white dark:bg-surface-dark-card border border-[var(--border)]" />
              <div className="h-52 rounded-xl bg-white dark:bg-surface-dark-card border border-[var(--border)]" />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
