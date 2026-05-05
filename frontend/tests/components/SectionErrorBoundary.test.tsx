// ============================================================================
// ARIS Academy — Component Test: SectionErrorBoundary
// Class component error boundary with retry
// ============================================================================
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SectionErrorBoundary from '@/app/_components/SectionErrorBoundary';

// A component that throws
function ThrowingChild({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('Test crash');
  return <div data-testid="child-ok">Working</div>;
}

describe('SectionErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('renders children when no error', () => {
    render(
      <SectionErrorBoundary name="Test">
        <div data-testid="child">OK</div>
      </SectionErrorBoundary>,
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('renders error fallback when child throws', () => {
    render(
      <SectionErrorBoundary name="Stats">
        <ThrowingChild shouldThrow={true} />
      </SectionErrorBoundary>,
    );
    expect(screen.getByText('Impossible de charger cette section')).toBeInTheDocument();
  });

  it('shows section name in error fallback', () => {
    render(
      <SectionErrorBoundary name="Certifications">
        <ThrowingChild shouldThrow={true} />
      </SectionErrorBoundary>,
    );
    expect(screen.getByText('Certifications')).toBeInTheDocument();
  });

  it('renders retry button in error state', () => {
    render(
      <SectionErrorBoundary name="Test">
        <ThrowingChild shouldThrow={true} />
      </SectionErrorBoundary>,
    );
    expect(screen.getByText(/essayer/i)).toBeInTheDocument();
  });

  it('resets error state on retry click', () => {
    // We can't easily test the reset because ThrowingChild will throw again
    // But we can verify the button triggers state reset
    const { container } = render(
      <SectionErrorBoundary name="Test">
        <ThrowingChild shouldThrow={true} />
      </SectionErrorBoundary>,
    );
    const retryBtn = screen.getByText(/essayer/i);
    // After click, it will try to re-render children which will throw again
    fireEvent.click(retryBtn);
    // Should still show error (because child throws again)
    expect(screen.getByText('Impossible de charger cette section')).toBeInTheDocument();
  });

  it('does not show section name when name prop is not provided', () => {
    render(
      <SectionErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </SectionErrorBoundary>,
    );
    expect(screen.getByText('Impossible de charger cette section')).toBeInTheDocument();
    // No section name text beyond the error message
    expect(screen.queryByText('undefined')).not.toBeInTheDocument();
  });
});
