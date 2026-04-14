// ============================================================================
// AU-IBAR Learning — Mock Login API
// POST { email, password } → { token, user } + Set-Cookie
// ============================================================================
import { NextRequest, NextResponse } from 'next/server';
import { signToken, buildCookieHeader } from '@/lib/auth';

const DEV_PASSWORD = 'academy2026';

const DEMO_USERS: Record<string, { id: string; firstName: string; lastName: string; role: string; tenantId: string; tenantLevel: string; preferredLanguage: string }> = {
  'serge@au-ibar.org': {
    id: 'usr_serge_001',
    firstName: 'Serge',
    lastName: 'Nakouzi',
    role: 'admin_continental',
    tenantId: 'au-ibar',
    tenantLevel: 'continental',
    preferredLanguage: 'fr',
  },
  'amina@au-ibar.org': {
    id: 'usr_amina_002',
    firstName: 'Amina',
    lastName: 'Diallo',
    role: 'trainer',
    tenantId: 'au-ibar',
    tenantLevel: 'continental',
    preferredLanguage: 'fr',
  },
  'learner@kenya.go.ke': {
    id: 'usr_learner_003',
    firstName: 'James',
    lastName: 'Ochieng',
    role: 'learner',
    tenantId: 'kenya',
    tenantLevel: 'country',
    preferredLanguage: 'en',
  },
};

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    if (password !== DEV_PASSWORD) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Look up demo user or generate one from email parts
    const demoUser = DEMO_USERS[normalizedEmail];
    const user = demoUser
      ? { ...demoUser, email: normalizedEmail }
      : {
          id: `usr_${normalizedEmail.replace(/[^a-z0-9]/g, '_')}`,
          email: normalizedEmail,
          firstName: normalizedEmail.split('@')[0].split('.')[0].replace(/^\w/, (c: string) => c.toUpperCase()),
          lastName: normalizedEmail.split('@')[0].split('.').slice(1).join(' ').replace(/^\w/, (c: string) => c.toUpperCase()) || 'User',
          role: 'learner',
          tenantId: normalizedEmail.split('@')[1]?.split('.')[0] || 'default',
          tenantLevel: 'country',
          preferredLanguage: 'en',
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
