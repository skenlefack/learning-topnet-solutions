// ============================================================================
// Topnet Solutions Academy — Component Test: Sidebar
// Navigation items, active state, admin link, certification levels, close btn
// ============================================================================
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Sidebar from '@/app/_components/Sidebar';
import { useAuthStore } from '@/lib/store';
import { mockUser, mockAdminUser } from '../mocks/data';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

// Mock next/link to render a plain anchor
vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, onClick, className }: any) => (
    <a href={href} onClick={onClick} className={className}>
      {children}
    </a>
  ),
}));

describe('Sidebar', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    onClose.mockClear();
    // Default: authenticated learner
    useAuthStore.setState({
      user: mockUser as any,
      token: 'test-token',
      isAuthenticated: true,
      theme: 'light',
      language: 'fr',
    });
  });

  // ---- Navigation items ----

  it('renders all navigation items', () => {
    render(<Sidebar open={true} onClose={onClose} />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Mes Cours')).toBeInTheDocument();
    expect(screen.getByText('Lives')).toBeInTheDocument();
    expect(screen.getByText('Certifications')).toBeInTheDocument();
    expect(screen.getByText('Communaut\u00e9')).toBeInTheDocument();
  });

  // ---- Brand ----

  it('shows Topnet Solutions brand text', () => {
    render(<Sidebar open={true} onClose={onClose} />);
    expect(screen.getByText('Topnet Solutions')).toBeInTheDocument();
    expect(screen.getByText('Academy')).toBeInTheDocument();
  });

  // ---- Active state ----

  it('highlights active route (Dashboard at "/")', () => {
    const { container } = render(<Sidebar open={true} onClose={onClose} />);
    // The Dashboard link at "/" should have the active class with border-brand-gold
    const activeLinks = container.querySelectorAll('[class*="border-brand-gold"]');
    expect(activeLinks.length).toBeGreaterThan(0);
    // Find the Dashboard link specifically
    const dashboardLink = screen.getByText('Dashboard').closest('a');
    expect(dashboardLink?.className).toContain('border-brand-gold');
  });

  // ---- Admin link visibility ----

  it('hides admin link for learner role', () => {
    useAuthStore.setState({ user: mockUser as any });
    render(<Sidebar open={true} onClose={onClose} />);
    expect(screen.queryByText('Administration')).toBeNull();
  });

  it('shows admin link for admin_continental role', () => {
    useAuthStore.setState({ user: mockAdminUser as any });
    render(<Sidebar open={true} onClose={onClose} />);
    expect(screen.getByText('Administration')).toBeInTheDocument();
  });

  // ---- Certification levels ----

  it('renders certification level labels', () => {
    render(<Sidebar open={true} onClose={onClose} />);
    expect(screen.getByText('D\u00e9butant')).toBeInTheDocument();
    expect(screen.getByText('Interm\u00e9diaire')).toBeInTheDocument();
    expect(screen.getByText('Avanc\u00e9')).toBeInTheDocument();
    expect(screen.getByText('Expert')).toBeInTheDocument();
  });

  // ---- Close button ----

  it('calls onClose when close button is clicked', () => {
    const { container } = render(<Sidebar open={true} onClose={onClose} />);
    // The close button is the lg:hidden button containing the X icon
    // It is the only button inside the sidebar (nav links are <a> tags)
    const buttons = container.querySelectorAll('button');
    // Click the close button (the one inside the brand header)
    const closeButton = Array.from(buttons).find(
      (btn) => btn.className.includes('lg:hidden'),
    );
    expect(closeButton).toBeTruthy();
    fireEvent.click(closeButton!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
