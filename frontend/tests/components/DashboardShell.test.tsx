// ============================================================================
// Topnet Solutions Academy — Component Test: DashboardShell
// Layout wrapper with Sidebar + Header
// ============================================================================
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DashboardShell from '@/app/_components/DashboardShell';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock next/image
vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }: any) => <img src={src} alt={alt} {...props} />,
}));

// Mock store
vi.mock('@/lib/store', () => ({
  useAuthStore: () => ({
    user: { firstName: 'Amina', lastName: 'Wanjiku', role: 'learner', email: 'a@test.com' },
    token: 'test-token',
    theme: 'light',
    toggleTheme: vi.fn(),
    language: 'fr',
    setLanguage: vi.fn(),
    certLevel: 'foundation',
    logout: vi.fn(),
  }),
}));

// Mock useAuth hook
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ token: 'test-token', user: { firstName: 'Amina', lastName: 'Wanjiku' } }),
}));

// Mock API
vi.mock('@/lib/api', () => ({
  searchApi: { global: vi.fn().mockResolvedValue({ data: { courses: [], modules: [], lessons: [] } }) },
  notificationApi: {
    unreadCount: vi.fn().mockResolvedValue({ data: { count: 0 } }),
    list: vi.fn().mockResolvedValue({ data: [] }),
  },
}));

describe('DashboardShell', () => {
  it('renders children content', () => {
    render(
      <DashboardShell>
        <div data-testid="child-content">Hello</div>
      </DashboardShell>,
    );
    expect(screen.getByTestId('child-content')).toBeInTheDocument();
  });

  it('renders sidebar with Topnet Solutions branding', () => {
    render(<DashboardShell><div>content</div></DashboardShell>);
    expect(screen.getAllByText('Topnet Solutions').length).toBeGreaterThan(0);
  });

  it('renders header with menu toggle button', () => {
    render(<DashboardShell><div>content</div></DashboardShell>);
    const menuBtn = screen.getByLabelText('Toggle menu');
    expect(menuBtn).toBeInTheDocument();
  });

  it('renders default DashboardHome when no children', () => {
    render(<DashboardShell />);
    // DashboardHome uses t('welcome') from dashboard namespace
    expect(screen.getByText(/Bienvenue/i)).toBeInTheDocument();
  });

  it('renders stat cards in default view', () => {
    render(<DashboardShell />);
    // Should show stat values
    expect(screen.getByText('6')).toBeInTheDocument();
    expect(screen.getByText('42h')).toBeInTheDocument();
    expect(screen.getByText('68%')).toBeInTheDocument();
  });

  it('renders "Continuer ma formation" section', () => {
    render(<DashboardShell />);
    expect(screen.getByText(/Continuer/i)).toBeInTheDocument();
  });

  it('has minimum height full screen', () => {
    const { container } = render(<DashboardShell><div>x</div></DashboardShell>);
    const wrapper = container.firstElementChild;
    expect(wrapper?.className).toContain('min-h-screen');
  });
});
