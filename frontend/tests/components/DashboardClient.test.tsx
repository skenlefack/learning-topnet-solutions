// ============================================================================
// ARIS Academy — Component Test: DashboardClient
// SWR orchestrator rendering sub-panels
// ============================================================================
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import DashboardClient from '@/app/(main)/_components/DashboardClient';

// Mock store
vi.mock('@/lib/store', () => ({
  useAuthStore: () => ({
    token: 'test-token',
    user: { firstName: 'Amina', lastName: 'Wanjiku', role: 'learner' },
    language: 'fr',
  }),
}));

// Mock SWR to return controlled data
vi.mock('swr', () => ({
  default: (key: any) => {
    if (!key) return { data: undefined, isLoading: false };
    const topic = Array.isArray(key) ? key[0] : key;
    const responses: Record<string, any> = {
      enrollments: { data: [{ id: 'e1', status: 'active', courseId: 'c1', progress: 45, course_title: { fr: 'Surveillance' } }] },
      courses: { data: [{ id: 'c1', title: { fr: 'Surveillance épidémiologique' }, level: 'beginner', status: 'published' }] },
      'live-sessions': { data: [{ id: 'ls1', title: { fr: 'Session Live' }, status: 'scheduled', scheduled_at: '2026-06-01T10:00:00Z' }] },
      certifications: { data: [{ level: 'foundation', status: 'issued', issuedAt: '2025-12-01' }] },
    };
    return { data: responses[topic], isLoading: false };
  },
}));

// Mock sub-components to isolate DashboardClient logic
vi.mock('@/app/(main)/_components/HeroBanner', () => ({
  default: ({ user, enrollment }: any) => (
    <div data-testid="hero-banner">
      {user?.firstName} - {enrollment?.status || 'none'}
    </div>
  ),
}));

vi.mock('@/app/(main)/_components/StatsGrid', () => ({
  default: ({ enrollments, courses }: any) => (
    <div data-testid="stats-grid">
      {enrollments?.length} enrollments, {courses?.length} courses
    </div>
  ),
}));

vi.mock('@/app/(main)/_components/CourseGrid', () => ({
  default: ({ courses }: any) => (
    <div data-testid="course-grid">{courses?.length} courses</div>
  ),
}));

vi.mock('@/app/(main)/_components/LivePanel', () => ({
  default: ({ sessions }: any) => (
    <div data-testid="live-panel">{sessions?.length} sessions</div>
  ),
}));

vi.mock('@/app/(main)/_components/CertificationPanel', () => ({
  default: ({ certifications }: any) => (
    <div data-testid="cert-panel">{certifications?.length} certs</div>
  ),
}));

vi.mock('@/app/_components/SectionErrorBoundary', () => ({
  default: ({ children }: any) => <div>{children}</div>,
}));

describe('DashboardClient', () => {
  it('renders HeroBanner with user and enrollment data', () => {
    render(<DashboardClient />);
    expect(screen.getByTestId('hero-banner')).toHaveTextContent('Amina - active');
  });

  it('renders StatsGrid with correct counts', () => {
    render(<DashboardClient />);
    expect(screen.getByTestId('stats-grid')).toHaveTextContent('1 enrollments, 1 courses');
  });

  it('renders CourseGrid with courses', () => {
    render(<DashboardClient />);
    expect(screen.getByTestId('course-grid')).toHaveTextContent('1 courses');
  });

  it('renders LivePanel with sessions', () => {
    render(<DashboardClient />);
    expect(screen.getByTestId('live-panel')).toHaveTextContent('1 sessions');
  });

  it('renders CertificationPanel with certs', () => {
    render(<DashboardClient />);
    expect(screen.getByTestId('cert-panel')).toHaveTextContent('1 certs');
  });

  it('renders three-column layout on desktop', () => {
    const { container } = render(<DashboardClient />);
    const grid = container.querySelector('.grid.grid-cols-1.lg\\:grid-cols-3');
    expect(grid).toBeInTheDocument();
  });

  it('passes current active enrollment to HeroBanner', () => {
    render(<DashboardClient />);
    // The first active enrollment is passed
    expect(screen.getByTestId('hero-banner')).toHaveTextContent('active');
  });
});
