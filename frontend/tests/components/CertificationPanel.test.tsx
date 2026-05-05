// ============================================================================
// ARIS Academy — Component Test: CertificationPanel
// ============================================================================
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CertificationPanel from '@/app/(main)/_components/CertificationPanel';

describe('CertificationPanel', () => {
  const baseCerts = [
    { level: 'foundation', status: 'issued', issuedAt: '2025-12-01T00:00:00Z' },
    { level: 'intermediate', status: 'pending' },
  ];

  it('renders loading skeleton when isLoading is true', () => {
    const { container } = render(
      <CertificationPanel certifications={[]} enrollments={[]} isLoading={true} />,
    );
    const pulseElements = container.querySelectorAll('.animate-pulse');
    expect(pulseElements.length).toBeGreaterThan(0);
  });

  it('renders all 4 certification levels', () => {
    render(
      <CertificationPanel certifications={[]} enrollments={[]} isLoading={false} />,
    );
    expect(screen.getByText('Foundation')).toBeInTheDocument();
    expect(screen.getByText('Intermediate')).toBeInTheDocument();
    expect(screen.getByText('Advanced')).toBeInTheDocument();
    expect(screen.getByText('Expert')).toBeInTheDocument();
  });

  it('shows "Obtenue" badge for issued certifications', () => {
    render(
      <CertificationPanel certifications={baseCerts} enrollments={[]} isLoading={false} />,
    );
    expect(screen.getByText('Obtenue')).toBeInTheDocument();
  });

  it('shows "En cours" for pending/in_progress certifications', () => {
    render(
      <CertificationPanel certifications={baseCerts} enrollments={[]} isLoading={false} />,
    );
    expect(screen.getByText('En cours')).toBeInTheDocument();
  });

  it('shows "Verrouillée" for locked levels', () => {
    render(
      <CertificationPanel certifications={[]} enrollments={[]} isLoading={false} />,
    );
    // Without any certs, levels after Foundation should show "Disponible" or "Verrouillée"
    const lockedElements = screen.getAllByText('Verrouillée');
    expect(lockedElements.length).toBeGreaterThan(0);
  });

  it('shows issued date for obtained certifications', () => {
    render(
      <CertificationPanel certifications={baseCerts} enrollments={[]} isLoading={false} />,
    );
    // Dec 2025 in fr-FR format
    expect(screen.getByText(/déc\. 2025/i)).toBeInTheDocument();
  });

  it('renders "Certifications ARIS" heading', () => {
    render(
      <CertificationPanel certifications={[]} enrollments={[]} isLoading={false} />,
    );
    expect(screen.getByText('Certifications ARIS')).toBeInTheDocument();
  });

  it('shows certification count when certifications exist', () => {
    render(
      <CertificationPanel certifications={baseCerts} enrollments={[]} isLoading={false} />,
    );
    expect(screen.getByText('1 / 4 certifications obtenues')).toBeInTheDocument();
  });

  it('renders "Vérifier un certificat" link', () => {
    render(
      <CertificationPanel certifications={[]} enrollments={[]} isLoading={false} />,
    );
    const link = screen.getByText(/Vérifier un certificat/);
    expect(link.closest('a')).toHaveAttribute('href', '/certificates');
  });

  it('shows "Disponible" for unlocked but not started levels', () => {
    // Foundation available (first level, no previous requirement)
    render(
      <CertificationPanel certifications={[]} enrollments={[]} isLoading={false} />,
    );
    expect(screen.getByText('Disponible')).toBeInTheDocument();
  });

  it('unlocks next level when previous is issued', () => {
    const certs = [
      { level: 'foundation', status: 'issued', issuedAt: '2025-12-01T00:00:00Z' },
    ];
    render(
      <CertificationPanel certifications={certs} enrollments={[]} isLoading={false} />,
    );
    // Intermediate should be "Disponible" not "Verrouillée"
    const availableElements = screen.getAllByText('Disponible');
    expect(availableElements.length).toBeGreaterThanOrEqual(1);
  });
});
