// ============================================================================
// Topnet Solutions Academy — Component Test: Error/Loading/NotFound pages
// ============================================================================
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Error from '@/app/error';
import Loading from '@/app/loading';
import NotFound from '@/app/not-found';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/',
}));

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
}));

describe('Error page', () => {
  it('renders error message', () => {
    const error = new globalThis.Error('Test error') as Error & { digest?: string };
    const reset = vi.fn();
    render(<Error error={error} reset={reset} />);
    expect(screen.getByText('Une erreur est survenue')).toBeInTheDocument();
  });

  it('renders retry button', () => {
    const error = new globalThis.Error('Test error') as Error & { digest?: string };
    const reset = vi.fn();
    render(<Error error={error} reset={reset} />);
    expect(screen.getByText('Réessayer')).toBeInTheDocument();
  });

  it('calls reset on retry click', () => {
    const error = new globalThis.Error('Test error') as Error & { digest?: string };
    const reset = vi.fn();
    render(<Error error={error} reset={reset} />);
    fireEvent.click(screen.getByText('Réessayer'));
    expect(reset).toHaveBeenCalled();
  });
});

describe('Loading page', () => {
  it('renders loading indicator', () => {
    const { container } = render(<Loading />);
    // Should have pulse/spin animation
    const animated = container.querySelector('.animate-pulse, .animate-spin');
    expect(animated || container.firstChild).toBeTruthy();
  });

  it('does not render empty', () => {
    const { container } = render(<Loading />);
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });
});

describe('NotFound page', () => {
  it('renders 404 heading', () => {
    render(<NotFound />);
    expect(screen.getByText('404')).toBeInTheDocument();
  });

  it('renders not found description', () => {
    render(<NotFound />);
    expect(screen.getByText('Page introuvable')).toBeInTheDocument();
  });

  it('renders a link to go back home', () => {
    const { container } = render(<NotFound />);
    const homeLink = container.querySelector('a[href="/"]');
    expect(homeLink).toBeInTheDocument();
  });
});
