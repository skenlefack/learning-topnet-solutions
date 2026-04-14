// ============================================================================
// ARIS Academy — Component Test: LeaderboardTab
// Period selector, table headers, entries, scores, country, empty state
// ============================================================================
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import LeaderboardTab from '@/app/(main)/community/_components/LeaderboardTab';
import { useAuthStore } from '@/lib/store';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    token: 'test-token',
    user: { id: 'usr-001', firstName: 'Amina', lastName: 'Wanjiku', role: 'learner' },
  }),
}));

vi.mock('@/lib/api', () => ({
  learningApi: {
    leaderboard: vi.fn().mockResolvedValue({
      data: [
        { rank: 1, user_id: '1', first_name: 'Amina', last_name: 'Osei', score: 2450, courses_completed: 8, country: 'Ghana' },
        { rank: 2, user_id: '2', first_name: 'Jean', last_name: 'Mbeki', score: 2280, courses_completed: 7, country: 'Cameroun' },
        { rank: 3, user_id: '3', first_name: 'Fatima', last_name: 'Ali', score: 2100, courses_completed: 6, country: 'Kenya' },
      ],
    }),
  },
}));

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  useAuthStore.setState({ language: 'fr' });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LeaderboardTab', () => {
  // ---- Period selector ----

  it('renders period selector buttons', () => {
    render(<LeaderboardTab />);
    expect(screen.getByText('Tout')).toBeInTheDocument();
    expect(screen.getByText('Ce mois')).toBeInTheDocument();
    expect(screen.getByText('Cette semaine')).toBeInTheDocument();
  });

  // ---- Table headers ----

  it('shows table headers', async () => {
    render(<LeaderboardTab />);
    await waitFor(() => {
      expect(screen.getByText('Rang')).toBeInTheDocument();
      expect(screen.getByText('Apprenant')).toBeInTheDocument();
      expect(screen.getByText('Score')).toBeInTheDocument();
      expect(screen.getByText('Cours')).toBeInTheDocument();
    });
  });

  // ---- Entry rendering (async) ----

  it('renders leaderboard entries with names', async () => {
    render(<LeaderboardTab />);
    await waitFor(() => {
      expect(screen.getByText('Amina Osei')).toBeInTheDocument();
      expect(screen.getByText('Jean Mbeki')).toBeInTheDocument();
      expect(screen.getByText('Fatima Ali')).toBeInTheDocument();
    });
  });

  // ---- Scores ----

  it('shows scores formatted', async () => {
    render(<LeaderboardTab />);
    await waitFor(() => {
      // toLocaleString() formats numbers — check the raw values are present
      expect(screen.getByText((_, el) => el?.textContent === '2,450')).toBeInTheDocument();
      expect(screen.getByText((_, el) => el?.textContent === '2,280')).toBeInTheDocument();
      expect(screen.getByText((_, el) => el?.textContent === '2,100')).toBeInTheDocument();
    });
  });

  // ---- Country info ----

  it('renders country info', async () => {
    render(<LeaderboardTab />);
    await waitFor(() => {
      expect(screen.getByText('Ghana')).toBeInTheDocument();
      expect(screen.getByText('Cameroun')).toBeInTheDocument();
      expect(screen.getByText('Kenya')).toBeInTheDocument();
    });
  });

  // ---- Empty state ----

  it('shows empty state when no data', async () => {
    const { learningApi } = await import('@/lib/api');
    (learningApi.leaderboard as any).mockResolvedValueOnce({ data: [] });

    render(<LeaderboardTab />);
    await waitFor(() => {
      expect(
        screen.getByText('Aucune donnee de classement disponible.'),
      ).toBeInTheDocument();
    });
  });
});
