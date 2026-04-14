'use client';
// ============================================================================
// AU-IBAR Learning — Course Grid
// Enrolled + available courses with progress bars
// ============================================================================
import clsx from 'clsx';
import { BookOpen, Clock, ChevronRight } from 'lucide-react';
import ProgressRing from './ProgressRing';

interface CourseGridProps {
  courses: any[];
  enrollments: any[];
  isLoading: boolean;
}

export default function CourseGrid({ courses, enrollments, isLoading }: CourseGridProps) {
  const enrollMap = new Map<string, any>();
  enrollments.forEach((e: any) => {
    enrollMap.set(e.courseId ?? e.course_id, e);
  });

  const enrolled = courses.filter((c: any) => enrollMap.has(c.id));
  const available = courses.filter((c: any) => !enrollMap.has(c.id));

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-6 w-32 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-[var(--border)] bg-white dark:bg-surface-dark-card animate-pulse"
            >
              <div className="h-32 rounded-t-xl bg-gray-100 dark:bg-gray-800" />
              <div className="p-4 space-y-2">
                <div className="h-4 w-3/4 rounded bg-gray-100 dark:bg-gray-800" />
                <div className="h-3 w-1/2 rounded bg-gray-50 dark:bg-gray-800/50" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">
          Mes cours
        </h2>
        <button className="text-sm text-brand-navy dark:text-green-400 hover:underline flex items-center gap-1">
          Voir tout <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {enrolled.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {enrolled.map((course: any) => {
            const enrollment = enrollMap.get(course.id);
            return (
              <CourseCard
                key={course.id}
                course={course}
                enrollment={enrollment}
              />
            );
          })}
        </div>
      )}

      {available.length > 0 && (
        <>
          <h3 className="text-sm font-medium text-[var(--text-secondary)] mt-4">
            Cours disponibles
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {available.slice(0, 4).map((course: any) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        </>
      )}

      {courses.length === 0 && (
        <div className="text-center py-12 text-[var(--text-secondary)]">
          <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Aucun cours disponible pour le moment</p>
        </div>
      )}
    </div>
  );
}

const LEVEL_COLORS: Record<string, string> = {
  beginner: 'bg-green-500',
  foundation: 'bg-green-500',
  débutant: 'bg-green-500',
  intermediate: 'bg-blue-500',
  intermédiaire: 'bg-blue-500',
  advanced: 'bg-purple-500',
  avancé: 'bg-purple-500',
  expert: 'bg-brand-gold',
};

function CourseCard({ course, enrollment }: { course: any; enrollment?: any }) {
  const progress = enrollment?.progress ?? 0;
  const title = typeof course.title === 'object'
    ? (course.title.fr || course.title.en || Object.values(course.title)[0])
    : course.title;
  const description = typeof course.description === 'object'
    ? (course.description.fr || course.description.en || '')
    : (course.description ?? '');
  const level = course.level ?? course.difficulty;
  const moduleCount = course.moduleCount ?? course.modules?.length ?? 0;
  const isNew = course.isNew || course.is_new;
  const isPopular = course.isPopular || course.is_popular;
  const levelColor = level ? (LEVEL_COLORS[level.toLowerCase()] ?? 'bg-brand-navy') : 'bg-brand-navy';

  return (
    <div
      className={clsx(
        'card-hover rounded-xl overflow-hidden',
        'bg-white dark:bg-surface-dark-card',
        'border border-[var(--border)]',
        'cursor-pointer group',
      )}
    >
      {/* Color accent bar */}
      <div className={clsx('h-1', levelColor)} />

      <div className="relative h-32 bg-gradient-to-br from-brand-navy/80 to-brand-navy-deep flex items-center justify-center">
        <BookOpen className="w-8 h-8 text-white/30" />

        {/* Tags */}
        <div className="absolute top-2 left-2 flex items-center gap-1.5">
          {level && (
            <span className="px-2 py-0.5 text-[10px] font-semibold uppercase rounded-full bg-brand-gold/90 text-brand-navy-deep">
              {level}
            </span>
          )}
          {isNew && (
            <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-green-500 text-white">
              Nouveau
            </span>
          )}
          {isPopular && (
            <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-purple-500 text-white">
              Populaire
            </span>
          )}
        </div>

        {enrollment && (
          <div className="absolute top-2 right-2">
            <ProgressRing
              percent={progress}
              size={36}
              strokeWidth={3}
              trailColor="rgba(255,255,255,0.2)"
              strokeColor="#C8A951"
            >
              <span className="text-[9px] font-bold text-white">{Math.round(progress)}%</span>
            </ProgressRing>
          </div>
        )}
      </div>

      <div className="p-4 space-y-2">
        <h4 className="text-sm font-semibold text-[var(--text-primary)] line-clamp-2 group-hover:text-brand-navy dark:group-hover:text-green-400 transition-colors">
          {title || 'Sans titre'}
        </h4>
        {description && (
          <p className="text-xs text-[var(--text-secondary)] line-clamp-2">{description}</p>
        )}
        <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)]">
          {moduleCount > 0 && (
            <span className="flex items-center gap-1">
              <BookOpen className="w-3 h-3" /> {moduleCount} modules
            </span>
          )}
          {enrollment && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" /> En cours
            </span>
          )}
        </div>

        {enrollment && (
          <div className="w-full h-1.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-gold to-brand-gold-dark transition-all duration-700"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
