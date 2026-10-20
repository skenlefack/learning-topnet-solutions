'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { RefreshCw, Home } from 'lucide-react';
import { useTranslations } from 'next-intl';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('errors');

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.error('[Topnet Solutions Academy] Unhandled error:', error);
    }
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-[var(--bg-primary)] relative overflow-hidden">
      {/* Background watermark */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
        <span className="font-display text-[20rem] leading-none text-brand-navy/[0.03] dark:text-white/[0.03]">
          !
        </span>
      </div>

      <div className="relative z-10 text-center max-w-md">
        {/* Error icon */}
        <div className="mx-auto w-20 h-20 rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-center justify-center mb-6">
          <svg
            className="w-10 h-10 text-red-500 dark:text-red-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-[var(--text-primary)]">
          {t('somethingWrong')}
        </h1>

        <p className="text-[var(--text-secondary)] mt-3 leading-relaxed">
          {t('notFoundDesc').replace(
            t('notFoundDesc'),
            'An unexpected error occurred. Please try again or return to the homepage.'
          )}
        </p>

        {error.digest && (
          <p className="mt-2 text-xs text-[var(--text-secondary)]/60 font-mono">
            {t('errorCode')}: {error.digest}
          </p>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold text-white bg-brand-navy hover:bg-brand-navy-deep focus:outline-none focus:ring-2 focus:ring-brand-navy/50 focus:ring-offset-2 transition-all duration-200 dark:bg-brand-gold dark:text-gray-900 dark:hover:bg-brand-gold-dark dark:focus:ring-brand-gold/50"
          >
            <RefreshCw className="w-4 h-4" />
            {t('tryAgain')}
          </button>

          <Link
            href="/"
            className="inline-flex items-center gap-2 justify-center px-6 py-3 rounded-lg text-sm font-semibold text-brand-navy dark:text-brand-gold border border-brand-navy/20 dark:border-brand-gold/30 hover:bg-brand-navy/5 dark:hover:bg-brand-gold/5 focus:outline-none focus:ring-2 focus:ring-brand-navy/50 dark:focus:ring-brand-gold/50 focus:ring-offset-2 transition-all duration-200"
          >
            <Home className="w-4 h-4" />
            {t('goHome')}
          </Link>
        </div>

        <p className="mt-12 text-xs text-[var(--text-secondary)]/60">
          Topnet Solutions Academy
        </p>
      </div>
    </div>
  );
}
