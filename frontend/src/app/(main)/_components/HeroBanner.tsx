'use client';
// ============================================================================
// ARIS Academy — Hero Banner
// Gradient navy background, progress ring, resume button
// ============================================================================
import clsx from 'clsx';
import { Play } from 'lucide-react';
import ProgressRing from './ProgressRing';
import { t as pickLang } from '@/lib/utils';

interface HeroBannerProps {
  user: any;
  enrollment: any;
  isLoading: boolean;
}

export default function HeroBanner({ user, enrollment, isLoading }: HeroBannerProps) {
  const progress = enrollment?.progress ?? 0;
  // course.title may be a MultiLangText (JSONB) or a plain string; courseName is always a string
  const courseName = pickLang(enrollment?.course?.title, 'fr') || enrollment?.courseName || '';
  const firstName = user?.firstName ?? user?.name?.split(' ')[0] ?? '';

  if (isLoading) {
    return (
      <div className="relative overflow-hidden rounded-2xl px-6 py-8 lg:px-8 lg:py-10 bg-gradient-to-br from-gray-50 to-white dark:from-surface-dark-card dark:to-surface-dark-card border border-[var(--border)] animate-pulse">
        <div className="flex items-center justify-between gap-6">
          <div className="space-y-3 flex-1">
            <div className="h-8 w-64 rounded bg-gray-200 dark:bg-gray-700" />
            <div className="h-4 w-96 rounded bg-gray-100 dark:bg-gray-800" />
            <div className="h-10 w-40 rounded-full bg-gray-200 dark:bg-gray-700 mt-4" />
          </div>
          <div className="hidden md:block w-20 h-20 rounded-full bg-gray-200 dark:bg-gray-700" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={clsx(
        'relative overflow-hidden rounded-2xl px-6 py-8 lg:px-8 lg:py-10',
        'bg-gradient-to-br from-gray-50 to-white dark:from-surface-dark-card dark:to-surface-dark-card',
        'border border-[var(--border)]',
      )}
    >
      <div className="relative z-10 flex items-center justify-between gap-6">
        {/* Text content */}
        <div className="space-y-2">
          <p className="text-[var(--text-secondary)] text-sm">
            {firstName ? `Bienvenue, ${firstName}` : 'Bienvenue sur AU-IBAR Learning'}
          </p>
          <h1 className="text-2xl lg:text-3xl font-bold text-[var(--text-primary)]">
            Continuez votre parcours de certification
          </h1>
          {courseName && (
            <p className="text-[var(--text-secondary)] text-sm lg:text-base max-w-lg">
              {courseName}
            </p>
          )}
          {enrollment && (
            <button
              className={clsx(
                'mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-full',
                'bg-brand-navy hover:bg-brand-navy-deep text-white',
                'dark:bg-brand-gold dark:hover:bg-brand-gold-dark dark:text-gray-900',
                'font-semibold text-sm transition-colors',
              )}
            >
              <Play className="w-4 h-4" />
              Reprendre le cours
            </button>
          )}
        </div>

        {/* Progress ring */}
        {enrollment && (
          <div className="hidden md:block flex-shrink-0 animate-float">
            <ProgressRing
              percent={progress}
              size={96}
              strokeWidth={7}
              trailColor="rgba(0,0,0,0.08)"
              strokeColor="#1A5632"
            >
              <span className="text-lg font-bold text-[var(--text-primary)]">{Math.round(progress)}%</span>
            </ProgressRing>
          </div>
        )}
      </div>

      {/* Decorative circles */}
      <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-brand-navy/[0.03] dark:bg-brand-gold/[0.05] animate-float" />
      <div className="absolute -right-4 -bottom-8 w-28 h-28 rounded-full bg-brand-gold/[0.04]" />
      <div className="absolute left-1/2 -bottom-12 w-48 h-48 rounded-full bg-brand-navy/[0.02] dark:bg-brand-gold/[0.03]" />
    </div>
  );
}
