// ============================================================================
// ARIS Academy — Component Test: Main layout error/loading/not-found
// ============================================================================
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MainLayoutError from '@/app/(main)/error';
import MainLoading from '@/app/(main)/loading';
import MainNotFound from '@/app/(main)/not-found';

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
}));

describe('MainLayoutError', () => {
  it('renders error heading', () => {
    const error = new Error('Test') as Error & { digest?: string };
    render(<MainLayoutError error={error} reset={vi.fn()} />);
    expect(screen.getByText('Une erreur est survenue')).toBeInTheDocument();
  });

  it('renders retry button', () => {
    const error = new Error('Test') as Error & { digest?: string };
    render(<MainLayoutError error={error} reset={vi.fn()} />);
    expect(screen.getByText('Réessayer')).toBeInTheDocument();
  });

  it('calls reset on retry click', () => {
    const error = new Error('Test') as Error & { digest?: string };
    const reset = vi.fn();
    render(<MainLayoutError error={error} reset={reset} />);
    fireEvent.click(screen.getByText('Réessayer'));
    expect(reset).toHaveBeenCalled();
  });

  it('renders dashboard link', () => {
    const error = new Error('Test') as Error & { digest?: string };
    render(<MainLayoutError error={error} reset={vi.fn()} />);
    expect(screen.getByText("Retour au tableau de bord")).toBeInTheDocument();
  });

  it('shows error digest when present', () => {
    const error = Object.assign(new Error('Test'), { digest: 'abc123' }) as Error & { digest?: string };
    render(<MainLayoutError error={error} reset={vi.fn()} />);
    expect(screen.getByText(/abc123/)).toBeInTheDocument();
  });
});

describe('MainLoading', () => {
  it('renders with animate-pulse', () => {
    const { container } = render(<MainLoading />);
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders hero banner placeholder', () => {
    const { container } = render(<MainLoading />);
    expect(container.querySelector('.h-44')).toBeInTheDocument();
  });

  it('renders 4 stat card placeholders', () => {
    const { container } = render(<MainLoading />);
    const statCards = container.querySelectorAll('.grid.grid-cols-2 > div');
    expect(statCards.length).toBe(4);
  });

  it('renders course list placeholders', () => {
    const { container } = render(<MainLoading />);
    // 3 course items
    const courseItems = container.querySelectorAll('.space-y-3 > div');
    expect(courseItems.length).toBe(3);
  });
});

describe('MainNotFound', () => {
  it('renders 404 heading', () => {
    render(<MainNotFound />);
    expect(screen.getByText('404')).toBeInTheDocument();
  });

  it('renders not found text', () => {
    render(<MainNotFound />);
    expect(screen.getByText('Page introuvable')).toBeInTheDocument();
  });

  it('renders dashboard link', () => {
    const { container } = render(<MainNotFound />);
    const link = container.querySelector('a[href="/"]');
    expect(link).toBeInTheDocument();
  });

  it('renders search suggestion', () => {
    render(<MainNotFound />);
    expect(screen.getByText(/Essayez de rechercher/)).toBeInTheDocument();
  });
});
