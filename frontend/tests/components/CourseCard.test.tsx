// ============================================================================
// Topnet Solutions Academy — Component Test: CourseCard (within CourseGrid)
// Rendering, props, hover state, edge cases
// ============================================================================
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CourseGrid from '@/app/(main)/_components/CourseGrid';
import { mockCourses, mockEnrollments } from '../mocks/data';

// CourseGrid renders CourseCard internally, so we test via the parent

describe('CourseGrid / CourseCard', () => {
  // ---- Rendering ----

  it('renders enrolled courses section', () => {
    render(
      <CourseGrid
        courses={mockCourses}
        enrollments={mockEnrollments}
        isLoading={false}
      />,
    );
    expect(screen.getByText('Mes cours')).toBeInTheDocument();
  });

  it('renders course titles from i18n object (fr)', () => {
    render(
      <CourseGrid
        courses={mockCourses}
        enrollments={mockEnrollments}
        isLoading={false}
      />,
    );
    // Course title should be rendered (fr version from object)
    expect(screen.getByText('Introduction à ARIS 3.0')).toBeInTheDocument();
  });

  it('renders course title from plain string', () => {
    const plainCourses = [
      { ...mockCourses[0], title: 'Plain String Title', description: 'desc' },
    ];
    render(
      <CourseGrid courses={plainCourses} enrollments={[]} isLoading={false} />,
    );
    expect(screen.getByText('Plain String Title')).toBeInTheDocument();
  });

  it('shows progress bar for enrolled courses', () => {
    render(
      <CourseGrid
        courses={mockCourses}
        enrollments={mockEnrollments}
        isLoading={false}
      />,
    );
    // Progress bar should have width style
    const progressBars = document.querySelectorAll('[style*="width"]');
    expect(progressBars.length).toBeGreaterThan(0);
  });

  it('shows "Voir tout" link', () => {
    render(
      <CourseGrid
        courses={mockCourses}
        enrollments={mockEnrollments}
        isLoading={false}
      />,
    );
    expect(screen.getByText('Voir tout')).toBeInTheDocument();
  });

  it('shows level badge on course cards', () => {
    render(
      <CourseGrid
        courses={mockCourses}
        enrollments={[]}
        isLoading={false}
      />,
    );
    // At least one level badge should be visible
    const badges = screen.getAllByText(/beginner|intermediate|expert/i);
    expect(badges.length).toBeGreaterThan(0);
  });

  it('shows module count on course cards', () => {
    render(
      <CourseGrid
        courses={mockCourses}
        enrollments={[]}
        isLoading={false}
      />,
    );
    const modules = screen.getAllByText(/modules/i);
    expect(modules.length).toBeGreaterThan(0);
  });

  // ---- Enrolled vs Available separation ----

  it('separates enrolled and available courses', () => {
    render(
      <CourseGrid
        courses={mockCourses}
        enrollments={[mockEnrollments[0]]}
        isLoading={false}
      />,
    );
    // Should show "Cours disponibles" for non-enrolled
    expect(screen.getByText('Cours disponibles')).toBeInTheDocument();
  });

  // ---- Loading state ----

  it('renders skeleton placeholders during loading', () => {
    const { container } = render(
      <CourseGrid courses={[]} enrollments={[]} isLoading={true} />,
    );
    // Should render animated pulse skeletons
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  // ---- Empty state ----

  it('shows empty message when no courses available', () => {
    render(
      <CourseGrid courses={[]} enrollments={[]} isLoading={false} />,
    );
    expect(screen.getByText(/Aucun cours disponible/)).toBeInTheDocument();
  });

  // ---- Edge cases ----

  it('handles course with missing title gracefully', () => {
    const courses = [{ ...mockCourses[0], title: null, id: 'no-title' }];
    render(
      <CourseGrid courses={courses} enrollments={[]} isLoading={false} />,
    );
    // Should render "Sans titre" or empty string without crashing
    expect(screen.getByText('Sans titre')).toBeInTheDocument();
  });

  it('handles course with missing description', () => {
    const courses = [
      { ...mockCourses[0], id: 'no-desc', description: null },
    ];
    render(
      <CourseGrid courses={courses} enrollments={[]} isLoading={false} />,
    );
    // Should not crash
    expect(screen.getByText('Mes cours')).toBeInTheDocument();
  });

  it('clamps progress bar at 100%', () => {
    const enrollment = { ...mockEnrollments[0], progress: 150 };
    render(
      <CourseGrid
        courses={mockCourses}
        enrollments={[enrollment]}
        isLoading={false}
      />,
    );
    // Progress bar width should be capped
    const bar = document.querySelector('[style*="width: 100%"]');
    expect(bar).toBeTruthy();
  });

  it('shows "En cours" label for enrolled courses', () => {
    render(
      <CourseGrid
        courses={mockCourses}
        enrollments={mockEnrollments}
        isLoading={false}
      />,
    );
    const labels = screen.getAllByText('En cours');
    expect(labels.length).toBeGreaterThan(0);
  });
});
