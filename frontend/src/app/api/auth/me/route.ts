// ============================================================================
// AU-IBAR Learning — Me Endpoint
// GET with Authorization: Bearer <token> → returns user from JWT claims
// ============================================================================
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const payload = await verifyToken(token);
  if (!payload) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  return NextResponse.json({
    user: {
      id: payload.sub,
      email: payload.email,
      firstName: payload.firstName,
      lastName: payload.lastName,
      role: payload.role,
      tenantId: payload.tenantId,
      tenantLevel: payload.tenantLevel,
      preferredLanguage: payload.preferredLanguage,
    },
  });
}
