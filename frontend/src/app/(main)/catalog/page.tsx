'use client';
// ============================================================================
// AU-IBAR Learning — All Courses Catalog
// Browse all platform courses with search, category filter, enroll
// ============================================================================
import { useState, useEffect, useMemo, useCallback } from 'react';
import useSWR, { mutate as globalMutate } from 'swr';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  SlidersHorizontal,
  ArrowUpDown,
  BookOpen,
  Clock,
  Users,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import clsx from 'clsx';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/lib/store';
import { courseApi, learningApi, categoryApi, pathApi } from '@/lib/api';
import { t, LEVEL_META } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Animation
// ---------------------------------------------------------------------------

const stagger = { visible: { transition: { staggerChildren: 0.07 } } };
const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};

// ---------------------------------------------------------------------------
// Filter constants
// ---------------------------------------------------------------------------

const LEVELS = [
  { value: '', i18nKey: 'allLevels' },
  { value: 'beginner', i18nKey: 'beginner' },
  { value: 'intermediate', i18nKey: 'intermediate' },
  { value: 'advanced', i18nKey: 'advanced' },
  { value: 'expert', i18nKey: 'expert' },
];

const SORT_OPTIONS = [
  { value: 'popular', i18nKey: 'popularity' },
  { value: 'newest', i18nKey: 'newest' },
  { value: 'progress', i18nKey: 'progressSort' },
];

