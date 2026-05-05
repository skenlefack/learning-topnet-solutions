// ============================================================================
// ARIS Academy — Component Test: ThemeProvider
// Applies dark class to documentElement based on Zustand theme
// ============================================================================
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import ThemeProvider from '@/app/_components/ThemeProvider';

let mockTheme = 'light';

vi.mock('@/lib/store', () => ({
  useAuthStore: (selector: any) => selector({ theme: mockTheme }),
}));

describe('ThemeProvider', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('dark');
    mockTheme = 'light';
  });

  it('renders children', () => {
    render(
      <ThemeProvider>
        <span data-testid="child">Hello</span>
      </ThemeProvider>,
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('does not add dark class in light mode', () => {
    render(<ThemeProvider><span>x</span></ThemeProvider>);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('adds dark class in dark mode', () => {
    mockTheme = 'dark';
    render(<ThemeProvider><span>x</span></ThemeProvider>);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('removes dark class when switching to light', () => {
    document.documentElement.classList.add('dark');
    mockTheme = 'light';
    render(<ThemeProvider><span>x</span></ThemeProvider>);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});
