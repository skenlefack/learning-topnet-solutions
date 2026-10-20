// ============================================================================
// Topnet Solutions Academy — Component Test: Courses error/loading pages
// ============================================================================
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CoursesError from '@/app/(main)/courses/error';
import CoursesLoading from '@/app/(main)/courses/loading';

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
}));

describe('CoursesError', () => {
  it('renders error heading', () => {
    const error = new Error('Test') as Error & { digest?: string };
    render(<CoursesError error={error} reset={vi.fn()} />);
    expect(screen.getByText('Une erreur est survenue')).toBeInTheDocument();
  });

  it('renders retry button', () => {
    const error = new Error('Test') as Error & { digest?: string };
    render(<CoursesError error={error} reset={vi.fn()} />);
    expect(screen.getByText('Réessayer')).toBeInTheDocument();
  });

  it('calls reset on retry click', () => {
    const error = new Error('Test') as Error & { digest?: string };
    const reset = vi.fn();
    render(<CoursesError error={error} reset={reset} />);
    fireEvent.click(screen.getByText('Réessayer'));
    expect(reset).toHaveBeenCalled();
  });

  it('renders browse other courses link', () => {
    const error = new Error('Test') as Error & { digest?: string };
    const { container } = render(<CoursesError error={error} reset={vi.fn()} />);
    const link = container.querySelector('a[href="/courses"]');
    expect(link).toBeInTheDocument();
  });

  it('shows error digest when present', () => {
    const error = Object.assign(new Error('Test'), { digest: 'xyz789' }) as Error & { digest?: string };
    render(<CoursesError error={error} reset={vi.fn()} />);
    expect(screen.getByText(/xyz789/)).toBeInTheDocument();
  });
});

describe('CoursesLoading', () => {
  it('renders with animate-pulse', () => {
    const { container } = render(<CoursesLoading />);
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders 6 course card placeholders', () => {
    const { container } = render(<CoursesLoading />);
    const cards = container.querySelectorAll('.grid > div');
    expect(cards.length).toBe(6);
  });

  it('renders thumbnail placeholders', () => {
    const { container } = render(<CoursesLoading />);
    const thumbnails = container.querySelectorAll('.h-36');
    expect(thumbnails.length).toBe(6);
  });
});
