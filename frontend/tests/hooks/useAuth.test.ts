// ============================================================================
// ARIS Academy — Hook Test: useAuth
// Tests login, logout, token refresh, redirect behavior
// ============================================================================
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAuthStore } from '@/lib/store';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPush = vi.fn();
const mockReplace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock document.cookie
Object.defineProperty(document, 'cookie', {
  writable: true,
  value: '',
});

// Import after mocks
import { useAuth } from '@/hooks/useAuth';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useAuth hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.cookie = '';
    useAuthStore.setState({
      user: null,
      token: null,
      isAuthenticated: false,
      theme: 'light',
      language: 'fr',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // Redirect when not authenticated
  // =========================================================================

  it('should redirect to /login when not authenticated', () => {
    renderHook(() => useAuth());
    expect(mockReplace).toHaveBeenCalledWith('/login');
  });

  it('should not redirect when authenticated', () => {
    useAuthStore.setState({
      user: { id: 'u1', email: 'test@test.org' } as any,
      token: 'valid-token',
      isAuthenticated: true,
    });

    renderHook(() => useAuth());
    expect(mockReplace).not.toHaveBeenCalled();
  });

  // =========================================================================
  // Login
  // =========================================================================

  it('should login successfully and set auth state', async () => {
    const mockUser = { id: 'u1', email: 'test@test.org', role: 'learner' };
    const mockToken = 'jwt-token-123';

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ user: mockUser, token: mockToken }),
    });

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.login('test@test.org', 'password123');
    });

    const state = useAuthStore.getState();
    expect(state.user).toEqual(mockUser);
    expect(state.token).toBe(mockToken);
    expect(state.isAuthenticated).toBe(true);
    expect(document.cookie).toContain('aris-token=jwt-token-123');
  });

  it('should throw error on login failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Invalid credentials' }),
    });

    const { result } = renderHook(() => useAuth());

    await expect(
      act(async () => {
        await result.current.login('bad@test.org', 'wrong');
      }),
    ).rejects.toThrow('Invalid credentials');
  });

  // =========================================================================
  // Logout
  // =========================================================================

  it('should logout, clear state and redirect', () => {
    useAuthStore.setState({
      user: { id: 'u1' } as any,
      token: 'token',
      isAuthenticated: true,
    });

    const { result } = renderHook(() => useAuth());

    act(() => {
      result.current.logout();
    });

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.token).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(mockReplace).toHaveBeenCalledWith('/login');
    expect(document.cookie).toContain('max-age=0');
  });

  // =========================================================================
  // Token refresh
  // =========================================================================

  it('should schedule token refresh before expiry', async () => {
    vi.useFakeTimers();

    // Create a token that expires in 10 minutes
    const exp = Math.floor(Date.now() / 1000) + 600;
    const payload = btoa(JSON.stringify({ sub: 'u1', exp }));
    const fakeToken = `header.${payload}.signature`;

    const refreshedUser = { id: 'u1', email: 'refreshed@test.org' };
    const refreshedToken = 'refreshed-token';

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ user: refreshedUser, token: refreshedToken }),
    });

    useAuthStore.setState({
      user: { id: 'u1' } as any,
      token: fakeToken,
      isAuthenticated: true,
    });

    renderHook(() => useAuth());

    // Fast forward to 5 min before expiry (should trigger refresh)
    await act(async () => {
      vi.advanceTimersByTime(5 * 60 * 1000 + 1000);
    });

    // Refresh should have been called
    expect(mockFetch).toHaveBeenCalled();

    vi.useRealTimers();
  });
});
