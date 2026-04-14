'use client';
// ============================================================================
// AU-IBAR Learning — Dashboard Client Orchestrator
// SWR data fetching, framer-motion stagger, skeleton fallbacks
// ============================================================================
import useSWR from 'swr';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/lib/store';
import { learningApi, courseApi, liveApi, assessmentApi } from '@/lib/api';

import SectionErrorBoundary from '@/app/_components/SectionErrorBoundary';
import HeroBanner from './HeroBanner';
import StatsGrid from './StatsGrid';
import CourseGrid from './CourseGrid';
import LivePanel from './LivePanel';
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

  // -- Unwrap API responses --
  const enrollments: any[] = (enrollmentsRes as any)?.data ?? [];
  const courses: any[] = (coursesRes as any)?.data ?? [];
  const liveSessions: any[] = (liveRes as any)?.data ?? [];
  const certifications: any[] = (certsRes as any)?.data ?? [];

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
    </motion.div>
  );
}
