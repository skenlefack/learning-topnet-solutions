export default function CoursesLoading() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-pulse">
      {/* Page title */}
      <div className="flex items-center justify-between">
        <div className="w-40 h-7 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="flex gap-2">
          <div className="w-24 h-9 rounded-lg bg-gray-200 dark:bg-gray-700" />
          <div className="w-24 h-9 rounded-lg bg-gray-200 dark:bg-gray-700" />
        </div>
      </div>

      {/* Course cards grid — 3x2 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl bg-white dark:bg-surface-dark-card border border-[var(--border)] overflow-hidden"
          >
            {/* Thumbnail placeholder */}
            <div className="h-36 bg-gray-100 dark:bg-gray-800 relative">
              <div className="absolute top-3 left-3 w-16 h-5 rounded-full bg-gray-200 dark:bg-gray-700" />
            </div>
            {/* Content */}
            <div className="p-4 space-y-3">
              <div className="w-3/4 h-5 rounded bg-gray-200 dark:bg-gray-700" />
              <div className="space-y-1.5">
                <div className="w-full h-3 rounded bg-gray-100 dark:bg-gray-800" />
                <div className="w-2/3 h-3 rounded bg-gray-100 dark:bg-gray-800" />
              </div>
              {/* Progress bar */}
              <div className="w-full h-2 rounded-full bg-gray-100 dark:bg-gray-800" />
              {/* Footer */}
              <div className="flex items-center justify-between pt-1">
                <div className="w-16 h-3 rounded bg-gray-100 dark:bg-gray-800" />
                <div className="w-20 h-3 rounded bg-gray-100 dark:bg-gray-800" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
