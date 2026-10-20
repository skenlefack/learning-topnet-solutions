// ============================================================================
// Topnet Solutions Academy — Route Tests: Course Routes
// Tests HTTP API behavior using Fastify inject (no DB, all mocked)
// ============================================================================
import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import jwt from 'jsonwebtoken';

const TEST_SECRET = 'test-secret-for-route-tests';

// ---------------------------------------------------------------------------
// Mock all external dependencies before importing routes
// ---------------------------------------------------------------------------

const mockQuery = vi.fn();
const mockQueryOne = vi.fn();
const mockPaginate = vi.fn();

// Mock @fastify/rate-limit (not installed — used by shared/plugins/rate-limit.ts)
vi.mock('@fastify/rate-limit', () => ({
  default: vi.fn(),
}));

vi.mock('@topnet-academy/shared', async (importOriginal) => {
  const original = await importOriginal<typeof import('@topnet-academy/shared')>();
  return {
    ...original,
    query: (...args: any[]) => mockQuery(...args),
    queryOne: (...args: any[]) => mockQueryOne(...args),
    paginate: (...args: any[]) => mockPaginate(...args),
    transaction: vi.fn().mockImplementation(async (fn) => fn({ query: vi.fn() })),
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
      send: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
    }),
  };
});

vi.mock('../../packages/academy-course/src/services/course-resolver', () => ({
  resolveCourse: vi.fn().mockResolvedValue(null),
  invalidateResolvedCache: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../packages/academy-course/src/services/minio', () => ({
  uploadFile: vi.fn(),
  getSignedUrl: vi.fn(),
  deleteFile: vi.fn(),
  initBuckets: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Import routes after mocks
// ---------------------------------------------------------------------------

import { authPlugin } from '@topnet-academy/shared';
import { courseRoutes } from '../../packages/academy-course/src/routes/courses';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function signToken(payload: Record<string, any> = {}): string {
  const defaults = {
    sub: 'usr-001',
    email: 'admin@topnet-solutions.com',
    role: 'admin_continental',
    tenantId: 'topnet-solutions',
    tenantLevel: 'continental',
    firstName: 'Test',
    lastName: 'Admin',
  };
  return jwt.sign({ ...defaults, ...payload }, TEST_SECRET, { expiresIn: '1h' });
}

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(fastifyJwt, { secret: TEST_SECRET });
  await app.register(authPlugin);

  // Minimal tenant scope stub for route tests
  app.decorateRequest('tenantFilter', null);
  app.addHook('preHandler', async (request) => {
    // no-op search_path since there's no real DB
    if (request.user) {
      request.tenantId = request.user.tenantId;
      request.tenantLevel = request.user.tenantLevel;
    }
    request.tenantFilter = () => ({ clause: '1=1', params: [] });
  });

  await app.register(courseRoutes, { prefix: '/courses' });

  app.setErrorHandler((error, _request, reply) => {
    if ('validation' in error && 'statusCode' in error) {
      return reply.code((error as any).statusCode).send({
        success: false,
        error: error.message,
        validation: (error as any).validation,
      });
    }
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

describe('Course Routes — API (Fastify inject)', () => {
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
  // GET /courses — List with pagination
  // =========================================================================

  describe('GET /courses', () => {
    it('should return 200 with paginated course list', async () => {
      const mockCourses = [
        { id: 'c1', title: { fr: 'Cours 1' }, slug: 'cours-1', status: 'published' },
        { id: 'c2', title: { fr: 'Cours 2' }, slug: 'cours-2', status: 'published' },
      ];
      mockPaginate.mockResolvedValueOnce({
        data: mockCourses,
        meta: { total: 2, page: 1, limit: 20, totalPages: 1 },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/courses',
        headers: { authorization: `Bearer ${signToken()}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(2);
      expect(body.meta).toBeDefined();
      expect(body.meta.total).toBe(2);
      expect(body.meta.page).toBe(1);
    });

    it('should pass query params (page, limit, level, status, search)', async () => {
      mockPaginate.mockResolvedValueOnce({
        data: [],
        meta: { total: 0, page: 2, limit: 5, totalPages: 0 },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/courses?page=2&limit=5&level=beginner&status=published&search=ARIS',
        headers: { authorization: `Bearer ${signToken()}` },
      });

      expect(res.statusCode).toBe(200);
      expect(mockPaginate).toHaveBeenCalledTimes(1);
      // The first arg is the SQL, check it contains the filter conditions
      const sqlArg = mockPaginate.mock.calls[0][0];
      expect(sqlArg).toContain('c.level = $');
      expect(sqlArg).toContain('c.status = $');
      expect(sqlArg).toContain('ILIKE');
    });

    it('should return 401 without authorization header', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/courses',
      });

      expect(res.statusCode).toBe(401);
      expect(res.json().success).toBe(false);
      expect(res.json().error).toContain('Unauthorized');
    });

    it('should return 401 with invalid JWT token', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/courses',
        headers: { authorization: 'Bearer invalid.jwt.token' },
      });

      expect(res.statusCode).toBe(401);
    });
  });

  // =========================================================================
  // POST /courses — Create with auth
  // =========================================================================

  describe('POST /courses', () => {
    it('should return 201 when admin creates a course', async () => {
      const mockCourse = {
        id: 'new-course-id',
        slug: 'new-course',
        title: { fr: 'Nouveau' },
        status: 'draft',
        passing_score: 70,
        tags: ['test'],
      };
      mockQueryOne.mockResolvedValueOnce(mockCourse);

      const res = await app.inject({
        method: 'POST',
        url: '/courses',
        headers: { authorization: `Bearer ${signToken({ role: 'admin_continental' })}` },
        payload: {
          title: { fr: 'Nouveau' },
          slug: 'new-course',
          level: 'beginner',
          status: 'draft',
          passingScore: 70,
          tags: ['test'],
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.slug).toBe('new-course');
    });

    it('should return 403 when learner tries to create a course', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/courses',
        headers: {
          authorization: `Bearer ${signToken({ role: 'learner', tenantLevel: 'country', tenantId: 'kenya' })}`,
        },
        payload: {
          title: { fr: 'Unauthorized course' },
          slug: 'unauthorized-course',
          level: 'beginner',
        },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().error).toContain('Forbidden');
    });

    it('should return 400 for invalid payload (missing title)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/courses',
        headers: { authorization: `Bearer ${signToken()}` },
        payload: {
          slug: 'no-title',
          level: 'beginner',
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('should return 400 for invalid slug format', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/courses',
        headers: { authorization: `Bearer ${signToken()}` },
        payload: {
          title: { fr: 'Test' },
          slug: 'INVALID SLUG!',
          level: 'beginner',
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('trainer role can create courses', async () => {
      mockQueryOne.mockResolvedValueOnce({
        id: 'trainer-course',
        slug: 'trainer-course',
        status: 'draft',
      });

      const res = await app.inject({
        method: 'POST',
        url: '/courses',
        headers: {
          authorization: `Bearer ${signToken({ role: 'trainer' })}`,
        },
        payload: {
          title: { fr: 'Trainer course' },
          slug: 'trainer-course',
          level: 'beginner',
        },
      });

      expect(res.statusCode).toBe(201);
    });
  });

  // =========================================================================
  // GET /courses/:id — Get single course
  // =========================================================================

  describe('GET /courses/:id', () => {
    it('should return 200 with course data', async () => {
      const mockCourse = {
        id: '00000000-0000-0000-0000-000000000301',
        title: { fr: 'Surveillance' },
        slug: 'surveillance',
        modules: [{ id: 'm1', title: { fr: 'Module 1' } }],
      };
      mockQueryOne.mockResolvedValueOnce(mockCourse);

      const res = await app.inject({
        method: 'GET',
        url: '/courses/00000000-0000-0000-0000-000000000301',
        headers: { authorization: `Bearer ${signToken()}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.slug).toBe('surveillance');
      expect(body.data.modules).toBeDefined();
    });

    it('should return 404 when course not found', async () => {
      mockQueryOne.mockResolvedValueOnce(null);

      const res = await app.inject({
        method: 'GET',
        url: '/courses/00000000-0000-0000-0000-ffffffffffff',
        headers: { authorization: `Bearer ${signToken()}` },
      });

      expect(res.statusCode).toBe(404);
      expect(res.json().success).toBe(false);
      expect(res.json().error).toContain('not found');
    });

    it('should return 400 for invalid UUID', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/courses/not-a-uuid',
        headers: { authorization: `Bearer ${signToken()}` },
      });

      expect(res.statusCode).toBe(400);
    });

    it('should return 401 without token', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/courses/00000000-0000-0000-0000-000000000301',
      });

      expect(res.statusCode).toBe(401);
    });
  });

  // =========================================================================
  // DELETE /courses/:id — Admin only
  // =========================================================================

  describe('DELETE /courses/:id', () => {
    it('should return 204 when continental admin deletes', async () => {
      mockQueryOne.mockResolvedValueOnce({ id: 'deleted-id' });

      const res = await app.inject({
        method: 'DELETE',
        url: '/courses/00000000-0000-0000-0000-000000000301',
        headers: { authorization: `Bearer ${signToken({ role: 'admin_continental' })}` },
      });

      expect(res.statusCode).toBe(204);
    });

    it('should return 403 when country admin tries to delete', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/courses/00000000-0000-0000-0000-000000000301',
        headers: {
          authorization: `Bearer ${signToken({ role: 'admin_country', tenantLevel: 'country', tenantId: 'kenya' })}`,
        },
      });

      expect(res.statusCode).toBe(403);
    });

    it('should return 403 when learner tries to delete', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/courses/00000000-0000-0000-0000-000000000301',
        headers: {
          authorization: `Bearer ${signToken({ role: 'learner', tenantLevel: 'country', tenantId: 'kenya' })}`,
        },
      });

      expect(res.statusCode).toBe(403);
    });

    it('should return 404 when course does not exist', async () => {
      mockQueryOne.mockResolvedValueOnce(null);

      const res = await app.inject({
        method: 'DELETE',
        url: '/courses/00000000-0000-0000-0000-ffffffffffff',
        headers: { authorization: `Bearer ${signToken({ role: 'admin_continental' })}` },
      });

      expect(res.statusCode).toBe(404);
    });
  });
});
