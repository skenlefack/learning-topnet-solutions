// ============================================================================
// Topnet Solutions Academy — Edge Middleware
// Protects all routes except public paths; redirects to /login if no cookie
// ============================================================================
import { NextRequest, NextResponse } from 'next/server';

const AUTH_COOKIE_NAME = 'topnet-token';

const PUBLIC_PATHS = ['/login', '/register', '/auth/callback', '/api/', '/verify', '/catalog', '/category', '/paths', '/skills', '/shop', '/sponsor', '/test'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;

  // Landing page: public for visitors, redirect to /dashboard for authenticated
  if (pathname === '/') {
    if (token) {
      const url = req.nextUrl.clone();
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = '/';
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
