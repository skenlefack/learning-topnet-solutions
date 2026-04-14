'use client';
// ============================================================================
// AU-IBAR Learning — Hero Banner
// Gradient navy background, progress ring, resume button
// ============================================================================
import clsx from 'clsx';
import { Play } from 'lucide-react';
import ProgressRing from './ProgressRing';

interface HeroBannerProps {
  user: any;
  enrollment: any;
  isLoading: boolean;
}

export default function HeroBanner({ user, enrollment, isLoading }: HeroBannerProps) {
  const progress = enrollment?.progress ?? 0;
  const courseName = enrollment?.course?.title ?? enrollment?.courseName ?? '';
  const firstName = user?.firstName ?? user?.name?.split(' ')[0] ?? '';

  if (isLoading) {
    return (
      <div className="relative overflow-hidden rounded-2xl px-6 py-8 lg:px-8 lg:py-10 bg-gradient-to-br from-brand-navy via-brand-navy to-brand-navy-deep animate-pulse">
        <div className="flex items-center justify-between gap-6">
          <div className="space-y-3 flex-1">
            <div className="h-8 w-64 rounded bg-white/10" />
            <div className="h-4 w-96 rounded bg-white/10" />
            <div className="h-10 w-40 rounded-full bg-white/10 mt-4" />
          </div>
          <div className="hidden md:block w-20 h-20 rounded-full bg-white/10" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={clsx(
        'relative overflow-hidden rounded-2xl px-6 py-8 lg:px-8 lg:py-10',
        'bg-gradient-to-br from-brand-navy via-brand-navy to-brand-navy-deep',
      )}
    >
      <div className="relative z-10 flex items-center justify-between gap-6">
        {/* Text content */}
        <div className="space-y-2">
          <p className="text-green-100/70 text-sm">
            {firstName ? `Bienvenue, ${firstName}` : 'Bienvenue sur AU-IBAR Learning'}
          </p>
          <h1 className="text-2xl lg:text-3xl font-bold text-white">
            Continuez votre parcours de certification
          </h1>
          {courseName && (
            <p className="text-green-100/80 text-sm lg:text-base max-w-lg">
              {courseName}
            </p>
          )}
          {enrollment && (
            <button
              className={clsx(
                'mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-full',
                'bg-brand-gold hover:bg-brand-gold-dark text-brand-navy-deep',
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
              trailColor="rgba(255,255,255,0.15)"
              strokeColor="#C8A951"
            >
              <span className="text-lg font-bold text-white">{Math.round(progress)}%</span>
            </ProgressRing>
          </div>
        )}
      </div>

      {/* Decorative circles */}
      <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-brand-gold/10 animate-float" />
      <div className="absolute -right-4 -bottom-8 w-28 h-28 rounded-full bg-white/5" />
      <div className="absolute left-1/2 -bottom-12 w-48 h-48 rounded-full bg-brand-gold/5" />
    </div>
  );
}
