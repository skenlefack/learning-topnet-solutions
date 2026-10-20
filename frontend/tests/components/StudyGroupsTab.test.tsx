// ============================================================================
// Topnet Solutions Academy — Component Test: StudyGroupsTab
// Study groups list, join/leave, create form
// ============================================================================
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import StudyGroupsTab from '@/app/(main)/community/_components/StudyGroupsTab';

// Mock useAuth
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ token: 'test-token' }),
}));

// Mock store
vi.mock('@/lib/store', () => ({
  useAuthStore: () => ({ language: 'fr' }),
}));

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

const mockGroups = [
  {
    id: 'group-001',
    name: { fr: 'Groupe Surveillance', en: 'Surveillance Group' },
    description: { fr: 'Description du groupe', en: 'Group description' },
    member_count: 5,
    max_members: 20,
    is_member: false,
    creator_first_name: 'Jean',
    creator_last_name: 'Mbeki',
  },
  {
    id: 'group-002',
    name: { fr: 'Groupe Analyse', en: 'Analysis Group' },
    member_count: 20,
    max_members: 20,
    is_member: true,
    creator_first_name: 'Amina',
    creator_last_name: 'Wanjiku',
  },
];

const mockCommunityApi = {
  listGroups: vi.fn().mockResolvedValue({ data: mockGroups }),
  createGroup: vi.fn().mockResolvedValue({ data: { id: 'group-new' } }),
  joinGroup: vi.fn().mockResolvedValue({ success: true }),
  leaveGroup: vi.fn().mockResolvedValue({ success: true }),
};

vi.mock('@/lib/api', () => ({
  communityApi: {
    listGroups: (...args: any[]) => mockCommunityApi.listGroups(...args),
    createGroup: (...args: any[]) => mockCommunityApi.createGroup(...args),
    joinGroup: (...args: any[]) => mockCommunityApi.joinGroup(...args),
    leaveGroup: (...args: any[]) => mockCommunityApi.leaveGroup(...args),
  },
}));

describe('StudyGroupsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCommunityApi.listGroups.mockResolvedValue({ data: mockGroups });
  });

  it('renders loading skeletons initially', () => {
    const { container } = render(<StudyGroupsTab />);
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders group names after loading', async () => {
    render(<StudyGroupsTab />);
    await waitFor(() => {
      expect(screen.getByText('Groupe Surveillance')).toBeInTheDocument();
    });
    expect(screen.getByText('Groupe Analyse')).toBeInTheDocument();
  });

  it('shows "Rejoindre" button for non-member groups', async () => {
    render(<StudyGroupsTab />);
    await waitFor(() => {
      expect(screen.getByText('Groupe Surveillance')).toBeInTheDocument();
    });
    // Uses t('join') from studyGroups namespace
    const joinBtns = screen.getAllByText(/Rejoindre/i);
    expect(joinBtns.length).toBeGreaterThan(0);
  });

  it('shows "Quitter" button for member groups', async () => {
    render(<StudyGroupsTab />);
    await waitFor(() => {
      expect(screen.getByText('Groupe Analyse')).toBeInTheDocument();
    });
    const leaveBtns = screen.getAllByText(/Quitter/i);
    expect(leaveBtns.length).toBeGreaterThan(0);
  });

  it('shows create button', async () => {
    render(<StudyGroupsTab />);
    await waitFor(() => {
      expect(screen.getByText('Groupe Surveillance')).toBeInTheDocument();
    });
    expect(screen.getByText(/Créer/i)).toBeInTheDocument();
  });

  it('opens create form when clicking create button', async () => {
    render(<StudyGroupsTab />);
    await waitFor(() => {
      expect(screen.getByText('Groupe Surveillance')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText(/Créer/i));
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/nom/i)).toBeInTheDocument();
    });
  });

  it('shows empty state when no groups', async () => {
    mockCommunityApi.listGroups.mockResolvedValue({ data: [] });
    render(<StudyGroupsTab />);
    await waitFor(() => {
      expect(screen.getByText(/Aucun groupe/i)).toBeInTheDocument();
    });
  });

  it('shows member count', async () => {
    render(<StudyGroupsTab />);
    await waitFor(() => {
      expect(screen.getByText(/5.*\/.*20/)).toBeInTheDocument();
    });
  });

  it('shows creator name', async () => {
    render(<StudyGroupsTab />);
    await waitFor(() => {
      expect(screen.getByText(/Jean Mbeki/)).toBeInTheDocument();
    });
  });

  it('calls joinGroup API when join button clicked', async () => {
    render(<StudyGroupsTab />);
    await waitFor(() => {
      expect(screen.getByText('Groupe Surveillance')).toBeInTheDocument();
    });
    const joinBtns = screen.getAllByText(/Rejoindre/i);
    fireEvent.click(joinBtns[0]);
    await waitFor(() => {
      expect(mockCommunityApi.joinGroup).toHaveBeenCalledWith('test-token', 'group-001');
    });
  });
});
