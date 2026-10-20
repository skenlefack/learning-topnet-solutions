'use client';
// ============================================================================
// Topnet Solutions Academy — Course Detail
// Header, accordion modules, lesson status, progress, sidebar, live sessions
// ============================================================================
import { useState, useMemo, useCallback } from 'react';
import { useParams } from 'next/navigation';
import useSWR, { mutate as globalMutate } from 'swr';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  ChevronRight,
  Clock,
  Users,
  BookOpen,
  Play,
  FileText,
  HelpCircle,
  Wrench,
  RotateCcw,
  CheckCircle2,
  Lock,
  Circle,
  Video,
  Calendar,
  ArrowLeft,
  Loader2,
  Award,
} from 'lucide-react';
import clsx from 'clsx';
import Link from 'next/link';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/lib/store';
import { courseApi, learningApi, liveApi } from '@/lib/api';
import { t, LEVEL_META, formatDuration } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Animation
// ---------------------------------------------------------------------------

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};

// Lesson-type icons
const LESSON_ICONS: Record<string, React.FC<{ className?: string }>> = {
  video: Play,
  text: FileText,
  quiz: HelpCircle,
  practical: Wrench,
  replay: RotateCcw,
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const language = useAuthStore((s) => s.language);
  const t_courses = useTranslations('courses');
  const t_levels = useTranslations('levels');
  const t_live = useTranslations('live');

  // Fetch course, modules, enrollments, live sessions in parallel
  const { data: courseRes, isLoading: loadingCourse } = useSWR(
    token && id ? ['course', id] : null,
    () => courseApi.get(token!, id),
  );

  const { data: modulesRes } = useSWR(
    token && id ? ['modules', id] : null,
    () => courseApi.modules(token!, id),
  );

  const { data: enrollRes } = useSWR(
    token ? ['enrollments-list'] : null,
    () => learningApi.enrollments(token!),
  );

  const { data: liveRes } = useSWR(
    token && id ? ['live-course', id] : null,
    () => liveApi.forCourse(token!, id),
  );

  const course: any = (courseRes as any)?.data ?? courseRes ?? null;
  const modules: any[] = (modulesRes as any)?.data ?? [];
  const liveSessions: any[] = (liveRes as any)?.data ?? [];

  // Find enrollment for this course
  const enrollment = useMemo(() => {
    const list = (enrollRes as any)?.data ?? enrollRes ?? [];
    if (!Array.isArray(list)) return null;
    return list.find((e: any) => e.course_id === id) ?? null;
  }, [enrollRes, id]);

  // Fetch progress if enrolled
  const { data: progressRes } = useSWR(
    token && enrollment ? ['progress', enrollment.id] : null,
    () => learningApi.progress(token!, enrollment!.id),
  );

  const progressList: any[] = (progressRes as any)?.data ?? progressRes ?? [];
  const progressMap = useMemo(() => {
    const map: Record<string, any> = {};
    if (Array.isArray(progressList)) {
      progressList.forEach((p: any) => { map[p.lesson_id] = p; });
    }
    return map;
  }, [progressList]);

  // Level meta
  const meta = LEVEL_META[course?.level] ?? LEVEL_META.beginner;

  // Enroll handler
  const [enrolling, setEnrolling] = useState(false);
  const handleEnroll = useCallback(async () => {
    if (!token || !id) return;
    setEnrolling(true);
    try {
      await learningApi.enroll(token, id);
      toast.success(t_courses('enrollSuccess'));
      globalMutate(['enrollments-list']);
    } catch (err: any) {
      toast.error(err.message || t_courses('enrollError'));
    } finally {
      setEnrolling(false);
    }
  }, [token, id]);

  // Stats
  const totalLessons = modules.reduce((sum: number, m: any) => sum + (m.lessons?.length ?? 0), 0);
  const completedLessons = Object.values(progressMap).filter((p: any) => p.is_completed).length;

  // Find first incomplete lesson for "Continue" button
  const nextLesson = useMemo(() => {
    for (const mod of modules) {
      const sorted = [...(mod.lessons ?? [])].sort((a: any, b: any) => a.sort_order - b.sort_order);
      for (const lesson of sorted) {
        if (!progressMap[lesson.id]?.is_completed) return lesson;
      }
    }
    return null;
  }, [modules, progressMap]);

  // Loading skeleton
  if (loadingCourse) {
    return (
      <div className="max-w-7xl mx-auto space-y-6 animate-pulse">
        <div className="h-52 rounded-2xl bg-gray-100 dark:bg-gray-800" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-xl bg-gray-100 dark:bg-gray-800" />
            ))}
          </div>
          <div className="h-80 rounded-xl bg-gray-100 dark:bg-gray-800" />
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="text-center py-20">
        <BookOpen className="w-12 h-12 mx-auto text-[var(--text-secondary)] opacity-30 mb-3" />
        <p className="text-[var(--text-secondary)]">{t_courses('notFound')}</p>
        <Link href="/courses" className="text-sm text-brand-navy dark:text-brand-gold mt-2 inline-block hover:underline">
          {t_courses('backToCatalog')}
        </Link>
      </div>
    );
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
      className="max-w-7xl mx-auto space-y-6"
    >
      {/* Back link */}
      <motion.div variants={fadeUp}>
        <Link
          href="/courses"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> {t_courses('backToCatalog')}
        </Link>
      </motion.div>

      {/* Hero header */}
      <motion.div
        variants={fadeUp}
        className={clsx(
          'relative overflow-hidden rounded-2xl',
          'bg-gradient-to-br from-gray-50 to-white dark:from-surface-dark-card dark:to-surface-dark-card',
          'border border-[var(--border)]',
        )}
      >
        <div className="relative z-10 px-6 py-8 lg:px-8 lg:py-10">
          <span
            className={clsx(
              'inline-block px-3 py-1 rounded-md text-xs font-bold uppercase tracking-wide mb-3',
              meta.color,
            )}
          >
            {t_levels(course?.level ?? 'beginner')}
          </span>
          <h1 className="text-2xl lg:text-3xl font-bold text-[var(--text-primary)] mb-2">
            {t(course.title, language)}
          </h1>
          <p className="text-[var(--text-secondary)] max-w-2xl text-sm lg:text-base mb-4">
            {t(course.description, language)}
          </p>
          <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--text-secondary)]">
            {course.estimated_hours && (
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                {course.estimated_hours}{t_courses('trainingHours')}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <BookOpen className="w-4 h-4" />
              {modules.length} {t_courses('modules')} · {totalLessons} {t_courses('lessons')}
            </span>
            {course.enrollment_count != null && (
              <span className="flex items-center gap-1.5">
                <Users className="w-4 h-4" />
                {course.enrollment_count} {t_courses('enrolled')}
              </span>
            )}
          </div>
        </div>
        {/* Decorative */}
        <div className="absolute -right-10 -top-10 w-44 h-44 rounded-full bg-brand-navy/[0.03] dark:bg-brand-gold/[0.05] animate-float" />
        <div className="absolute -right-4 -bottom-8 w-28 h-28 rounded-full bg-brand-gold/[0.04]" />

        {/* Thumbnail overlay */}
        {course.thumbnail_url && (
          <div className="absolute inset-0 z-0">
            <img src={course.thumbnail_url} alt="" className="w-full h-full object-cover opacity-15" />
          </div>
        )}
      </motion.div>

      {/* Main grid: modules + sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left — Modules accordion */}
        <motion.div variants={fadeUp} className="lg:col-span-2 space-y-3">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            {t_courses('courseContent')}
          </h2>

          {modules.length === 0 ? (
            <p className="text-sm text-[var(--text-secondary)] py-8 text-center">
              {t_courses('modulesComingSoon')}
            </p>
          ) : (
            <div className="space-y-2">
              {modules
                .sort((a: any, b: any) => a.sort_order - b.sort_order)
                .map((mod: any, idx: number) => (
                  <ModuleAccordion
                    key={mod.id}
                    module={mod}
                    index={idx}
                    lang={language}
                    progressMap={progressMap}
                    isEnrolled={!!enrollment}
                  />
                ))}
            </div>
          )}

          {/* Live sessions section */}
          {liveSessions.length > 0 && (
            <div className="pt-4">
              <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">
                {t_courses('liveSessions')}
              </h2>
              <div className="space-y-2">
                {liveSessions.map((session: any) => (
                  <div
                    key={session.id}
                    className={clsx(
                      'flex items-center gap-4 p-4 rounded-xl',
                      'bg-white dark:bg-surface-dark-card border border-[var(--border)]',
                    )}
                  >
                    <div className={clsx(
                      'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
                      session.status === 'live'
                        ? 'bg-red-100 dark:bg-red-900/30'
                        : 'bg-blue-50 dark:bg-blue-900/20',
                    )}>
                      <Video className={clsx(
                        'w-5 h-5',
                        session.status === 'live' ? 'text-red-500' : 'text-blue-500',
                      )} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                        {t(session.title, language)}
                      </p>
                      <p className="text-xs text-[var(--text-secondary)] flex items-center gap-1.5">
                        <Calendar className="w-3 h-3" />
                        {session.scheduled_at
                          ? format(new Date(session.scheduled_at), 'PPP à HH:mm', { locale: fr })
                          : '—'}
                        {session.duration_minutes && ` · ${session.duration_minutes}min`}
                      </p>
                    </div>
                    {session.status === 'live' && (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 animate-pulse">
                        {t_live('liveStatus')}
                      </span>
                    )}
                    {session.status === 'scheduled' && (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                        {t_live('scheduled')}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>

        {/* Right — Sidebar */}
        <motion.div variants={fadeUp} className="space-y-4">
          {/* Enroll / Continue card */}
          <div
            className={clsx(
              'rounded-xl p-5',
              'bg-white dark:bg-surface-dark-card border border-[var(--border)]',
            )}
          >
            {enrollment ? (
              <>
                {/* Progress */}
                <div className="mb-4">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="font-medium text-[var(--text-primary)]">{t_courses('progress')}</span>
                    <span className="font-bold text-brand-navy dark:text-brand-gold">
                      {Math.round(enrollment.progress_percent ?? 0)}%
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-brand-navy dark:bg-brand-gold transition-all duration-500"
                      style={{ width: `${Math.round(enrollment.progress_percent ?? 0)}%` }}
                    />
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] mt-1.5">
                    {completedLessons}/{totalLessons} {t_courses('lessonsCompleted')}
                  </p>
                </div>

                {nextLesson ? (
                  <Link
                    href={`/learn/${nextLesson.id}`}
                    className={clsx(
                      'flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-semibold transition-colors',
                      'bg-brand-navy text-white hover:bg-brand-navy-deep',
                      'dark:bg-brand-gold dark:text-gray-900 dark:hover:bg-brand-gold-dark',
                    )}
                  >
                    <Play className="w-4 h-4" />
                    {t_courses('continue')}
                  </Link>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 font-medium">
                    <CheckCircle2 className="w-4 h-4" />
                    {t_courses('courseCompleted')}
                  </div>
                )}
              </>
            ) : (
              <button
                onClick={handleEnroll}
                disabled={enrolling}
                className={clsx(
                  'flex items-center justify-center gap-2 w-full py-3 rounded-lg text-sm font-semibold transition-colors',
                  'bg-brand-navy text-white hover:bg-brand-navy-deep',
                  'dark:bg-brand-gold dark:text-gray-900 dark:hover:bg-brand-gold-dark',
                  enrolling && 'opacity-60 cursor-not-allowed',
                )}
              >
                {enrolling ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> {t_courses('enrolling')}
                  </>
                ) : (
                  t_courses('enrollFree')
                )}
              </button>
            )}
          </div>

          {/* Course info card */}
          <div
            className={clsx(
              'rounded-xl p-5 space-y-3',
              'bg-white dark:bg-surface-dark-card border border-[var(--border)]',
            )}
          >
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">{t_courses('information')}</h3>
            <dl className="space-y-2.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-[var(--text-secondary)]">{t_courses('levelLabel')}</dt>
                <dd className="font-medium text-[var(--text-primary)]">{t_levels(course?.level ?? 'beginner')}</dd>
              </div>
              {course.estimated_hours && (
                <div className="flex justify-between">
                  <dt className="text-[var(--text-secondary)]">{t_courses('estimatedDuration')}</dt>
                  <dd className="font-medium text-[var(--text-primary)]">{course.estimated_hours}h</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-[var(--text-secondary)]">{t_courses('modulesLabel')}</dt>
                <dd className="font-medium text-[var(--text-primary)]">{modules.length}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--text-secondary)]">{t_courses('lessonsLabel')}</dt>
                <dd className="font-medium text-[var(--text-primary)]">{totalLessons}</dd>
              </div>
              {course.passing_score && (
                <div className="flex justify-between">
                  <dt className="text-[var(--text-secondary)]">{t_courses('passingScore')}</dt>
                  <dd className="font-medium text-[var(--text-primary)]">{course.passing_score}%</dd>
                </div>
              )}
            </dl>

            {course.tags?.length > 0 && (
              <div className="pt-2 border-t border-[var(--border)]">
                <p className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
                  {t_courses('tags')}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {course.tags.map((tag: string) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 dark:bg-gray-800 text-[var(--text-secondary)]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Certification badge */}
          <div
            className={clsx(
              'rounded-xl p-5',
              'bg-gradient-to-br from-brand-gold/5 to-brand-gold/10 dark:from-brand-gold/10 dark:to-brand-gold/5',
              'border border-brand-gold/20',
            )}
          >
            <div className="flex items-center gap-3">
              <Award className="w-8 h-8 text-brand-gold" />
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">{t_courses('certification')}</p>
                <p className="text-xs text-[var(--text-secondary)]">
                  {t_courses('certificationDesc')}
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Module accordion
// ---------------------------------------------------------------------------

function ModuleAccordion({
  module: mod,
  index,
  lang,
  progressMap,
  isEnrolled,
}: {
  module: any;
  index: number;
  lang: string;
  progressMap: Record<string, any>;
  isEnrolled: boolean;
}) {
  const t_courses = useTranslations('courses');
  const [open, setOpen] = useState(index === 0);
  const lessons: any[] = [...(mod.lessons ?? [])].sort((a, b) => a.sort_order - b.sort_order);

  const completedInModule = lessons.filter((l) => progressMap[l.id]?.is_completed).length;
  const allDone = lessons.length > 0 && completedInModule === lessons.length;

  return (
    <div
      className={clsx(
        'rounded-xl overflow-hidden',
        'bg-white dark:bg-surface-dark-card border border-[var(--border)]',
      )}
    >
      {/* Header */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
      >
        <div className={clsx(
          'w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0',
          allDone
            ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
            : 'bg-brand-navy/5 text-brand-navy dark:bg-brand-navy/20 dark:text-green-300',
        )}>
          {allDone ? <CheckCircle2 className="w-4 h-4" /> : index + 1}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[var(--text-primary)] truncate">
            {t(mod.title, lang)}
          </p>
          <p className="text-xs text-[var(--text-secondary)]">
            {lessons.length} {lessons.length !== 1 ? t_courses('lessonPlural') : t_courses('lesson')}
            {mod.estimated_minutes ? ` · ${formatDuration(mod.estimated_minutes)}` : ''}
            {isEnrolled && ` · ${completedInModule}/${lessons.length}`}
          </p>
        </div>

        <ChevronDown
          className={clsx(
            'w-4 h-4 text-[var(--text-secondary)] transition-transform shrink-0',
            open && 'rotate-180',
          )}
        />
      </button>

      {/* Lessons */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="border-t border-[var(--border)]">
              {lessons.map((lesson) => {
                const progress = progressMap[lesson.id];
                const Icon = LESSON_ICONS[lesson.type] || FileText;
                const done = progress?.is_completed;

                return (
                  <LessonRow
                    key={lesson.id}
                    lesson={lesson}
                    lang={lang}
                    Icon={Icon}
                    done={done}
                    isEnrolled={isEnrolled}
                  />
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lesson row
// ---------------------------------------------------------------------------

function LessonRow({
  lesson,
  lang,
  Icon,
  done,
  isEnrolled,
}: {
  lesson: any;
  lang: string;
  Icon: React.FC<{ className?: string }>;
  done: boolean;
  isEnrolled: boolean;
}) {
  const inner = (
    <div
      className={clsx(
        'flex items-center gap-3 px-4 py-3 text-sm transition-colors',
        isEnrolled
          ? 'hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer'
          : 'opacity-70',
      )}
    >
      {/* Status icon */}
      {done ? (
        <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
      ) : isEnrolled ? (
        <Circle className="w-4 h-4 text-gray-300 dark:text-gray-600 shrink-0" />
      ) : (
        <Lock className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 shrink-0" />
      )}

      {/* Type icon */}
      <Icon className="w-4 h-4 text-[var(--text-secondary)] shrink-0" />

      {/* Title */}
      <span className={clsx('flex-1 truncate', done ? 'text-[var(--text-secondary)]' : 'text-[var(--text-primary)]')}>
        {t(lesson.title, lang)}
      </span>

      {/* Duration */}
      {lesson.duration_minutes && (
        <span className="text-xs text-[var(--text-secondary)] shrink-0">
          {formatDuration(lesson.duration_minutes)}
        </span>
      )}

      {isEnrolled && <ChevronRight className="w-3.5 h-3.5 text-[var(--text-secondary)] shrink-0" />}
    </div>
  );

  if (!isEnrolled) return <div key={lesson.id}>{inner}</div>;

  return (
    <Link key={lesson.id} href={`/learn/${lesson.id}`}>
      {inner}
    </Link>
  );
}
