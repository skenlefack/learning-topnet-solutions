'use client';
// ============================================================================
// AU-IBAR Learning — My Courses
// Shows only courses where the user is enrolled, with progress tracking
// ============================================================================
import { useState, useMemo } from 'react';
import useSWR from 'swr';
import { motion } from 'framer-motion';
import {
  Search, BookOpen, Clock, Users, Loader2, Play, CheckCircle2,
  GraduationCap, ArrowRight,
} from 'lucide-react';
import clsx from 'clsx';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/lib/store';
import { learningApi, courseApi } from '@/lib/api';
import { t as tl, LEVEL_META } from '@/lib/utils';

const stagger = { visible: { transition: { staggerChildren: 0.07 } } };
const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};

const STATUS_TABS = [
  { value: '', label: 'Tous' },
  { value: 'active', label: 'En cours' },
  { value: 'completed', label: 'Terminés' },
];

export default function MyCoursesPage() {
  const { token } = useAuth();
  const language = useAuthStore((s) => s.language);
  const t_courses = useTranslations('courses');
  const t_levels = useTranslations('levels');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Fetch enrollments
  const { data: enrollRes, isLoading } = useSWR(
    token ? ['my-enrollments'] : null,
    () => learningApi.enrollments(token!),
  );

  const enrollments: any[] = useMemo(() => {
    const raw = (enrollRes as any)?.data ?? enrollRes ?? [];
    return Array.isArray(raw) ? raw : [];
  }, [enrollRes]);

  // Filter
  const displayed = useMemo(() => {
    let list = enrollments;
    if (statusFilter) {
      list = list.filter(e => e.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(e => {
        const title = tl(e.course_title || e.title, language).toLowerCase();
        return title.includes(q);
      });
    }
    return list;
  }, [enrollments, statusFilter, search, language]);

  return (
    <motion.div initial="hidden" animate="visible" variants={stagger} className="space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <motion.div variants={fadeUp} className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">{t_courses('myCoursesTitle') || 'Mes cours'}</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            {enrollments.length > 0
              ? `${enrollments.length} cours en cours de formation`
              : 'Vous n\'êtes inscrit à aucun cours pour le moment.'
            }
          </p>
        </div>
        <Link
          href="/catalog"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-brand-navy text-white hover:bg-brand-navy-deep dark:bg-brand-gold dark:text-gray-900 dark:hover:bg-brand-gold-dark transition-colors"
        >
          <GraduationCap className="w-4 h-4" />
          Parcourir le catalogue
        </Link>
      </motion.div>

      {/* Filters */}
      <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher dans mes cours..."
            className={clsx(
              'w-full pl-10 pr-4 py-2.5 rounded-xl text-sm',
              'bg-white dark:bg-surface-dark-card border border-[var(--border)]',
              'text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]',
              'focus:outline-none focus:ring-2 focus:ring-brand-navy/20',
            )}
          />
        </div>
        <div className="flex gap-1.5">
          {STATUS_TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={clsx(
                'px-4 py-2 rounded-xl text-sm font-medium transition-colors',
                statusFilter === tab.value
                  ? 'bg-brand-navy text-white dark:bg-brand-gold dark:text-gray-900'
                  : 'bg-white dark:bg-surface-dark-card border border-[var(--border)] text-[var(--text-secondary)] hover:bg-gray-50 dark:hover:bg-gray-800',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-brand-navy dark:text-brand-gold" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && displayed.length === 0 && (
        <motion.div variants={fadeUp} className="text-center py-16">
          <BookOpen className="w-14 h-14 mx-auto text-[var(--text-secondary)] opacity-20 mb-4" />
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
            {enrollments.length === 0 ? 'Aucun cours en cours' : 'Aucun résultat'}
          </h3>
          <p className="text-sm text-[var(--text-secondary)] mb-6 max-w-md mx-auto">
            {enrollments.length === 0
              ? 'Explorez notre catalogue et inscrivez-vous à votre premier cours.'
              : 'Essayez de modifier vos filtres de recherche.'
            }
          </p>
          {enrollments.length === 0 && (
            <Link
              href="/catalog"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium bg-brand-navy text-white hover:bg-brand-navy-deep dark:bg-brand-gold dark:text-gray-900"
            >
              <GraduationCap className="w-4 h-4" />
              Découvrir les cours
            </Link>
          )}
        </motion.div>
      )}

      {/* Course cards */}
      {!isLoading && displayed.length > 0 && (
        <motion.div variants={fadeUp} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayed.map((enr: any) => {
            const progress = enr.progress_percent ?? 0;
            const isCompleted = enr.status === 'completed';
            const levelMeta = LEVEL_META[enr.course_level || enr.level] || LEVEL_META.beginner;
            const title = tl(enr.course_title || enr.title, language);
            const courseId = enr.course_id;

            return (
              <Link key={enr.id} href={`/courses/${courseId}`}>
                <div className={clsx(
                  'rounded-2xl overflow-hidden bg-white dark:bg-surface-dark-card border border-[var(--border)]',
                  'hover:shadow-lg hover:-translate-y-1 transition-all duration-200 cursor-pointer',
                )}>
                  {/* Header gradient */}
                  <div className="h-28 relative" style={{ background: `linear-gradient(135deg, ${levelMeta.color}18, ${levelMeta.color}08)` }}>
                    <div className="absolute top-3 left-3">
                      <span className="px-2.5 py-1 rounded-lg text-[10px] font-semibold text-white" style={{ backgroundColor: levelMeta.color }}>
                        {t_levels(enr.course_level || enr.level || 'beginner')}
                      </span>
                    </div>
                    {isCompleted && (
                      <div className="absolute top-3 right-3">
                        <CheckCircle2 className="w-6 h-6 text-green-500" />
                      </div>
                    )}
                    <div className="absolute bottom-3 right-3 flex items-center gap-1 text-xs text-[var(--text-secondary)] bg-white/80 dark:bg-gray-900/80 px-2 py-1 rounded-lg">
                      <Clock className="w-3 h-3" />
                      {enr.estimated_hours || '—'}h
                    </div>
                  </div>

                  {/* Body */}
                  <div className="p-4">
                    <h3 className="text-sm font-semibold text-[var(--text-primary)] line-clamp-2 mb-3">{title}</h3>

                    {/* Progress bar */}
                    <div className="mb-2">
                      <div className="flex items-center justify-between text-[10px] mb-1">
                        <span className="text-[var(--text-secondary)]">Progression</span>
                        <span className="font-semibold" style={{ color: levelMeta.color }}>{Math.round(progress)}%</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${progress}%`, backgroundColor: levelMeta.color }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-3">
                      <span className="text-[10px] text-[var(--text-secondary)]">
                        {isCompleted ? 'Terminé' : 'En cours'}
                      </span>
                      <span className="flex items-center gap-1 text-xs font-medium text-brand-navy dark:text-brand-gold">
                        {isCompleted ? 'Revoir' : 'Continuer'} <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </motion.div>
      )}
    </motion.div>
  );
}
