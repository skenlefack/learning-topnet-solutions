'use client';
// ============================================================================
// AU-IBAR Learning — useAuth Hook
// Checks authentication, redirects to login, handles token refresh + login/logout
// ============================================================================
import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';

const SSO_URL = process.env.NEXT_PUBLIC_ARIS_SSO_URL || 'https://au-ibar.org/api/auth';

export function useAuth() {
  const router = useRouter();
  const { user, token, isAuthenticated, setAuth, logout: storeLogout } = useAuthStore();

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated || !token) {
      router.replace('/login');
    }
  }, [isAuthenticated, token, router]);

  // Login via mock API
  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      credentials: 'include',
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');

    setAuth(data.user, data.token);

    // Set client-side cookie as backup (httpOnly set by API response)
    document.cookie = `aris-token=${data.token}; path=/; max-age=${60 * 60 * 24}; samesite=lax`;

    return data;
  }, [setAuth]);

  // Logout — clear store + cookie
  const logout = useCallback(() => {
    storeLogout();
    document.cookie = 'aris-token=; path=/; max-age=0; samesite=lax';
    router.replace('/login');
  }, [storeLogout, router]);

  // Refresh token — call SSO refresh endpoint
  const refreshToken = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${SSO_URL}/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        logout();
        return;
      }
      const data = await res.json();
      if (data.token && data.user) {
        setAuth(data.user, data.token);
        // Sync cookie on refresh
        document.cookie = `aris-token=${data.token}; path=/; max-age=${60 * 60 * 24}; samesite=lax`;
      }
    } catch {
      logout();
    }
  }, [token, setAuth, logout]);

  // Schedule refresh 5 minutes before expiry
  useEffect(() => {
    if (!token) return;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expiresAt = payload.exp * 1000;
      const refreshAt = expiresAt - 5 * 60 * 1000;
      const delay = refreshAt - Date.now();
      if (delay <= 0) {
        refreshToken();
        return;
      }
      const timer = setTimeout(refreshToken, delay);
      return () => clearTimeout(timer);
    } catch {
      // Invalid token format
    }
  }, [token, refreshToken]);

  return { user, token, isAuthenticated, login, logout };
}
