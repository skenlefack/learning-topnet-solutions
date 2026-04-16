// ============================================================================
// ARIS Academy — Route Tests: Admin Routes
// Tests user management, stats, tenants (no real DB)
// ============================================================================
import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import jwt from 'jsonwebtoken';

const TEST_SECRET = 'test-secret-for-admin-routes';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockQuery = vi.fn();
const mockQueryOne = vi.fn();
const mockPaginate = vi.fn();

vi.mock('@fastify/rate-limit', () => ({
  default: vi.fn(),
}));

vi.mock('@aris-academy/shared', async (importOriginal) => {
  const original = await importOriginal<typeof import('@aris-academy/shared')>();
  return {
    ...original,
    query: (...args: any[]) => mockQuery(...args),
    queryOne: (...args: any[]) => mockQueryOne(...args),
    paginate: (...args: any[]) => mockPaginate(...args),
    transaction: vi.fn().mockImplementation(async (fn) => fn({
      query: vi.fn().mockResolvedValue([{ id: 'usr-new' }]),
    })),
    cacheDel: vi.fn().mockResolvedValue(undefined),
    publishEvent: vi.fn().mockResolvedValue(undefined),
    auditLog: vi.fn().mockResolvedValue(undefined),
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
      send: vi.fn(), connect: vi.fn(), disconnect: vi.fn(),
    }),
  };
});

// ---------------------------------------------------------------------------
// Import routes after mocks
// ---------------------------------------------------------------------------

import { authPlugin } from '@aris-academy/shared';
import adminRoutes from '../../packages/academy-learning/src/routes/admin';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function signToken(payload: Record<string, any> = {}): string {
  const defaults = {
    sub: 'usr-admin-001',
    email: 'admin@au-ibar.org',
    role: 'admin_continental',
    tenantId: 'au-ibar',
    tenantLevel: 'continental',
    firstName: 'Admin',
    lastName: 'Test',
  };
  return jwt.sign({ ...defaults, ...payload }, TEST_SECRET, { expiresIn: '1h' });
}

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(fastifyJwt, { secret: TEST_SECRET });
  await app.register(authPlugin);

  app.decorateRequest('tenantFilter', null);
  app.addHook('preHandler', async (request) => {
    if (request.user) {
      request.tenantId = request.user.tenantId;
      request.tenantLevel = request.user.tenantLevel;
    }
    request.tenantFilter = () => ({ clause: '1=1', params: [] });
  });

  await app.register(adminRoutes);

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
// Tests
// ---------------------------------------------------------------------------

describe('Admin Routes — API (Fastify inject)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // GET /admin/stats
  // =========================================================================

  describe('GET /admin/stats', () => {
    it('should return 200 with stats for admin', async () => {
      mockQueryOne.mockResolvedValue({ total_users: 100, total_enrollments: 250 });
      mockQuery.mockResolvedValue([]);

      const res = await app.inject({
        method: 'GET',
        url: '/admin/stats',
        headers: { authorization: `Bearer ${signToken()}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
    });

    it('should return 403 for learner', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/admin/stats',
        headers: {
          authorization: `Bearer ${signToken({ role: 'learner', tenantLevel: 'country', tenantId: 'kenya' })}`,
        },
      });
      expect(res.statusCode).toBe(403);
    });

    it('should return 401 without auth', async () => {
      const res = await app.inject({ method: 'GET', url: '/admin/stats' });
      expect(res.statusCode).toBe(401);
    });
  });

  // =========================================================================
  // GET /admin/users — list users
  // =========================================================================

  describe('GET /admin/users', () => {
    it('should return 200 with paginated user list for admin', async () => {
      mockPaginate.mockResolvedValue({
        data: [{ id: 'u1', email: 'user@test.org' }],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/admin/users',
        headers: { authorization: `Bearer ${signToken()}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
      expect(res.json().data).toHaveLength(1);
    });

    it('should return 403 for learner', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/admin/users',
        headers: {
          authorization: `Bearer ${signToken({ role: 'learner', tenantLevel: 'country', tenantId: 'kenya' })}`,
        },
      });
      expect(res.statusCode).toBe(403);
    });

    it('should support search and role filter', async () => {
      mockPaginate.mockResolvedValue({
        data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/admin/users?search=amina&role=trainer',
        headers: { authorization: `Bearer ${signToken()}` },
      });

      expect(res.statusCode).toBe(200);
    });
  });

  // =========================================================================
  // POST /admin/users — create user
  // =========================================================================

  describe('POST /admin/users', () => {
    const newUser = {
      email: 'new.user@test.org',
      firstName: 'New',
      lastName: 'User',
      role: 'learner',
      tenantId: '00000000-0000-0000-0000-000000000001',
      preferredLanguage: 'fr',
    };

    it('should return 201 when admin creates user', async () => {
      mockQueryOne.mockResolvedValue(null); // no existing user
      mockQuery.mockResolvedValue([]);

      const res = await app.inject({
        method: 'POST',
        url: '/admin/users',
        headers: { authorization: `Bearer ${signToken()}` },
        payload: newUser,
      });

      expect(res.statusCode).toBe(201);
      expect(res.json().success).toBe(true);
    });

    it('should return 403 for non-admin', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/admin/users',
        headers: {
          authorization: `Bearer ${signToken({ role: 'learner', tenantLevel: 'country', tenantId: 'kenya' })}`,
        },
        payload: newUser,
      });
      expect(res.statusCode).toBe(403);
    });

    it('should return 400 for invalid email', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/admin/users',
        headers: { authorization: `Bearer ${signToken()}` },
        payload: { ...newUser, email: 'not-an-email' },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  // =========================================================================
  // PUT /admin/users/:id — update user
  // =========================================================================

  describe('PUT /admin/users/:id', () => {
    it('should return 200 when admin updates user', async () => {
      mockQueryOne.mockResolvedValue({ id: 'usr-001', first_name: 'Updated' });

      const res = await app.inject({
        method: 'PUT',
        url: '/admin/users/00000000-0000-0000-0000-000000000001',
        headers: { authorization: `Bearer ${signToken()}` },
        payload: { firstName: 'Updated' },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
    });

    it('should return 403 for non-admin', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/admin/users/00000000-0000-0000-0000-000000000001',
        headers: {
          authorization: `Bearer ${signToken({ role: 'learner', tenantLevel: 'country', tenantId: 'kenya' })}`,
        },
        payload: { firstName: 'Hack' },
      });
      expect(res.statusCode).toBe(403);
    });
  });

  // =========================================================================
  // GET /admin/tenants — list tenants
  // =========================================================================

  describe('GET /admin/tenants', () => {
    it('should return 200 with tenants list', async () => {
      mockQuery.mockResolvedValue([
        { id: 't1', name: 'AU-IBAR', level: 'continental' },
        { id: 't2', name: 'Kenya', level: 'country' },
      ]);

      const res = await app.inject({
        method: 'GET',
        url: '/admin/tenants',
        headers: { authorization: `Bearer ${signToken()}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data.length).toBeGreaterThan(0);
    });
  });
});
