// ============================================================================
// ARIS Academy — Component Test: StatsGrid
// Rendering, stat counts, loading state, edge cases
// ============================================================================
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StatsGrid from '@/app/(main)/_components/StatsGrid';
import { mockCourses, mockEnrollments, mockCertifications } from '../mocks/data';

describe('StatsGrid', () => {
  // ---- Rendering ----

  it('renders 4 stat card labels', () => {
    render(
      <StatsGrid
        enrollments={mockEnrollments}
        courses={mockCourses}
        certifications={mockCertifications}
        isLoading={false}
      />,
    );
    expect(screen.getByText('Cours inscrits')).toBeInTheDocument();
    expect(screen.getByText('Cours disponibles')).toBeInTheDocument();
    expect(screen.getByText('Certifications')).toBeInTheDocument();
    expect(screen.getByText('Pays connect\u00e9s')).toBeInTheDocument();
  });

  // ---- Correct counts ----

  it('shows correct enrolled count (active enrollments)', async () => {
    render(
      <StatsGrid
        enrollments={mockEnrollments}
        courses={mockCourses}
        certifications={mockCertifications}
        isLoading={false}
      />,
    );
    // mockEnrollments has 2 active enrollments. The count-up animation runs
    // asynchronously (RAF mocked as setTimeout 0), so use findByText to wait.
    const activeCount = mockEnrollments.filter((e) => e.status === 'active').length;
    expect(activeCount).toBe(2);
    expect(await screen.findByText('2')).toBeInTheDocument();
  });

  it('shows correct available courses count', async () => {
    render(
      <StatsGrid
        enrollments={mockEnrollments}
        courses={mockCourses}
        certifications={mockCertifications}
        isLoading={false}
      />,
    );
    // mockCourses has 3 courses
    expect(await screen.findByText('3')).toBeInTheDocument();
  });

  it('shows correct certifications count', async () => {
    render(
      <StatsGrid
        enrollments={mockEnrollments}
        courses={mockCourses}
        certifications={mockCertifications}
        isLoading={false}
      />,
    );
    // mockCertifications has 1 issued certification
    const issuedCount = mockCertifications.filter((c) => c.status === 'issued').length;
    expect(issuedCount).toBe(1);
    expect(await screen.findByText('1')).toBeInTheDocument();
  });

  // ---- Loading state ----

  it('renders skeleton placeholders during loading', () => {
    const { container } = render(
      <StatsGrid
        enrollments={[]}
        courses={[]}
        certifications={[]}
        isLoading={true}
      />,
    );
    // Should render animated pulse skeletons
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  // ---- Empty state ----

  it('handles empty arrays gracefully', () => {
    render(
      <StatsGrid
        enrollments={[]}
        courses={[]}
        certifications={[]}
        isLoading={false}
      />,
    );
    // Should still render all 4 labels without crashing
    expect(screen.getByText('Cours inscrits')).toBeInTheDocument();
    expect(screen.getByText('Cours disponibles')).toBeInTheDocument();
    expect(screen.getByText('Certifications')).toBeInTheDocument();
    expect(screen.getByText('Pays connect\u00e9s')).toBeInTheDocument();
  });
});
