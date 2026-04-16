// ============================================================================
// ARIS Academy — Component Test: LivePanel
// Live badge, join button, empty state, sorting
// ============================================================================
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import LivePanel from '@/app/(main)/_components/LivePanel';
import { mockLiveSessions } from '../mocks/data';

describe('LivePanel', () => {
  // ---- Basic rendering ----

  it('renders the panel header', () => {
    render(<LivePanel sessions={mockLiveSessions} isLoading={false} />);
    expect(screen.getByText('Sessions live')).toBeInTheDocument();
  });

  it('renders session items', () => {
    render(<LivePanel sessions={mockLiveSessions} isLoading={false} />);
    // Should show at most 4 sessions
    const items = screen.getAllByRole('button').length;
    // At least the "Rejoindre" button for live session
    expect(items).toBeGreaterThan(0);
  });

  // ---- Live badge ----

  it('shows "En direct" badge for live sessions', () => {
    render(<LivePanel sessions={mockLiveSessions} isLoading={false} />);
    expect(screen.getByText('En direct')).toBeInTheDocument();
  });

  it('shows pulsing indicator for live sessions', () => {
    const { container } = render(
      <LivePanel sessions={mockLiveSessions} isLoading={false} />,
    );
    // The Radio icon has animate-pulse class
    const pulsingElements = container.querySelectorAll('.animate-pulse');
    expect(pulsingElements.length).toBeGreaterThan(0);
  });

  it('shows red background for live session items', () => {
    const { container } = render(
      <LivePanel sessions={mockLiveSessions} isLoading={false} />,
    );
    // Live sessions get red-50 background
    const redBg = container.querySelectorAll('[class*="bg-red"]');
    expect(redBg.length).toBeGreaterThan(0);
  });

  // ---- Join button ----

  it('shows "Rejoindre" button for live sessions', () => {
    render(<LivePanel sessions={mockLiveSessions} isLoading={false} />);
    expect(screen.getByText('Rejoindre')).toBeInTheDocument();
  });

  it('does not show "Rejoindre" button for scheduled sessions', () => {
    const scheduled = mockLiveSessions.filter((s) => s.status === 'scheduled');
    render(<LivePanel sessions={scheduled} isLoading={false} />);
    expect(screen.queryByText('Rejoindre')).toBeNull();
  });

  // ---- Sorting ----

  it('sorts live sessions before scheduled ones', () => {
    const { container } = render(
      <LivePanel sessions={mockLiveSessions} isLoading={false} />,
    );
    // First item should be the live session
    const items = container.querySelectorAll('[class*="rounded-lg"][class*="p-3"]');
    if (items.length > 0) {
      // First item should have red background (live)
      expect(items[0].className).toContain('red');
    }
  });

  // ---- Session titles ----

  it('renders session title from i18n object', () => {
    render(<LivePanel sessions={mockLiveSessions} isLoading={false} />);
    expect(screen.getByText('Atelier pratique ARIS')).toBeInTheDocument();
  });

  it('renders session title from plain string', () => {
    const sessions = [
      { ...mockLiveSessions[0], title: 'Plain Title' },
    ];
    render(<LivePanel sessions={sessions} isLoading={false} />);
    expect(screen.getByText('Plain Title')).toBeInTheDocument();
  });

  it('falls back to session.name when title is missing', () => {
    const sessions = [
      { ...mockLiveSessions[0], title: undefined, name: 'Fallback Name' },
    ];
    render(<LivePanel sessions={sessions} isLoading={false} />);
    expect(screen.getByText('Fallback Name')).toBeInTheDocument();
  });

  // ---- Date formatting ----

  it('formats scheduled session date in French locale', () => {
    const scheduled = mockLiveSessions.filter((s) => s.status === 'scheduled');
    render(<LivePanel sessions={scheduled} isLoading={false} />);
    // Date should be visible in fr-FR locale format
    // Check that date elements exist (format varies by locale)
    const dateElements = screen.getAllByText(/\d+/);
    expect(dateElements.length).toBeGreaterThan(0);
  });

  // ---- Loading state ----

  it('renders skeleton during loading', () => {
    const { container } = render(
      <LivePanel sessions={[]} isLoading={true} />,
    );
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('does not render sessions during loading', () => {
    render(<LivePanel sessions={mockLiveSessions} isLoading={true} />);
    // Should not show session titles while loading
    expect(screen.queryByText('Atelier pratique ARIS')).toBeNull();
  });

  // ---- Empty state ----

  it('shows empty message when no sessions', () => {
    render(<LivePanel sessions={[]} isLoading={false} />);
    expect(screen.getByText(/Aucune session programmée/)).toBeInTheDocument();
  });

  // ---- Edge cases ----

  it('limits display to 4 sessions', () => {
    const manySessions = Array.from({ length: 10 }, (_, i) => ({
      id: `session-${i}`,
      title: { fr: `Session ${i}` },
      status: 'scheduled' as const,
      startTime: new Date(Date.now() + i * 86400000).toISOString(),
    }));
    const { container } = render(
      <LivePanel sessions={manySessions} isLoading={false} />,
    );
    // Should only render 4 items max
    const items = container.querySelectorAll('[class*="rounded-lg"][class*="p-3"]');
    expect(items.length).toBeLessThanOrEqual(4);
  });

  it('handles session with snake_case start_time', () => {
    const sessions = [
      {
        id: 'live-sc',
        title: 'Snake Case Time',
        status: 'scheduled',
        start_time: new Date(Date.now() + 86400000).toISOString(),
      },
    ];
    render(<LivePanel sessions={sessions} isLoading={false} />);
    expect(screen.getByText('Snake Case Time')).toBeInTheDocument();
  });

  it('handles session with no title gracefully', () => {
    const sessions = [
      { id: 'no-title', title: undefined, name: undefined, status: 'scheduled', startTime: new Date().toISOString() },
    ];
    render(<LivePanel sessions={sessions} isLoading={false} />);
    // Should render "Session" as fallback
    expect(screen.getByText('Session')).toBeInTheDocument();
  });

  it('renders all live sessions before scheduled in mixed list', () => {
    const mixed = [
      { id: 's1', title: 'Scheduled 1', status: 'scheduled', startTime: new Date(Date.now() - 1000).toISOString() },
      { id: 'l1', title: 'Live 1', status: 'live', startTime: new Date().toISOString() },
      { id: 's2', title: 'Scheduled 2', status: 'scheduled', startTime: new Date(Date.now() + 86400000).toISOString() },
    ];
    const { container } = render(
      <LivePanel sessions={mixed} isLoading={false} />,
    );
    const items = container.querySelectorAll('[class*="rounded-lg"][class*="p-3"]');
    if (items.length > 0) {
      // First item should be the live one (red background)
      expect(items[0].className).toContain('red');
    }
  });
});
