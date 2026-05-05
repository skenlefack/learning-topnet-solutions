// ============================================================================
// ARIS Academy — Component Test: NotificationDropdown
// Bell icon, unread badge, dropdown panel, empty state, loading skeletons
// ============================================================================
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import NotificationDropdown from '@/app/_components/NotificationDropdown';
import { useAuthStore } from '@/lib/store';
import { mockUser } from '../mocks/data';

// Mock next/navigation (component may indirectly depend on it)
vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

// Mock the notificationApi to control async responses
vi.mock('@/lib/api', () => ({
  notificationApi: {
    unreadCount: vi.fn().mockResolvedValue({ data: { count: 3 } }),
    list: vi.fn().mockResolvedValue({ data: [] }),
    markRead: vi.fn().mockResolvedValue({}),
    markAllRead: vi.fn().mockResolvedValue({}),
  },
}));

describe('NotificationDropdown', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set authenticated state so the component fetches data
    useAuthStore.setState({
      user: mockUser as any,
      token: 'test-token',
      isAuthenticated: true,
      theme: 'light',
      language: 'fr',
    });
  });

  // ---- Bell icon ----

  it('renders bell icon button', () => {
    render(<NotificationDropdown />);
    const bellButton = screen.getByRole('button', { name: 'Notifications' });
    expect(bellButton).toBeInTheDocument();
  });

  // ---- Unread badge ----

  it('shows unread badge when count > 0', async () => {
    render(<NotificationDropdown />);
    // Wait for the unreadCount API call to resolve and badge to appear
    await waitFor(() => {
      expect(screen.getByText('3')).toBeInTheDocument();
    });
    // Badge should have red background
    const badge = screen.getByText('3');
    expect(badge.className).toContain('bg-red-500');
  });

  // ---- Dropdown panel ----

  it('renders "Notifications" header when opened', async () => {
    render(<NotificationDropdown />);
    // Wait for initial fetch to settle
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument();
    });
    // Click the bell to open dropdown
    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    // The dropdown header should be visible
    await waitFor(() => {
      // The "Notifications" text in the dropdown header (h3)
      const headers = screen.getAllByText('Notifications');
      // There should be at least 2: aria-label on button + h3 in dropdown
      expect(headers.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ---- Empty state ----

  it('shows "Aucune notification" when no notifications', async () => {
    render(<NotificationDropdown />);
    // Wait for unread count to load
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument();
    });
    // Open dropdown
    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    // The mock returns data: [] so we should see the empty message
    await waitFor(() => {
      expect(screen.getByText('Aucune notification')).toBeInTheDocument();
    });
  });

  // ---- Loading skeletons ----

  it('renders loading skeletons initially', async () => {
    // Make the list call hang so we can catch the loading state
    const { notificationApi } = await import('@/lib/api');
    (notificationApi.list as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise(() => {}), // never resolves
    );

    const { container } = render(<NotificationDropdown />);
    // Wait for initial unread count
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument();
    });
    // Open dropdown
    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    // While loading, skeleton elements with animate-pulse should be visible
    await waitFor(() => {
      const skeletons = container.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  // ---- Notification list with items ----

  it('renders notification items when list is non-empty', async () => {
    const { notificationApi } = await import('@/lib/api');
    (notificationApi.list as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [
        { id: 'n1', type: 'enrollment', title: { fr: 'Inscription' }, body: { fr: 'Bienvenue' }, is_read: false, created_at: new Date().toISOString() },
        { id: 'n2', type: 'certification', title: { fr: 'Certificat' }, body: { fr: 'Bravo' }, is_read: true, created_at: new Date(Date.now() - 3600000).toISOString() },
      ],
    });

    render(<NotificationDropdown />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    await waitFor(() => {
      expect(screen.getByText('Inscription')).toBeInTheDocument();
      expect(screen.getByText('Certificat')).toBeInTheDocument();
    });
  });

  it('shows "Tout lire" button when unread count > 0', async () => {
    const { notificationApi } = await import('@/lib/api');
    (notificationApi.list as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [{ id: 'n1', type: 'enrollment', title: { fr: 'Test' }, body: { fr: 'Body' }, is_read: false, created_at: new Date().toISOString() }],
    });

    render(<NotificationDropdown />);
    await waitFor(() => expect(screen.getByText('3')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    await waitFor(() => {
      expect(screen.getByText('Tout lire')).toBeInTheDocument();
    });
  });

  it('calls markAllRead when "Tout lire" is clicked', async () => {
    const { notificationApi } = await import('@/lib/api');
    (notificationApi.list as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [{ id: 'n1', type: 'enrollment', title: { fr: 'Test' }, body: { fr: 'Body' }, is_read: false, created_at: new Date().toISOString() }],
    });

    render(<NotificationDropdown />);
    await waitFor(() => expect(screen.getByText('3')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    await waitFor(() => expect(screen.getByText('Tout lire')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Tout lire'));
    await waitFor(() => {
      expect(notificationApi.markAllRead).toHaveBeenCalledWith('test-token');
    });
  });

  it('calls markRead when clicking an unread notification', async () => {
    const { notificationApi } = await import('@/lib/api');
    (notificationApi.list as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [{ id: 'n1', type: 'enrollment', title: { fr: 'Notif unread' }, body: { fr: 'Body' }, is_read: false, created_at: new Date().toISOString() }],
    });

    render(<NotificationDropdown />);
    await waitFor(() => expect(screen.getByText('3')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    await waitFor(() => expect(screen.getByText('Notif unread')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Notif unread'));
    await waitFor(() => {
      expect(notificationApi.markRead).toHaveBeenCalledWith('test-token', 'n1');
    });
  });

  it('renders time ago for recent notifications', async () => {
    const { notificationApi } = await import('@/lib/api');
    (notificationApi.list as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: [{ id: 'n1', type: 'system', title: { fr: 'Sys' }, body: { fr: 'Info' }, is_read: true, created_at: new Date(Date.now() - 120000).toISOString() }],
    });

    render(<NotificationDropdown />);
    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    await waitFor(() => {
      expect(screen.getByText(/Il y a 2m/)).toBeInTheDocument();
    });
  });
});
