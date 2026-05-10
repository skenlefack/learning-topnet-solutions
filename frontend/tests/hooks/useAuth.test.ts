// ============================================================================
// ARIS Academy — Hook Test: useAuth
// Tests login, logout, token refresh, redirect behavior
// ============================================================================
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAuthStore } from '@/lib/store';
import { server } from '../mocks/server';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPush = vi.fn();
const mockReplace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));

// Stop the global MSW server for this file so we can stub fetch directly.
// The shared setup (tests/setup.tsx) starts the MSW interceptor, which wraps
// global.fetch and breaks plain object mocks (Response.clone is not a function).
beforeAll(() => server.close());
afterAll(() => server.listen({ onUnhandledRequest: 'warn' }));

// Mock fetch globally with proper Response objects
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Helper: build a minimal Response-like object usable by useAuth (only .ok / .json())
const makeResponse = (status: number, body: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

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

    mockFetch.mockResolvedValueOnce(makeResponse(200, { user: mockUser, token: mockToken }));

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
    mockFetch.mockResolvedValueOnce(makeResponse(401, { error: 'Invalid credentials' }));

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

  it('should logout when token is expired', async () => {
    // Create an already-expired token
    const exp = Math.floor(Date.now() / 1000) - 60; // expired 1 min ago
    const payload = btoa(JSON.stringify({ sub: 'u1', exp }));
    const fakeToken = `header.${payload}.signature`;

    useAuthStore.setState({
      user: { id: 'u1' } as any,
      token: fakeToken,
      isAuthenticated: true,
    });

    renderHook(() => useAuth());

    // Should have logged out (store cleared)
    await waitFor(() => {
      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
    });
  });
});
