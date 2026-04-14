export default function AdminLoading() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="w-40 h-7 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="w-56 h-4 rounded bg-gray-100 dark:bg-gray-800" />
        </div>
      </div>

      {/* Tabs bar */}
      <div className="flex gap-1 border-b border-[var(--border)] pb-px">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="w-24 h-10 rounded-t bg-gray-100 dark:bg-gray-800" />
        ))}
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl bg-white dark:bg-surface-dark-card border border-[var(--border)] p-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800" />
              <div className="space-y-2 flex-1">
                <div className="w-12 h-5 rounded bg-gray-200 dark:bg-gray-700" />
                <div className="w-16 h-3 rounded bg-gray-100 dark:bg-gray-800" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Table skeleton */}
      <div className="rounded-xl overflow-hidden border border-[var(--border)] bg-white dark:bg-surface-dark-card">
        {/* Table header */}
        <div className="flex gap-4 px-4 py-3 border-b border-[var(--border)] bg-gray-50 dark:bg-gray-800/50">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex-1 h-3 rounded bg-gray-200 dark:bg-gray-700" />
          ))}
        </div>

        {/* Table rows */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex gap-4 px-4 py-3 border-b border-[var(--border)] last:border-b-0"
          >
            {Array.from({ length: 5 }).map((_, j) => (
              <div
                key={j}
                className="flex-1 h-4 rounded bg-gray-100 dark:bg-gray-800"
              />
            ))}
          </div>
        ))}

        {/* Pagination footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border)]">
          <div className="w-32 h-3 rounded bg-gray-100 dark:bg-gray-800" />
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-gray-100 dark:bg-gray-800" />
            <div className="w-12 h-3 rounded bg-gray-100 dark:bg-gray-800" />
            <div className="w-8 h-8 rounded bg-gray-100 dark:bg-gray-800" />
          </div>
        </div>
      </div>
    </div>
  );
}
