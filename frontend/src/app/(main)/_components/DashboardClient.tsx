'use client';
// ============================================================================
// Topnet Solutions Academy — Dashboard Client Orchestrator
// SWR data fetching, framer-motion stagger, skeleton fallbacks
// ============================================================================
import useSWR from 'swr';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/lib/store';
import { learningApi, courseApi, liveApi, assessmentApi, pathApi } from '@/lib/api';

import Link from 'next/link';
import toast from 'react-hot-toast';
import { Calendar, Clock, Video, Route, BookOpen, ArrowRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import SectionErrorBoundary from '@/app/_components/SectionErrorBoundary';
import HeroBanner from './HeroBanner';
import StatsGrid from './StatsGrid';
import CourseGrid from './CourseGrid';
import LivePanel from './LivePanel';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getLocalText(text: any, lang = 'fr'): string {
  if (!text) return '';
  if (typeof text === 'string') return text;
  return text[lang] || text.fr || text.en || '';
}

// ---------------------------------------------------------------------------
// Planning Panel — upcoming events (live sessions + deadlines)
// ---------------------------------------------------------------------------

function PlanningPanel({ liveSessions, enrollments }: { liveSessions: any[]; enrollments: any[] }) {
  const upcoming = liveSessions
    .filter((s: any) => s.status === 'scheduled' && new Date(s.scheduled_at) > new Date())
    .sort((a: any, b: any) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
    .slice(0, 4);

  if (upcoming.length === 0) return null;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-white dark:bg-surface-dark-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Calendar className="w-4 h-4 text-brand-navy dark:text-brand-gold" />
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Planning</h3>
      </div>
      <div className="space-y-2">
        {upcoming.map((s: any) => {
          const date = new Date(s.scheduled_at);
          const isToday = date.toDateString() === new Date().toDateString();
          return (
            <Link key={s.id} href="/live" className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
              <div className="text-center shrink-0 w-10">
                <div className="text-[10px] font-bold uppercase text-[var(--text-secondary)]">
                  {date.toLocaleDateString('fr-FR', { weekday: 'short' })}
                </div>
                <div className={`text-lg font-bold ${isToday ? 'text-brand-navy dark:text-brand-gold' : 'text-[var(--text-primary)]'}`}>
                  {date.getDate()}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-[var(--text-primary)] truncate">
                  {getLocalText(s.title)}
                </p>
                <p className="text-[10px] text-[var(--text-secondary)] flex items-center gap-1 mt-0.5">
                  <Clock className="w-3 h-3" />
                  {date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  {s.duration_minutes && ` (${s.duration_minutes}min)`}
                </p>
              </div>
              <Video className="w-3.5 h-3.5 text-[var(--text-secondary)] shrink-0 mt-1" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Learning Paths Section
// ---------------------------------------------------------------------------

function PathsSection({ paths }: { paths: any[] }) {
  const { token } = useAuthStore();
  const t = useTranslations('dashboard');

  const handleEnroll = async (pathId: string) => {
    if (!token) return;
    try {
      await pathApi.enroll(token, pathId);
      toast.success(t('enrolledPath'));
    } catch (err: any) {
      toast.error(err.message || t('error'));
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <Route className="w-5 h-5 text-brand-navy dark:text-brand-gold" />
          {t('pathsTitle')}
        </h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {paths.map((path: any) => (
          <div key={path.id} className="rounded-xl border border-[var(--border)] bg-white dark:bg-surface-dark-card p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-brand-navy/10 dark:bg-brand-gold/20 flex items-center justify-center shrink-0">
                <Route className="w-5 h-5 text-brand-navy dark:text-brand-gold" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-[var(--text-primary)] truncate">
                  {getLocalText(path.title)}
                </h3>
                {path.description && (
                  <p className="text-xs text-[var(--text-secondary)] line-clamp-2 mt-1">
                    {getLocalText(path.description)}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-2 text-[10px] text-[var(--text-secondary)]">
                  <span className="flex items-center gap-1">
                    <BookOpen className="w-3 h-3" /> {t('pathCourses', { count: path.course_count || 0 })}
                  </span>
                  {path.estimated_hours && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {path.estimated_hours}h
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={() => handleEnroll(path.id)}
              className="mt-3 w-full py-2 rounded-lg text-xs font-semibold bg-brand-navy text-white hover:bg-brand-navy-deep dark:bg-brand-gold dark:text-gray-900 dark:hover:bg-brand-gold-dark transition-colors flex items-center justify-center gap-1"
            >
              {t('enrollPath')} <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
import CertificationPanel from './CertificationPanel';

// ---------------------------------------------------------------------------
// Animation variants (staggered entrance)
// ---------------------------------------------------------------------------

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' } },
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DashboardClientProps {
  initialDashboard?: any;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DashboardClient({ initialDashboard }: DashboardClientProps) {
  const { token, user } = useAuthStore();

  // -- SWR fetchers (skip when unauthenticated) --
  const { data: enrollmentsRes, isLoading: enrollLoading } = useSWR(
    token ? ['enrollments', token] : null,
    ([, t]) => learningApi.enrollments(t),
    { fallbackData: initialDashboard ? { success: true, data: initialDashboard.enrollments } : undefined },
  );

  const { data: coursesRes, isLoading: coursesLoading } = useSWR(
    token ? ['courses', token] : null,
    ([, t]) => courseApi.list(t),
  );

  const { data: liveRes, isLoading: liveLoading } = useSWR(
    token ? ['live-sessions', token] : null,
    ([, t]) => liveApi.sessions(t),
    { revalidateOnFocus: true, refreshInterval: 30_000 },
  );

  const { data: certsRes, isLoading: certsLoading } = useSWR(
    token ? ['certifications', token] : null,
    ([, t]) => assessmentApi.certifications(t),
  );

  const { data: pathsRes } = useSWR(
    token ? ['paths-public'] : null,
    () => pathApi.listPublic(),
  );

  // -- Unwrap API responses --
  const enrollments: any[] = (enrollmentsRes as any)?.data ?? [];
  const courses: any[] = (coursesRes as any)?.data ?? [];
  const liveSessions: any[] = (liveRes as any)?.data ?? [];
  const certifications: any[] = (certsRes as any)?.data ?? [];
  const paths: any[] = (pathsRes as any)?.data ?? [];

  // -- Current enrollment (most recent active) --
  const currentEnrollment = enrollments.find((e: any) => e.status === 'active') ?? enrollments[0];

  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="show"
      className="space-y-6 max-w-7xl mx-auto"
    >
      {/* Hero */}
      <motion.div variants={fadeUp}>
        <SectionErrorBoundary name="Bannière">
          <HeroBanner
            user={user}
            enrollment={currentEnrollment}
            isLoading={enrollLoading}
          />
        </SectionErrorBoundary>
      </motion.div>

      {/* Stats */}
      <motion.div variants={fadeUp}>
        <SectionErrorBoundary name="Statistiques">
          <StatsGrid
            enrollments={enrollments}
            courses={courses}
            certifications={certifications}
            isLoading={enrollLoading || coursesLoading}
          />
        </SectionErrorBoundary>
      </motion.div>

      {/* Two-column layout: courses + side panels */}
      <motion.div variants={fadeUp} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Courses — 2/3 width */}
        <div className="lg:col-span-2">
          <SectionErrorBoundary name="Cours">
            <CourseGrid
              courses={courses}
              enrollments={enrollments}
              isLoading={coursesLoading}
            />
          </SectionErrorBoundary>
        </div>

        {/* Side panels — 1/3 width */}
        <div className="space-y-6">
          {/* Planning */}
          <SectionErrorBoundary name="Planning">
            <PlanningPanel
              liveSessions={liveSessions}
              enrollments={enrollments}
            />
          </SectionErrorBoundary>
          <SectionErrorBoundary name="Sessions live">
            <LivePanel sessions={liveSessions} isLoading={liveLoading} />
          </SectionErrorBoundary>
          <SectionErrorBoundary name="Certifications">
            <CertificationPanel
              certifications={certifications}
              enrollments={enrollments}
              isLoading={certsLoading}
            />
          </SectionErrorBoundary>
        </div>
      </motion.div>

      {/* Learning Paths */}
      {paths.length > 0 && (
        <motion.div variants={fadeUp}>
          <SectionErrorBoundary name="Parcours">
            <PathsSection paths={paths} />
          </SectionErrorBoundary>
        </motion.div>
      )}
    </motion.div>
  );
}
