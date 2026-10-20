// ============================================================================
// Topnet Solutions Academy — Component Test: UserFormModal
// Tests form rendering, validation, edit mode, submission
// ============================================================================
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import UserFormModal from '@/app/admin/_components/UserFormModal';
import { useAuthStore } from '@/lib/store';
import { mockAdminUser, mockToken } from '../mocks/data';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock('next-intl', () => ({
  useTranslations: (ns: string) => (key: string) => `${ns}.${key}`,
}));

vi.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/lib/api', () => ({
  adminApi: {
    tenants: vi.fn().mockResolvedValue({ data: [
      { id: 't1', name: 'Topnet Solutions', level: 'continental' },
      { id: 't2', name: 'ECOWAS', level: 'rec' },
      { id: 't3', name: 'Kenya', level: 'country', code: 'KE', parent_id: 't2' },
    ]}),
    createUser: vi.fn().mockResolvedValue({ success: true }),
    updateUser: vi.fn().mockResolvedValue({ success: true }),
  },
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    token: 'test-token',
    user: mockAdminUser,
    isAuthenticated: true,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('UserFormModal', () => {
  const onClose = vi.fn();
  const onSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      user: mockAdminUser as any,
      token: mockToken,
      isAuthenticated: true,
      theme: 'light',
      language: 'fr',
    });
  });

  it('renders nothing when closed', () => {
    const { container } = render(
      <UserFormModal open={false} onClose={onClose} onSuccess={onSuccess} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders the form when open', () => {
    render(
      <UserFormModal open={true} onClose={onClose} onSuccess={onSuccess} />,
    );
    // Title should show "new" mode
    expect(screen.getByText('admin.userForm.newTitle')).toBeInTheDocument();
  });

  it('renders form fields', () => {
    render(
      <UserFormModal open={true} onClose={onClose} onSuccess={onSuccess} />,
    );

    // Labels
    expect(screen.getByText('admin.userForm.firstName')).toBeInTheDocument();
    expect(screen.getByText('admin.userForm.lastName')).toBeInTheDocument();
    expect(screen.getByText('admin.userForm.email')).toBeInTheDocument();
    expect(screen.getByText('admin.userForm.role')).toBeInTheDocument();
    expect(screen.getByText('admin.userForm.preferredLanguage')).toBeInTheDocument();
  });

  it('shows edit title when editUser is provided', () => {
    const editUser = {
      id: 'usr-001',
      first_name: 'Amina',
      last_name: 'Diallo',
      email: 'amina@test.org',
      role: 'trainer',
      tenant_id: 't1',
      preferred_language: 'fr',
      is_active: true,
    };

    render(
      <UserFormModal open={true} onClose={onClose} onSuccess={onSuccess} editUser={editUser} />,
    );

    expect(screen.getByText('admin.userForm.editTitle')).toBeInTheDocument();
  });

  it('pre-fills form in edit mode', () => {
    const editUser = {
      id: 'usr-001',
      first_name: 'Amina',
      last_name: 'Diallo',
      email: 'amina@test.org',
      role: 'trainer',
      tenant_id: 't1',
      preferred_language: 'fr',
      is_active: true,
    };

    render(
      <UserFormModal open={true} onClose={onClose} onSuccess={onSuccess} editUser={editUser} />,
    );

    const inputs = screen.getAllByRole('textbox');
    // First name and last name inputs should be pre-filled
    const firstNameInput = inputs.find(
      (input) => (input as HTMLInputElement).value === 'Amina',
    );
    expect(firstNameInput).toBeDefined();
  });

  it('calls onClose when close button clicked', () => {
    render(
      <UserFormModal open={true} onClose={onClose} onSuccess={onSuccess} />,
    );

    const cancelButton = screen.getByText('common.cancel');
    fireEvent.click(cancelButton);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows role options', () => {
    render(
      <UserFormModal open={true} onClose={onClose} onSuccess={onSuccess} />,
    );

    const selects = screen.getAllByRole('combobox');
    const roleSelect = selects[0];
    expect(roleSelect).toBeDefined();
    // Check role options exist
    const options = roleSelect.querySelectorAll('option');
    expect(options.length).toBe(5); // learner, trainer, admin_country, admin_rec, admin_continental
  });

  it('shows tenant level buttons', () => {
    render(
      <UserFormModal open={true} onClose={onClose} onSuccess={onSuccess} />,
    );

    expect(screen.getByText('admin.userForm.continental')).toBeInTheDocument();
    expect(screen.getByText('admin.userForm.rec')).toBeInTheDocument();
    expect(screen.getByText('admin.userForm.country')).toBeInTheDocument();
  });
});
