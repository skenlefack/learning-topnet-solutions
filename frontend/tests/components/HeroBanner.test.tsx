// ============================================================================
// Topnet Solutions Academy — Component Test: HeroBanner
// Welcome message, enrollment info, resume button, loading, edge cases
// ============================================================================
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import HeroBanner from '@/app/(main)/_components/HeroBanner';
import { mockUser, mockEnrollments } from '../mocks/data';

describe('HeroBanner', () => {
  // ---- Rendering ----

  it('renders welcome message with user name', () => {
    render(
      <HeroBanner
        user={mockUser}
        enrollment={mockEnrollments[0]}
        isLoading={false}
      />,
    );
    expect(screen.getByText('Bienvenue, Amina')).toBeInTheDocument();
  });

  it('shows "Continuez votre parcours" heading', () => {
    render(
      <HeroBanner
        user={mockUser}
        enrollment={mockEnrollments[0]}
        isLoading={false}
      />,
    );
    expect(
      screen.getByText('Continuez votre parcours de certification'),
    ).toBeInTheDocument();
  });

  it('shows enrollment course name', () => {
    render(
      <HeroBanner
        user={mockUser}
        enrollment={mockEnrollments[0]}
        isLoading={false}
      />,
    );
    // mockEnrollments[0].courseName is 'Introduction \u00e0 ARIS 3.0'
    expect(screen.getByText('Introduction \u00e0 ARIS 3.0')).toBeInTheDocument();
  });

  // ---- Resume button ----

  it('shows "Reprendre le cours" button when enrolled', () => {
    render(
      <HeroBanner
        user={mockUser}
        enrollment={mockEnrollments[0]}
        isLoading={false}
      />,
    );
    expect(screen.getByText('Reprendre le cours')).toBeInTheDocument();
  });

  it('does NOT show "Reprendre le cours" when no enrollment', () => {
    render(
      <HeroBanner
        user={mockUser}
        enrollment={null}
        isLoading={false}
      />,
    );
    expect(screen.queryByText('Reprendre le cours')).not.toBeInTheDocument();
  });

  // ---- Loading state ----

  it('renders skeleton during loading', () => {
    const { container } = render(
      <HeroBanner
        user={null}
        enrollment={null}
        isLoading={true}
      />,
    );
    // Should render animated pulse skeleton
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  // ---- Edge cases ----

  it('handles missing user gracefully (default welcome text)', () => {
    render(
      <HeroBanner
        user={null}
        enrollment={null}
        isLoading={false}
      />,
    );
    // When user is null, firstName is empty, so fallback text is shown
    expect(screen.getByText('Bienvenue sur Topnet Solutions Academy')).toBeInTheDocument();
  });
});
