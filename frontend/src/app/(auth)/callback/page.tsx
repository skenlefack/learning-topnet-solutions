'use client';
// ============================================================================
// AU-IBAR Learning — SSO Callback Page
// Receives JWT from ARIS Credential Service, stores in zustand + cookie,
// redirects to dashboard
// ============================================================================
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, AlertTriangle } from 'lucide-react';
import { useAuthStore } from '@/lib/store';

function SSOCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get('token');
    const errorParam = searchParams.get('error');

    if (errorParam) {
      setError(errorParam);
      return;
    }

    if (!token) {
      setError('No token received from SSO provider');
      return;
    }

    try {
      // Decode the JWT payload
      const parts = token.split('.');
      if (parts.length !== 3) throw new Error('Invalid JWT format');

      const payload = JSON.parse(atob(parts[1]));

      const user = {
        id: payload.sub,
        email: payload.email,
        firstName: payload.firstName || payload.first_name || '',
        lastName: payload.lastName || payload.last_name || '',
        role: payload.role,
        tenantId: payload.tenantId || payload.tenant_id,
        tenantLevel: payload.tenantLevel || payload.tenant_level || 'country',
        preferredLanguage: payload.preferredLanguage || payload.preferred_language || 'fr',
        avatarUrl: payload.avatarUrl || payload.avatar_url,
      };

      // Store in zustand (persisted to localStorage)
      setAuth(user, token);

      // Set client-side cookie immediately
      document.cookie = `aris-token=${token}; path=/; max-age=${60 * 60 * 24}; samesite=lax`;

      // Also set httpOnly cookie via server endpoint for SSR
      fetch('/api/auth/set-cookie', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
        credentials: 'include',
      }).catch(() => {
        // Cookie set is best-effort — zustand is the primary store
      });

      // Redirect to dashboard (or to the originally requested page)
      const redirect = searchParams.get('redirect') || '/dashboard';
      router.replace(redirect);
    } catch (err) {
      setError('Failed to process authentication token');
    }
  }, [searchParams, setAuth, router]);

  if (error) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md mx-auto px-4">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto" />
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Erreur d&apos;authentification</h2>
          <p className="text-sm text-[var(--text-secondary)]">{error}</p>
          <a
            href="/login"
            className="inline-block px-4 py-2 bg-brand-navy text-white rounded-lg text-sm font-medium hover:bg-brand-navy-deep transition-colors"
          >
            Reessayer
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
      <div className="text-center space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-brand-navy dark:text-brand-gold mx-auto" />
        <p className="text-sm text-[var(--text-secondary)]">Authentification en cours...</p>
      </div>
    </div>
  );
}

export default function SSOCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-brand-navy dark:text-brand-gold mx-auto" />
        </div>
      }
    >
      <SSOCallbackInner />
    </Suspense>
  );
}
