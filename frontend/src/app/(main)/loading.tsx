export default function MainLoading() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-pulse">
      {/* Hero banner placeholder */}
      <div className="h-44 rounded-2xl bg-brand-navy/10 dark:bg-brand-navy/5" />

      {/* Stats cards — 4 columns */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl bg-white dark:bg-surface-dark-card border border-[var(--border)] p-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800" />
              <div className="space-y-2 flex-1">
                <div className="w-12 h-5 rounded bg-gray-200 dark:bg-gray-700" />
                <div className="w-20 h-3 rounded bg-gray-100 dark:bg-gray-800" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Content section — 2 cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl bg-white dark:bg-surface-dark-card border border-[var(--border)] p-5">
          <div className="w-40 h-4 rounded bg-gray-200 dark:bg-gray-700 mb-4" />
          <div className="h-40 rounded-lg bg-gray-50 dark:bg-gray-800/50" />
        </div>
        <div className="rounded-xl bg-white dark:bg-surface-dark-card border border-[var(--border)] p-5">
          <div className="w-40 h-4 rounded bg-gray-200 dark:bg-gray-700 mb-4" />
          <div className="h-40 rounded-lg bg-gray-50 dark:bg-gray-800/50" />
        </div>
      </div>

      {/* Course list placeholder */}
      <div className="rounded-xl bg-white dark:bg-surface-dark-card border border-[var(--border)] p-5">
        <div className="w-48 h-4 rounded bg-gray-200 dark:bg-gray-700 mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/30"
            >
              <div className="w-16 h-12 rounded-lg bg-gray-200 dark:bg-gray-700 flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="w-3/4 h-4 rounded bg-gray-200 dark:bg-gray-700" />
                <div className="w-1/2 h-3 rounded bg-gray-100 dark:bg-gray-800" />
              </div>
              <div className="w-16 h-2 rounded-full bg-gray-200 dark:bg-gray-700" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
