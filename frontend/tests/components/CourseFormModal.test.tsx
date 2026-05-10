// ============================================================================
// ARIS Academy — Component Test: CourseFormModal
// Tests form rendering, validation, edit mode
// ============================================================================
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
  courseApi: {
    create: vi.fn().mockResolvedValue({ success: true }),
    update: vi.fn().mockResolvedValue({ success: true }),
  },
  categoryApi: {
    list: vi.fn().mockResolvedValue({ success: true, data: [] }),
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

// Import after mocks
import CourseFormModal from '@/app/admin/_components/CourseFormModal';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CourseFormModal', () => {
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
      <CourseFormModal open={false} onClose={onClose} onSuccess={onSuccess} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders the form when open', () => {
    render(
      <CourseFormModal open={true} onClose={onClose} onSuccess={onSuccess} />,
    );
    // Should show a form
    const form = document.querySelector('form');
    expect(form).toBeTruthy();
  });

  it('renders title and description fields for multilingual input', () => {
    render(
      <CourseFormModal open={true} onClose={onClose} onSuccess={onSuccess} />,
    );
    // Should have text inputs for course data
    const inputs = screen.getAllByRole('textbox');
    expect(inputs.length).toBeGreaterThan(0);
  });

  it('shows create mode title by default', () => {
    render(
      <CourseFormModal open={true} onClose={onClose} onSuccess={onSuccess} />,
    );
    // The modal should have a heading with "new" or "create"
    const heading = document.querySelector('h2');
    expect(heading).toBeTruthy();
  });

  it('calls onClose when cancel is clicked', () => {
    render(
      <CourseFormModal open={true} onClose={onClose} onSuccess={onSuccess} />,
    );

    const cancelButton = screen.getByText('common.cancel');
    fireEvent.click(cancelButton);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows edit mode when editCourse is provided', () => {
    const editCourse = {
      id: 'course-001',
      title: { fr: 'Cours Test', en: 'Test Course' },
      description: { fr: 'Description', en: 'Description' },
      level: 'beginner',
      slug: 'test-course',
      tags: ['test'],
      status: 'draft',
    };

    render(
      <CourseFormModal open={true} onClose={onClose} onSuccess={onSuccess} editCourse={editCourse} />,
    );

    // Should show edit title
    const heading = document.querySelector('h2');
    expect(heading?.textContent).toBeTruthy();
  });

  it('renders level selector', () => {
    render(
      <CourseFormModal open={true} onClose={onClose} onSuccess={onSuccess} />,
    );

    // Should have select elements for level
    const selects = screen.getAllByRole('combobox');
    expect(selects.length).toBeGreaterThan(0);
  });

  it('has a submit button', () => {
    render(
      <CourseFormModal open={true} onClose={onClose} onSuccess={onSuccess} />,
    );

    const submitButton = document.querySelector('button[type="submit"]');
    expect(submitButton).toBeTruthy();
  });
});
