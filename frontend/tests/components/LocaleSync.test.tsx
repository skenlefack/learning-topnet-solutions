// ============================================================================
// Topnet Solutions Academy — Component Test: LocaleSync
// Syncs Zustand language to cookie + html lang/dir
// ============================================================================
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import LocaleSync from '@/app/_components/LocaleSync';

let mockLanguage = 'fr';

vi.mock('@/lib/store', () => ({
  useAuthStore: (selector: any) => selector({ language: mockLanguage }),
}));

describe('LocaleSync', () => {
  beforeEach(() => {
    document.documentElement.lang = '';
    document.documentElement.dir = '';
    document.cookie = '';
    mockLanguage = 'fr';
  });

  it('renders nothing (returns null)', () => {
    const { container } = render(<LocaleSync />);
    expect(container.innerHTML).toBe('');
  });

  it('sets html lang attribute to current language', () => {
    render(<LocaleSync />);
    expect(document.documentElement.lang).toBe('fr');
  });

  it('sets dir=ltr for non-RTL languages', () => {
    render(<LocaleSync />);
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('sets dir=rtl for Arabic', () => {
    mockLanguage = 'ar';
    render(<LocaleSync />);
    expect(document.documentElement.dir).toBe('rtl');
  });

  it('sets locale cookie', () => {
    render(<LocaleSync />);
    expect(document.cookie).toContain('topnet-locale=fr');
  });
});
