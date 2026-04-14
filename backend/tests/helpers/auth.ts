// ============================================================================
// Test Helper — JWT signing + Fastify app builder
// Pure unit-test helpers: no DB, no external services required
// ============================================================================
import Fastify, { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import fastifyJwt from '@fastify/jwt';

const TEST_SECRET = 'test-secret';

export interface TestJwtPayload {
  sub: string;
  email: string;
  role: string;
  tenantId: string;
  tenantLevel: string;
  firstName?: string;
  lastName?: string;
}

/**
 * Sign a JWT token for testing using jsonwebtoken directly.
 * Does not require a running Fastify instance.
 */
export function signTestJwt(payload: Partial<TestJwtPayload> = {}, secret = TEST_SECRET): string {
  const defaults: TestJwtPayload = {
    sub: 'test-user-001',
    email: 'test@au-ibar.org',
    role: 'learner',
    tenantId: 'tenant-continental-001',
    tenantLevel: 'continental',
  };

  return jwt.sign({ ...defaults, ...payload }, secret, { expiresIn: '1h' });
}

/**
 * Build a minimal Fastify app with JWT + a no-op authenticate decorator.
 * Suitable for unit-testing routes without real auth/DB.
 */
export async function buildTestApp(
  registerRoutes: (app: FastifyInstance) => Promise<void>,
): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  await app.register(fastifyJwt, { secret: TEST_SECRET });

  // No-op authenticate decorator — tests can override per-request via headers
  app.decorate('authenticate', async () => {});

  // Stub tenant request decorations
  app.decorateRequest('tenantId', '');
  app.decorateRequest('tenantLevel', 'country');
  app.decorateRequest('tenantFilter', null);

  // Register the routes under test
  await registerRoutes(app);

  await app.ready();
  return app;
}
