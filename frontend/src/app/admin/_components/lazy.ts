import dynamic from 'next/dynamic';

// ---------------------------------------------------------------------------
// Lazy-loaded admin modals and heavy components.
// These are only loaded when the user actually opens them, reducing the
// initial bundle size of the admin dashboard.
// SSR is disabled because modals are client-only interactive components.
// ---------------------------------------------------------------------------

export const CourseFormModal = dynamic(
  () => import('./CourseFormModal'),
  { ssr: false }
);

export const UserFormModal = dynamic(
  () => import('./UserFormModal'),
  { ssr: false }
);

export const BulkUserImportModal = dynamic(
  () => import('./BulkUserImportModal'),
  { ssr: false }
);

export const PlanSessionModal = dynamic(
  () => import('./PlanSessionModal'),
  { ssr: false }
);

export const CourseAnalytics = dynamic(
  () => import('./CourseAnalytics'),
  { ssr: false }
);

export const CategoryManager = dynamic(
  () => import('./CategoryManager'),
  { ssr: false }
);

export const PathManager = dynamic(
  () => import('./PathManager'),
  { ssr: false }
);

export const QuizBuilder = dynamic(
  () => import('./QuizBuilder'),
  { ssr: false }
);
