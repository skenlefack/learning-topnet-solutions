// ============================================================================
// ARIS Academy — Component Test: ForumTab
// Category filters, post rendering, upvotes/replies, empty state
// ============================================================================
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import ForumTab from '@/app/(main)/community/_components/ForumTab';
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
  communityApi: {
    listPosts: vi.fn().mockResolvedValue({
      data: [
        {
          id: 'post-001',
          author_first_name: 'Amina',
          author_last_name: 'Wanjiku',
          category: 'general',
          title: { fr: 'Bienvenue' },
          body: { fr: 'Presentation du forum' },
          upvotes: 5,
          reply_count: 2,
          created_at: new Date().toISOString(),
        },
      ],
    }),
    listReplies: vi.fn().mockResolvedValue({ data: [] }),
    createPost: vi.fn().mockResolvedValue({ data: { id: 'post-new' } }),
    upvote: vi.fn().mockResolvedValue({ data: { upvotes: 6 } }),
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

describe('ForumTab', () => {
  // ---- Category filters ----

  it('renders category filter buttons', () => {
    render(<ForumTab />);
    expect(screen.getByText('Tous')).toBeInTheDocument();
    expect(screen.getByText('Général')).toBeInTheDocument();
    expect(screen.getByText('Questions')).toBeInTheDocument();
    expect(screen.getByText('Ressources')).toBeInTheDocument();
    expect(screen.getByText('Annonces')).toBeInTheDocument();
  });

  // ---- New post button ----

  it('shows "Nouvelle discussion" button', () => {
    render(<ForumTab />);
    expect(screen.getByText('Nouvelle discussion')).toBeInTheDocument();
  });

  // ---- Post rendering (async) ----

  it('renders posts with author names', async () => {
    render(<ForumTab />);
    await waitFor(() => {
      expect(screen.getByText('Amina Wanjiku')).toBeInTheDocument();
    });
  });

  // ---- Upvote count ----

  it('shows upvote count', async () => {
    render(<ForumTab />);
    await waitFor(() => {
      expect(screen.getByText('5')).toBeInTheDocument();
    });
  });

  // ---- Reply count ----

  it('shows reply count with "reponses"', async () => {
    render(<ForumTab />);
    await waitFor(() => {
      expect(screen.getByText(/2 réponses/)).toBeInTheDocument();
    });
  });

  // ---- Empty state ----

  it('renders empty state message when no posts', async () => {
    const { communityApi } = await import('@/lib/api');
    (communityApi.listPosts as any).mockResolvedValueOnce({ data: [] });

    render(<ForumTab />);
    await waitFor(() => {
      expect(
        screen.getByText('Aucune discussion dans cette catégorie.'),
      ).toBeInTheDocument();
    });
  });
});
