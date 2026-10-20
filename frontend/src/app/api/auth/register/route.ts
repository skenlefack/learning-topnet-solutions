// ============================================================================
// Topnet Solutions Academy — Mock Register API
// POST { firstName, lastName, email, password } → { token, user } + Set-Cookie
// ============================================================================
import { NextRequest, NextResponse } from 'next/server';
import { signToken, buildCookieHeader } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { firstName, lastName, email, password } = await req.json();

    if (!firstName || !lastName || !email || !password) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 },
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 },
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    const user = {
      id: `usr_${normalizedEmail.replace(/[^a-z0-9]/g, '_')}`,
      email: normalizedEmail,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      role: 'learner',
      tenantId: 'topnet-solutions',
      tenantLevel: 'continental',
      preferredLanguage: 'fr',
    };

    const token = await signToken({
      sub: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      tenantId: user.tenantId,
      tenantLevel: user.tenantLevel,
      preferredLanguage: user.preferredLanguage,
    });

    const res = NextResponse.json({ token, user });
    res.headers.set('Set-Cookie', buildCookieHeader(token));
    return res;
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
