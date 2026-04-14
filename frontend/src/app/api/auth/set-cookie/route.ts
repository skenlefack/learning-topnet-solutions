// ============================================================================
// AU-IBAR Learning — Set Cookie API
// POST { token } → verifies JWT, sets aris-token httpOnly cookie
// Used by SSO callback to persist auth server-side
// ============================================================================
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, buildCookieHeader } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const res = NextResponse.json({ ok: true });
    res.headers.set('Set-Cookie', buildCookieHeader(token));
    return res;
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
