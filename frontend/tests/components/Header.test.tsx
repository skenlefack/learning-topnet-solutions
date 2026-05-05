// ============================================================================
// ARIS Academy — Component Test: Header
// Search, theme toggle, language selector, user menu
// ============================================================================
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Header from '@/app/_components/Header';

const mockToggleTheme = vi.fn();
const mockSetLanguage = vi.fn();
const mockLogout = vi.fn();

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// Mock next/image
vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }: any) => <img src={src} alt={alt} {...props} />,
}));

// Mock store
vi.mock('@/lib/store', () => ({
  useAuthStore: Object.assign(
    () => ({
      user: { firstName: 'Amina', lastName: 'Wanjiku', role: 'admin_continental', email: 'a@test.com' },
      token: 'test-token',
      theme: 'light',
      toggleTheme: mockToggleTheme,
      language: 'fr',
      setLanguage: mockSetLanguage,
      logout: mockLogout,
    }),
    { getState: () => ({ logout: mockLogout }) },
  ),
}));

// Mock API
vi.mock('@/lib/api', () => ({
  searchApi: { global: vi.fn().mockResolvedValue({ data: { courses: [], modules: [], lessons: [] } }) },
  notificationApi: {
    unreadCount: vi.fn().mockResolvedValue({ data: { count: 0 } }),
    list: vi.fn().mockResolvedValue({ data: [] }),
  },
}));

// Mock hooks
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ token: 'test-token' }),
}));

describe('Header', () => {
  const onMenuToggle = vi.fn();

  it('renders menu toggle button', () => {
    render(<Header onMenuToggle={onMenuToggle} />);
    expect(screen.getByLabelText('Toggle menu')).toBeInTheDocument();
  });

  it('calls onMenuToggle when hamburger clicked', () => {
    render(<Header onMenuToggle={onMenuToggle} />);
    fireEvent.click(screen.getByLabelText('Toggle menu'));
    expect(onMenuToggle).toHaveBeenCalled();
  });

  it('renders user initials', () => {
    render(<Header onMenuToggle={onMenuToggle} />);
    expect(screen.getByText('AW')).toBeInTheDocument();
  });

  it('renders user full name', () => {
    render(<Header onMenuToggle={onMenuToggle} />);
    expect(screen.getByText('Amina Wanjiku')).toBeInTheDocument();
  });

  it('renders theme toggle button', () => {
    render(<Header onMenuToggle={onMenuToggle} />);
    expect(screen.getByLabelText('Toggle theme')).toBeInTheDocument();
  });

  it('calls toggleTheme on theme button click', () => {
    render(<Header onMenuToggle={onMenuToggle} />);
    fireEvent.click(screen.getByLabelText('Toggle theme'));
    expect(mockToggleTheme).toHaveBeenCalled();
  });

  it('renders language selector with current language', () => {
    render(<Header onMenuToggle={onMenuToggle} />);
    expect(screen.getByText('FR')).toBeInTheDocument();
  });

  it('opens language dropdown on click', () => {
    render(<Header onMenuToggle={onMenuToggle} />);
    fireEvent.click(screen.getByLabelText('Select language'));
    expect(screen.getByText('Français')).toBeInTheDocument();
    expect(screen.getByText('English')).toBeInTheDocument();
    expect(screen.getByText('العربية')).toBeInTheDocument();
    expect(screen.getByText('Português')).toBeInTheDocument();
  });

  it('renders search button', () => {
    render(<Header onMenuToggle={onMenuToggle} />);
    expect(screen.getByLabelText('Search')).toBeInTheDocument();
  });

  it('opens search input on search button click', () => {
    render(<Header onMenuToggle={onMenuToggle} />);
    fireEvent.click(screen.getByLabelText('Search'));
    expect(screen.getByPlaceholderText(/Rechercher/i)).toBeInTheDocument();
  });

  it('renders user role', () => {
    render(<Header onMenuToggle={onMenuToggle} />);
    expect(screen.getByText(/admin continental/i)).toBeInTheDocument();
  });

  it('opens user menu on avatar click', () => {
    render(<Header onMenuToggle={onMenuToggle} />);
    fireEvent.click(screen.getByLabelText('User menu'));
    expect(screen.getByText(/Profil/i)).toBeInTheDocument();
    expect(screen.getByText(/Déconnexion/i)).toBeInTheDocument();
  });

  it('renders domain name on desktop', () => {
    render(<Header onMenuToggle={onMenuToggle} />);
    expect(screen.getByText('learning.au-ibar.org')).toBeInTheDocument();
  });
});
