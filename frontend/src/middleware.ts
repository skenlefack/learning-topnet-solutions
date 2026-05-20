// ============================================================================
// AU-IBAR Learning — Edge Middleware
// Protects all routes except public paths; redirects to /login if no cookie
// ============================================================================
import { NextRequest, NextResponse } from 'next/server';

const AUTH_COOKIE_NAME = 'aris-token';

const PUBLIC_PATHS = ['/login', '/auth/callback', '/api/', '/verify', '/catalog'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Landing page is always public
  if (pathname === '/') {
    return NextResponse.next();
  }

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;

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
