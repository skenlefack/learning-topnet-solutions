'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { RefreshCw, BookOpen } from 'lucide-react';
import { useTranslations } from 'next-intl';

export default function CoursesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('errors');

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.error('[AU-IBAR Learning] Courses error:', error);
    }
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center py-20 px-6">
      <div className="text-center max-w-md">
        {/* Error icon */}
        <div className="mx-auto w-16 h-16 rounded-2xl bg-brand-gold-pale dark:bg-yellow-900/20 border border-brand-gold/30 dark:border-yellow-700 flex items-center justify-center mb-6">
          <BookOpen className="w-8 h-8 text-brand-gold dark:text-yellow-400" />
        </div>

        <h1 className="text-xl font-bold text-[var(--text-primary)]">
          {t('somethingWrong')}
        </h1>

        <p className="text-[var(--text-secondary)] mt-3 leading-relaxed text-sm">
          We could not load the course content. Please try again or browse other courses.
        </p>

        {error.digest && (
          <p className="mt-2 text-xs text-[var(--text-secondary)]/60 font-mono">
            {t('errorCode')}: {error.digest}
          </p>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-brand-navy hover:bg-brand-navy-deep focus:outline-none focus:ring-2 focus:ring-brand-navy/50 focus:ring-offset-2 transition-all duration-200 dark:bg-brand-gold dark:text-gray-900 dark:hover:bg-brand-gold-dark dark:focus:ring-brand-gold/50"
          >
            <RefreshCw className="w-4 h-4" />
            {t('tryAgain')}
          </button>

          <Link
            href="/courses"
            className="inline-flex items-center gap-2 justify-center px-5 py-2.5 rounded-lg text-sm font-semibold text-brand-navy dark:text-brand-gold border border-brand-navy/20 dark:border-brand-gold/30 hover:bg-brand-navy/5 dark:hover:bg-brand-gold/5 focus:outline-none focus:ring-2 focus:ring-brand-navy/50 dark:focus:ring-brand-gold/50 focus:ring-offset-2 transition-all duration-200"
          >
            <BookOpen className="w-4 h-4" />
            {t('browseOther')}
          </Link>
        </div>
      </div>
    </div>
  );
}
