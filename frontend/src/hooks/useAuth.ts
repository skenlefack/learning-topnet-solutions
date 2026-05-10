'use client';
// ============================================================================
// AU-IBAR Learning — useAuth Hook
// Checks authentication, redirects to login, handles token refresh + login/logout
// ============================================================================
import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';

export function useAuth() {
  const router = useRouter();
  const { user, token, isAuthenticated, _hydrated, setAuth, logout: storeLogout } = useAuthStore();

  // Redirect if not authenticated (only after store hydration from localStorage)
  useEffect(() => {
    if (!_hydrated) return; // Wait for localStorage to be loaded
    if (!isAuthenticated || !token) {
      router.replace('/login');
    }
  }, [isAuthenticated, token, _hydrated, router]);

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

  // Logout — clear store + cookie
  const logout = useCallback(() => {
    storeLogout();
    document.cookie = 'aris-token=; path=/; max-age=0; samesite=lax';
    router.replace('/login');
  }, [storeLogout, router]);

  // Token expiry check — logout only when token is actually expired
  useEffect(() => {
    if (!token) return;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expiresAt = payload.exp * 1000;
      const timeUntilExpiry = expiresAt - Date.now();

      if (timeUntilExpiry <= 0) {
        // Token already expired — logout
        logout();
        return;
      }

      // Schedule logout when token expires (JWT has 24h validity)
      const timer = setTimeout(() => {
        logout();
      }, timeUntilExpiry);

      return () => clearTimeout(timer);
    } catch {
      // Invalid token format — ignore
    }
  }, [token, logout]);

  return { user, token, isAuthenticated, login, logout };
}
