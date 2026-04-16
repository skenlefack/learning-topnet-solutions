// ============================================================================
// ARIS Academy — Middleware Test
// Tests route protection, public paths, cookie checks, redirects
// ============================================================================
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// ---------------------------------------------------------------------------
// Mock next/server
// ---------------------------------------------------------------------------

vi.mock('next/server', () => {
  const nextFn = vi.fn(() => ({ type: 'next' }));
  const redirectFn = vi.fn((url: URL) => ({ type: 'redirect', url: url.toString() }));

  return {
    NextRequest: vi.fn().mockImplementation((url: string) => {
      const parsedUrl = new URL(url, 'https://learning.au-ibar.org');
      // Next.js NextURL extends URL with a clone() method — replicate for tests
      (parsedUrl as any).clone = () => {
        const cloned = new URL(parsedUrl.toString());
        (cloned as any).clone = (parsedUrl as any).clone;
        return cloned;
      };
      const cookies = new Map<string, { value: string }>();
      return {
        nextUrl: parsedUrl,
        cookies: {
          get: (name: string) => cookies.get(name),
          _set: (name: string, value: string) => cookies.set(name, { value }),
        },
      };
    }),
    NextResponse: {
      next: nextFn,
      redirect: redirectFn,
    },
  };
});

// Import after mock
import { middleware } from '@/middleware';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function createRequest(pathname: string, token?: string) {
  const req = new NextRequest(`https://learning.au-ibar.org${pathname}`);
  if (token) {
    (req.cookies as any)._set('aris-token', token);
  }
  return req;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Edge Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // Public paths — should pass through without auth
  // =========================================================================

  describe('Public paths', () => {
    it('should allow /login without auth', () => {
      const req = createRequest('/login');
      middleware(req);
      expect(NextResponse.next).toHaveBeenCalled();
      expect(NextResponse.redirect).not.toHaveBeenCalled();
    });

    it('should allow /auth/callback without auth', () => {
      const req = createRequest('/auth/callback');
      middleware(req);
      expect(NextResponse.next).toHaveBeenCalled();
    });

    it('should allow /api/auth/login without auth', () => {
      const req = createRequest('/api/auth/login');
      middleware(req);
      expect(NextResponse.next).toHaveBeenCalled();
    });

    it('should allow /api/auth/me without auth', () => {
      const req = createRequest('/api/auth/me');
      middleware(req);
      expect(NextResponse.next).toHaveBeenCalled();
    });

    it('should allow /verify/ARIS-2024-KE-00142 without auth', () => {
      const req = createRequest('/verify/ARIS-2024-KE-00142');
      middleware(req);
      expect(NextResponse.next).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Protected paths — should redirect without auth
  // =========================================================================

  describe('Protected paths', () => {
    it('should redirect / to /login when no token', () => {
      const req = createRequest('/');
      middleware(req);
      expect(NextResponse.redirect).toHaveBeenCalled();
      const redirectUrl = (NextResponse.redirect as any).mock.calls[0][0];
      expect(redirectUrl.pathname).toBe('/login');
      expect(redirectUrl.searchParams.get('redirect')).toBe('/');
    });

    it('should redirect /courses to /login when no token', () => {
      const req = createRequest('/courses');
      middleware(req);
      expect(NextResponse.redirect).toHaveBeenCalled();
      const redirectUrl = (NextResponse.redirect as any).mock.calls[0][0];
      expect(redirectUrl.searchParams.get('redirect')).toBe('/courses');
    });

    it('should redirect /admin to /login when no token', () => {
      const req = createRequest('/admin');
      middleware(req);
      expect(NextResponse.redirect).toHaveBeenCalled();
    });

    it('should redirect /profile to /login when no token', () => {
      const req = createRequest('/profile');
      middleware(req);
      expect(NextResponse.redirect).toHaveBeenCalled();
    });

    it('should redirect /live to /login when no token', () => {
      const req = createRequest('/live');
      middleware(req);
      expect(NextResponse.redirect).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Authenticated paths — should pass through
  // =========================================================================

  describe('Authenticated paths', () => {
    it('should allow / with valid token', () => {
      const req = createRequest('/', 'valid-jwt-token');
      middleware(req);
      expect(NextResponse.next).toHaveBeenCalled();
      expect(NextResponse.redirect).not.toHaveBeenCalled();
    });

    it('should allow /courses with valid token', () => {
      const req = createRequest('/courses', 'valid-jwt-token');
      middleware(req);
      expect(NextResponse.next).toHaveBeenCalled();
    });

    it('should allow /admin with valid token', () => {
      const req = createRequest('/admin', 'valid-jwt-token');
      middleware(req);
      expect(NextResponse.next).toHaveBeenCalled();
    });
  });
});
