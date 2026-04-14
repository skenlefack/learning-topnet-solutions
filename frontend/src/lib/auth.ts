// ============================================================================
// AU-IBAR Learning — JWT Auth Utilities
// Edge-compatible (jose) for use in middleware + API routes
// ============================================================================
import { SignJWT, jwtVerify } from 'jose';

const AUTH_SECRET = process.env.AUTH_SECRET || 'aris-academy-dev-secret-2026';
export const AUTH_COOKIE_NAME = 'aris-token';

const secret = new TextEncoder().encode(AUTH_SECRET);

export async function signToken(payload: Record<string, unknown>): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(secret);
}

export async function verifyToken(token: string): Promise<Record<string, unknown> | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function buildCookieHeader(token: string): string {
  return `${AUTH_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24}`;
}

export function buildClearCookieHeader(): string {
  return `${AUTH_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