const STATUS_FILTERS = [
  { value: '', i18nKey: 'all' },
  { value: 'not_started', i18nKey: 'notStarted' },
  { value: 'in_progress', i18nKey: 'inProgress' },
  { value: 'completed', i18nKey: 'completed' },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CoursesPage() {
  const { token } = useAuth();
  const language = useAuthStore((s) => s.language);
  const t_courses = useTranslations('courses');
  const t_levels = useTranslations('levels');

  // Filters state
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [level, setLevel] = useState('');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState('popular');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const limit = 12;

  // Fetch categories
  useEffect(() => {
    categoryApi.list().then((res: any) => setCategories(res.data || [])).catch(() => {});
  }, []);

  // Debounce search (300ms)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [debouncedSearch, level, sort, status, category]);

  // ---- Data fetching ----

  const courseKey = token
    ? ['courses', debouncedSearch, level, sort, page, limit]
    : null;

  const { data: coursesRes, isLoading } = useSWR(courseKey, () =>
    courseApi.list(token!, {
      search: debouncedSearch || undefined,
      level: level || undefined,
      sort: sort || undefined,
      page,
      limit,
    }),
  );

  const { data: enrollRes } = useSWR(
    token ? ['enrollments-list'] : null,
    () => learningApi.enrollments(token!),
  );

  const courses: any[] = coursesRes?.data ?? [];
  const total = coursesRes?.total ?? 0;
  const totalPages = Math.ceil(total / limit) || 1;

  // Map enrollment by courseId
  const enrollMap = useMemo(() => {
    const raw = (enrollRes as any)?.data ?? enrollRes ?? [];
    const list = Array.isArray(raw) ? raw : [];
    const map: Record<string, any> = {};
    list.forEach((e: any) => { map[e.course_id] = e; });
    return map;
  }, [enrollRes]);

  // Client-side status + category filter
  const displayed = useMemo(() => {
    let filtered = courses;
    if (category) {
      filtered = filtered.filter((c: any) => c.category_id === category);
    }
    if (status) {
      filtered = filtered.filter((c: any) => {
        const enr = enrollMap[c.id];
        if (status === 'not_started') return !enr;
        if (status === 'in_progress') return enr && enr.status === 'active' && (enr.progress_percent ?? 0) < 100;
        if (status === 'completed') return enr?.status === 'completed';
        return true;
      });
    }
    return filtered;
  }, [courses, status, category, enrollMap]);

  // ---- Enroll handler ----
  const handleEnroll = useCallback(async (courseId: string) => {
    if (!token) return;
    try {
      await learningApi.enroll(token, courseId);
      toast.success(t_courses('enrollSuccess'));
      globalMutate(['enrollments-list']);
    } catch (err: any) {
      toast.error(err.message || t_courses('enrollError'));
    }
  }, [token]);

  // ---- Render ----

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={stagger}
      className="space-y-5 max-w-7xl mx-auto"
    >
      {/* Title */}
      <motion.div variants={fadeUp}>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">{t_courses('title')}</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          {t_courses('subtitle')}
        </p>
      </motion.div>

      {/* Search + Filters bar */}
      <motion.div variants={fadeUp} className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t_courses('searchPlaceholder')}
              className={clsx(
                'w-full pl-10 pr-4 py-2.5 rounded-xl text-sm',
                'bg-white dark:bg-surface-dark-card border border-[var(--border)]',
                'text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]',
                'focus:outline-none focus:ring-2 focus:ring-brand-navy/20 dark:focus:ring-brand-gold/20',
              )}
            />
          </div>

          <div className="flex gap-2">
            {/* Filter toggle */}
            <button
              onClick={() => setFiltersOpen(!filtersOpen)}
              className={clsx(
                'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors',
                filtersOpen
                  ? 'bg-brand-navy/5 border-brand-navy/20 text-brand-navy dark:bg-brand-navy/20 dark:text-white dark:border-brand-navy/40'
                  : 'bg-white dark:bg-surface-dark-card border-[var(--border)] text-[var(--text-secondary)] hover:bg-gray-50 dark:hover:bg-gray-800/50',
              )}
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span className="hidden sm:inline">{t_courses('filters')}</span>
              {(level || status || category) && <span className="w-2 h-2 rounded-full bg-brand-gold" />}
            </button>

            {/* Sort */}
            <div className="relative">
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className={clsx(
                  'appearance-none pl-3 pr-8 py-2.5 rounded-xl text-sm font-medium cursor-pointer',
                  'bg-white dark:bg-surface-dark-card border border-[var(--border)]',
                  'text-[var(--text-primary)]',
                  'focus:outline-none focus:ring-2 focus:ring-brand-navy/20',
                )}
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{t_courses(o.i18nKey)}</option>
                ))}
              </select>
              <ArrowUpDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-secondary)] pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Expanded filter panel */}
        <AnimatePresence>
          {filtersOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="flex flex-wrap gap-6 p-4 rounded-xl bg-white dark:bg-surface-dark-card border border-[var(--border)]">
                {/* Level */}
                <div>
                  <label className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5 block">
                    {t_courses('levelLabel')}
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {LEVELS.map((l) => (
                      <button
                        key={l.value}
                        onClick={() => setLevel(l.value)}
                        className={clsx(
                          'px-3 py-1 rounded-lg text-xs font-medium transition-colors',
                          level === l.value
                            ? 'bg-brand-navy text-white dark:bg-brand-gold dark:text-gray-900'
                            : 'bg-gray-100 dark:bg-gray-800 text-[var(--text-secondary)] hover:bg-gray-200 dark:hover:bg-gray-700',
                        )}
                      >
                        {l.i18nKey === 'allLevels' ? t_courses('allLevels') : t_levels(l.i18nKey)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Category */}
                {categories.length > 0 && (
                  <div>
                    <label className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5 block">
                      Catégorie
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        onClick={() => setCategory('')}
                        className={clsx(
                          'px-3 py-1 rounded-lg text-xs font-medium transition-colors',
                          !category
                            ? 'bg-brand-navy text-white dark:bg-brand-gold dark:text-gray-900'
                            : 'bg-gray-100 dark:bg-gray-800 text-[var(--text-secondary)] hover:bg-gray-200 dark:hover:bg-gray-700',
                        )}
                      >
                        Toutes
                      </button>
                      {categories.map((cat) => (
                        <button
                          key={cat.id}
                          onClick={() => setCategory(cat.id)}
                          className={clsx(
                            'px-3 py-1 rounded-lg text-xs font-medium transition-colors',
                            category === cat.id
                              ? 'text-white dark:text-gray-900'
                              : 'bg-gray-100 dark:bg-gray-800 text-[var(--text-secondary)] hover:bg-gray-200 dark:hover:bg-gray-700',
                          )}
                          style={category === cat.id ? { backgroundColor: cat.color || '#1A5632' } : undefined}
                        >
                          {t(cat.name, language)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Status */}
                <div>
                  <label className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5 block">
                    {t_courses('statusLabel')}
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {STATUS_FILTERS.map((s) => (
                      <button
                        key={s.value}
                        onClick={() => setStatus(s.value)}
                        className={clsx(
                          'px-3 py-1 rounded-lg text-xs font-medium transition-colors',
                          status === s.value
                            ? 'bg-brand-navy text-white dark:bg-brand-gold dark:text-gray-900'
                            : 'bg-gray-100 dark:bg-gray-800 text-[var(--text-secondary)] hover:bg-gray-200 dark:hover:bg-gray-700',
                        )}
                      >
                        {t_courses(s.i18nKey)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Result count */}
      <motion.p variants={fadeUp} className="text-sm text-[var(--text-secondary)]">
        {t_courses('coursesFound', { count: total })}
      </motion.p>

      {/* Course grid */}
      <motion.div variants={fadeUp}>
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl bg-white dark:bg-surface-dark-card border border-[var(--border)] overflow-hidden animate-pulse">
                <div className="h-40 bg-gray-100 dark:bg-gray-800" />
                <div className="p-4 space-y-3">
                  <div className="h-4 w-3/4 rounded bg-gray-100 dark:bg-gray-800" />
                  <div className="h-3 w-1/2 rounded bg-gray-50 dark:bg-gray-800/50" />
                  <div className="h-8 rounded-lg bg-gray-100 dark:bg-gray-800" />
                </div>
              </div>
            ))}
          </div>
        ) : displayed.length === 0 ? (
          <div className="text-center py-20">
            <BookOpen className="w-12 h-12 mx-auto text-[var(--text-secondary)] opacity-30 mb-3" />
            <p className="text-[var(--text-secondary)] font-medium">{t_courses('noCourses')}</p>
            <p className="text-xs text-[var(--text-secondary)] mt-1">{t_courses('noCoursesHint')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayed.map((course: any) => (
              <CourseCard
                key={course.id}
                course={course}
                enrollment={enrollMap[course.id]}
                lang={language}
                onEnroll={handleEnroll}
              />
            ))}
          </div>
        )}
      </motion.div>

      {/* Pagination */}
      {totalPages > 1 && (
        <motion.div variants={fadeUp} className="flex items-center justify-center gap-1.5 pt-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className={clsx(
              'p-2 rounded-lg transition-colors',
              page === 1
                ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                : 'text-[var(--text-secondary)] hover:bg-gray-100 dark:hover:bg-gray-800',
            )}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {paginationRange(page, totalPages).map((item, idx) =>
            item === '...' ? (
              <span key={`dot-${idx}`} className="w-9 h-9 flex items-center justify-center text-xs text-[var(--text-secondary)]">
                …
              </span>
            ) : (
              <button
                key={item}
                onClick={() => setPage(item as number)}
                className={clsx(
                  'w-9 h-9 rounded-lg text-sm font-medium transition-colors',
                  page === item
                    ? 'bg-brand-navy text-white dark:bg-brand-gold dark:text-gray-900'
                    : 'text-[var(--text-secondary)] hover:bg-gray-100 dark:hover:bg-gray-800',
                )}
              >
                {item}
              </button>
            ),
          )}

          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className={clsx(
              'p-2 rounded-lg transition-colors',
              page === totalPages
                ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                : 'text-[var(--text-secondary)] hover:bg-gray-100 dark:hover:bg-gray-800',
            )}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </motion.div>
      )}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Pagination helper — returns [1, '...', 4, 5, 6, '...', 10]
// ---------------------------------------------------------------------------

function paginationRange(current: number, total: number): (number | string)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const items: (number | string)[] = [];
  items.push(1);
  if (current > 3) items.push('...');
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) items.push(i);
  if (current < total - 2) items.push('...');
  items.push(total);
  return items;
}

// ---------------------------------------------------------------------------
// Course card
// ---------------------------------------------------------------------------

function CourseCard({
  course,
  enrollment,
  lang,
  onEnroll,
}: {
  course: any;
  enrollment: any;
  lang: string;
  onEnroll: (id: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const t_courses = useTranslations('courses');
  const t_levels = useTranslations('levels');
  const meta = LEVEL_META[course.level] ?? LEVEL_META.beginner;

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setBusy(true);
    await onEnroll(course.id);
    setBusy(false);
  };

  return (
    <Link href={`/courses/${course.id}`}>
      <div
        className={clsx(
          'card-hover rounded-xl overflow-hidden h-full flex flex-col',
          'bg-white dark:bg-surface-dark-card border border-[var(--border)]',
        )}
      >
        {/* Thumbnail */}
        <div className="relative h-40 bg-gradient-to-br from-brand-navy/5 to-brand-gold/5 dark:from-brand-navy/20 dark:to-brand-gold/10">
          {course.thumbnail_url && (
            <img src={course.thumbnail_url} alt="" className="w-full h-full object-cover" />
          )}
          <span
            className={clsx(
              'absolute top-3 left-3 px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide',
              meta.color,
            )}
          >
            {t_levels(course.level)}
          </span>
        </div>

        {/* Body */}
        <div className="p-4 flex-1 flex flex-col">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] line-clamp-2 mb-1">
            {t(course.title, lang)}
          </h3>
          <p className="text-xs text-[var(--text-secondary)] line-clamp-2 mb-3 flex-1">
            {t(course.description, lang)}
          </p>

          {/* Meta */}
          <div className="flex items-center gap-3 text-[10px] text-[var(--text-secondary)] mb-3">
            {course.estimated_hours != null && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {course.estimated_hours}h
              </span>
            )}
            {course.enrollment_count != null && (
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                {course.enrollment_count}
              </span>
            )}
          </div>

          {/* Action area */}
          {enrollment ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-brand-navy dark:bg-brand-gold transition-all"
                    style={{ width: `${Math.round(enrollment.progress_percent ?? 0)}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-[var(--text-secondary)]">
                  {Math.round(enrollment.progress_percent ?? 0)}%
                </span>
              </div>
              <span
                className={clsx(
                  'inline-block px-2 py-0.5 rounded text-[10px] font-medium',
                  enrollment.status === 'completed'
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-brand-navy/5 text-brand-navy dark:bg-brand-navy/20 dark:text-green-300',
                )}
              >
                {enrollment.status === 'completed' ? t_courses('completed') : t_courses('inProgress')}
              </span>
            </div>
          ) : (
            <button
              onClick={handleClick}
              disabled={busy}
              className={clsx(
                'w-full py-2 rounded-lg text-xs font-semibold transition-colors',
                'bg-brand-navy text-white hover:bg-brand-navy-deep',
                'dark:bg-brand-gold dark:text-gray-900 dark:hover:bg-brand-gold-dark',
                busy && 'opacity-60 cursor-not-allowed',
              )}
            >
              {busy ? (
                <span className="flex items-center justify-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin" /> {t_courses('enrolling')}
                </span>
              ) : (
                t_courses('enroll')
              )}
            </button>
          )}
        </div>
      </div>
    </Link>
  );
}
