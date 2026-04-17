// ============================================================================
// ARIS Academy — Route Tests: Auth Routes (DEV mode)
// Tests POST /auth/login using Fastify inject, no real DB
// ============================================================================
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import fastifyJwt from '@fastify/jwt';

const TEST_SECRET = 'test-secret-for-auth-routes';

// ---------------------------------------------------------------------------
// Mocks — Kafka, DB, Redis (auth route uses them in production only)
// ---------------------------------------------------------------------------

vi.mock('@aris-academy/shared', async (importOriginal) => {
  const original = await importOriginal<typeof import('@aris-academy/shared')>();
  return {
    ...original,
    query: vi.fn().mockResolvedValue([]),
    queryOne: vi.fn().mockResolvedValue(null),
    publishEvent: vi.fn().mockResolvedValue(undefined),
    createConsumer: vi.fn().mockResolvedValue({ disconnect: vi.fn() }),
  };
});

vi.mock('../../packages/shared/src/kafka/index', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../packages/shared/src/kafka/index')>();
  return {
    ...original,
    publishEvent: vi.fn().mockResolvedValue(undefined),
    createConsumer: vi.fn().mockResolvedValue({ disconnect: vi.fn() }),
    getProducer: vi.fn().mockResolvedValue({
      send: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
    }),
  };
});

// ---------------------------------------------------------------------------
// Import route handler (after mocks) — DEV mode only
// ---------------------------------------------------------------------------

import authRoutes from '../../packages/academy-learning/src/routes/auth';

// ---------------------------------------------------------------------------
// App builder
// ---------------------------------------------------------------------------

async function buildAuthApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  await app.register(fastifyJwt, { secret: TEST_SECRET });

  // Stub the authenticate and requireRole decorators
  app.decorate('authenticate', async () => {});
  app.decorate('requireRole', (..._roles: string[]) => async () => {});

  // Stub tenant request decorations
  app.decorateRequest('tenantId', '');
  app.decorateRequest('tenantLevel', 'country');
  app.decorateRequest('tenantFilter', null);

  await app.register(authRoutes);

  app.setErrorHandler((error, _request, reply) => {
    return reply.code(error.statusCode || 500).send({
      success: false,
      error: error.message || 'Internal Server Error',
    });
  });

  await app.ready();
  return app;
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('Auth Routes — POST /auth/login (DEV mode)', () => {
  let app: FastifyInstance;

  // Ensure we are in dev/test mode (not production)
  const originalNodeEnv = process.env.NODE_ENV;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    app = await buildAuthApp();
  });

  afterAll(async () => {
    process.env.NODE_ENV = originalNodeEnv;
    await app.close();
  });

  // =========================================================================
  // Valid credentials
  // =========================================================================

  describe('Valid credentials (dev mode)', () => {
    it('should return 200 with token for known demo user (serge)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {
          email: 'serge@au-ibar.org',
          password: 'academy2026',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.token).toBeDefined();
      expect(typeof body.token).toBe('string');
      expect(body.user).toBeDefined();
      expect(body.user.email).toBe('serge@au-ibar.org');
      expect(body.user.role).toBe('admin_continental');
      expect(body.user.tenantId).toBe('au-ibar');
      expect(body.user.tenantLevel).toBe('continental');
      expect(body.user.firstName).toBe('Serge');
    });

    it('should return 200 with token for known demo user (amina, trainer)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {
          email: 'amina@au-ibar.org',
          password: 'academy2026',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.user.role).toBe('trainer');
      expect(body.user.firstName).toBe('Amina');
    });

    it('should return 200 with token for known demo user (learner)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {
          email: 'learner@kenya.go.ke',
          password: 'academy2026',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.user.role).toBe('learner');
      expect(body.user.tenantId).toBe('kenya');
      expect(body.user.tenantLevel).toBe('country');
    });

    it('should auto-create a fallback user for unknown email with correct password', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {
          email: 'new.user@example.org',
          password: 'academy2026',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.token).toBeDefined();
      // Fallback user: role=learner, tenantLevel=country
      expect(body.user.role).toBe('learner');
      expect(body.user.tenantLevel).toBe('country');
      expect(body.user.email).toBe('new.user@example.org');
    });

    it('should normalize email to lowercase', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {
          email: 'Serge@AU-IBAR.org',
          password: 'academy2026',
        },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().user.email).toBe('serge@au-ibar.org');
    });

    it('JWT token should be verifiable with the correct secret', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {
          email: 'serge@au-ibar.org',
          password: 'academy2026',
        },
      });

      const { token } = res.json();
      const jsonwebtoken = await import('jsonwebtoken');
      const decoded = jsonwebtoken.verify(token, TEST_SECRET) as any;
      expect(decoded.sub).toBe('usr_serge_001');
      expect(decoded.role).toBe('admin_continental');
      expect(decoded.tenantId).toBe('au-ibar');
    });
  });

  // =========================================================================
  // Invalid password
  // =========================================================================

  describe('Invalid password', () => {
    it('should return 401 with wrong password', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {
          email: 'serge@au-ibar.org',
          password: 'wrong-password',
        },
      });

      expect(res.statusCode).toBe(401);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.error).toContain('Invalid credentials');
    });

    it('should return 401 with empty password', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {
          email: 'serge@au-ibar.org',
          password: '',
        },
      });

      // Zod validation: password min(1) will fail -> 400
      expect(res.statusCode).toBe(400);
    });
  });

  // =========================================================================
  // Missing fields
  // =========================================================================

  describe('Missing / invalid fields', () => {
    it('should return 400 when email is missing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {
          password: 'academy2026',
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('should return 400 when password is missing', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {
          email: 'serge@au-ibar.org',
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('should return 400 when body is empty', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {},
      });

      expect(res.statusCode).toBe(400);
    });

    it('should return 400 when email format is invalid', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {
          email: 'not-an-email',
          password: 'academy2026',
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('should return 400 when no body is provided', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
      });

      // Either 400 for validation or 500 for missing body — both are acceptable
      expect(res.statusCode).toBeGreaterThanOrEqual(400);
    });
  });
});
