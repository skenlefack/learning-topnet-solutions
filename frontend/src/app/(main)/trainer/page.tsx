'use client';
// ============================================================================
// AU-IBAR Learning — Trainer Dashboard
// Analytics scoped to courses created/taught by the logged-in trainer
// ============================================================================
import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  BookOpen, Users, TrendingUp, Award, ChevronDown, ChevronUp,
  Loader2, BarChart3, Clock, User,
} from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/lib/store';
import { trainerApi } from '@/lib/api';

function getLocalText(t: any, lang = 'fr') {
  if (!t) return '';
  if (typeof t === 'string') return t;
  return t[lang] || t.fr || t.en || '';
}

const LEVEL_COLORS: Record<string, string> = {
  beginner: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  intermediate: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  advanced: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  expert: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
};

export default function TrainerDashboard() {
  const { token } = useAuth();
  const language = useAuthStore((s) => s.language);
  const user = useAuthStore((s) => s.user);

  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<Record<string, any>>({});
  const [loadingAnalytics, setLoadingAnalytics] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    trainerApi.myCourses(token)
      .then((res: any) => setCourses(res.data || []))
      .catch(() => setCourses([]))
      .finally(() => setLoading(false));
  }, [token]);

  const toggleCourse = useCallback(async (courseId: string) => {
    if (expandedCourse === courseId) { setExpandedCourse(null); return; }
    setExpandedCourse(courseId);
    if (analytics[courseId] || !token) return;

    setLoadingAnalytics(courseId);
    try {
      const res: any = await trainerApi.courseAnalytics(token, courseId);
      setAnalytics(prev => ({ ...prev, [courseId]: res.data }));
    } catch {}
    finally { setLoadingAnalytics(null); }
  }, [token, expandedCourse, analytics]);

  // Aggregate stats
  const totalEnrolled = courses.reduce((s, c) => s + (c.enrollment_count || 0), 0);
  const totalCompleted = courses.reduce((s, c) => s + (c.completed_count || 0), 0);
  const avgProgress = courses.length > 0
    ? Math.round(courses.reduce((s, c) => s + (c.avg_progress || 0), 0) / courses.length) : 0;

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-brand-navy" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 max-w-5xl mx-auto"
    >
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-brand-navy dark:text-brand-gold" />
          Tableau de bord formateur
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Suivi de vos cours et de la progression de vos apprenants
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={BookOpen} label="Mes cours" value={courses.length} color="#1A5632" />
        <StatCard icon={Users} label="Apprenants inscrits" value={totalEnrolled} color="#B8952E" />
        <StatCard icon={Award} label="Cours complétés" value={totalCompleted} color="#930e2d" />
        <StatCard icon={TrendingUp} label="Progression moy." value={`${avgProgress}%`} color="#0e591a" />
      </div>

      {/* Courses list */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
          Vos cours ({courses.length})
        </h2>

        {courses.length === 0 ? (
          <div className="text-center py-12 text-sm text-[var(--text-secondary)]">
            Vous n'avez créé aucun cours pour le moment.
          </div>
        ) : (
          courses.map(course => {
            const isExpanded = expandedCourse === course.id;
            const data = analytics[course.id];

            return (
              <div key={course.id} className="rounded-xl border border-[var(--border)] bg-white dark:bg-surface-dark-card overflow-hidden">
                {/* Course header */}
                <button
                  onClick={() => toggleCourse(course.id)}
                  className="w-full flex items-center gap-4 p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={clsx('px-2 py-0.5 rounded text-[10px] font-medium', LEVEL_COLORS[course.level] || LEVEL_COLORS.beginner)}>
                        {course.level}
                      </span>
                      <span className={clsx('px-2 py-0.5 rounded text-[10px] font-medium',
                        course.status === 'published' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600',
                      )}>
                        {course.status}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                      {getLocalText(course.title, language)}
                    </p>
                  </div>
                  <div className="flex items-center gap-6 text-xs text-[var(--text-secondary)] shrink-0">
                    <div className="text-center">
                      <div className="text-lg font-bold text-[var(--text-primary)]">{course.enrollment_count}</div>
                      <div>inscrits</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-emerald-600">{course.avg_progress}%</div>
                      <div>progression</div>
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-[var(--text-secondary)]" /> : <ChevronDown className="w-4 h-4 text-[var(--text-secondary)]" />}
                </button>

                {/* Expanded analytics */}
                {isExpanded && (
                  <div className="border-t border-[var(--border)] p-4">
                    {loadingAnalytics === course.id ? (
                      <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-brand-navy" /></div>
                    ) : data ? (
                      <div className="space-y-4">
                        {/* Funnel */}
                        <div className="grid grid-cols-3 gap-3">
                          <div className="text-center p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                            <div className="text-xl font-bold text-blue-600">{data.funnel.total}</div>
                            <div className="text-[10px] text-blue-500">Inscrits</div>
                          </div>
                          <div className="text-center p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20">
                            <div className="text-xl font-bold text-amber-600">{data.funnel.inProgress}</div>
                            <div className="text-[10px] text-amber-500">En cours</div>
                          </div>
                          <div className="text-center p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
                            <div className="text-xl font-bold text-emerald-600">{data.funnel.completed}</div>
                            <div className="text-[10px] text-emerald-500">Complétés</div>
                          </div>
                        </div>

                        {/* Module rates */}
                        {data.moduleRates?.length > 0 && (
                          <div>
                            <h4 className="text-xs font-semibold text-[var(--text-secondary)] uppercase mb-2">Complétion par module</h4>
                            <div className="space-y-1.5">
                              {data.moduleRates.map((m: any) => (
                                <div key={m.id} className="flex items-center gap-3 text-xs">
                                  <span className="w-5 text-right text-[var(--text-secondary)] font-mono">{m.sort_order}</span>
                                  <span className="flex-1 truncate text-[var(--text-primary)]">{getLocalText(m.title, language)}</span>
                                  <span className="text-[var(--text-secondary)]">{m.completed_users} / {m.lesson_count || '?'}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Recent enrollments */}
                        {data.recentEnrollments?.length > 0 && (
                          <div>
                            <h4 className="text-xs font-semibold text-[var(--text-secondary)] uppercase mb-2">Dernières inscriptions</h4>
                            <div className="space-y-1">
                              {data.recentEnrollments.slice(0, 5).map((e: any, i: number) => (
                                <div key={i} className="flex items-center gap-2 text-xs">
                                  <User className="w-3 h-3 text-[var(--text-secondary)]" />
                                  <span className="flex-1 text-[var(--text-primary)]">{e.first_name} {e.last_name}</span>
                                  <span className="text-[var(--text-secondary)]">{Math.round(e.progress_percent || 0)}%</span>
                                  <span className={clsx('px-1.5 py-0.5 rounded text-[10px]',
                                    e.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700',
                                  )}>{e.status}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-[var(--text-secondary)] text-center py-4">Pas de données</p>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </motion.div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: typeof BookOpen; label: string; value: number | string; color: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-white dark:bg-surface-dark-card p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-[var(--text-secondary)]">{label}</span>
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <div className="text-2xl font-bold text-[var(--text-primary)]">{value}</div>
    </div>
  );
}
