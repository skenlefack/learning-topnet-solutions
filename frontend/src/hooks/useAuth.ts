'use client';
// ============================================================================
// AU-IBAR Learning — useAuth Hook
// Checks authentication, redirects to login, handles token refresh + login/logout
// ============================================================================
import { useEffect, useCallback } from 'react';
import { useAuthStore } from '@/lib/store';

export function useAuth() {
  const { user, token, isAuthenticated, setAuth, logout: storeLogout } = useAuthStore();

  // Note: redirect is handled by the Edge middleware (middleware.ts)
  // which checks the aris-token cookie server-side. No client-side
  // redirect needed here — it caused race conditions on navigation.

  // Login
  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch('/api/learning/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      credentials: 'include',
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');

    setAuth(data.user, data.token);
    document.cookie = `aris-token=${data.token}; path=/; max-age=${60 * 60 * 24}; samesite=lax`;

    return data;
  }, [setAuth]);

  // Logout — clear store + cookie + redirect
  const logout = useCallback(() => {
    storeLogout();
    document.cookie = 'aris-token=; path=/; max-age=0; samesite=lax';
    window.location.href = '/';
  }, [storeLogout]);

  // Token expiry check — logout only when token is actually expired
  useEffect(() => {
    if (!token) return;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (!payload.exp) return; // No expiry claim — skip
      const expiresAt = payload.exp * 1000;
      const timeUntilExpiry = expiresAt - Date.now();

      if (timeUntilExpiry <= 0) {
        logout();
        return;
      }

      const timer = setTimeout(logout, timeUntilExpiry);
      return () => clearTimeout(timer);
    } catch {
      // Invalid token format — ignore
    }
  }, [token, logout]);

  return { user, token, isAuthenticated, login, logout };
}
