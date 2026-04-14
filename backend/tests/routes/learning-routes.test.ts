// ============================================================================
// ARIS Academy — Route Tests: Learning Routes
// Tests dashboard, notifications, profile, enrollments (no real DB)
// ============================================================================
import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import jwt from 'jsonwebtoken';

const TEST_SECRET = 'test-secret-for-learning-routes';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockQuery = vi.fn();
const mockQueryOne = vi.fn();

vi.mock('@fastify/rate-limit', () => ({
  default: vi.fn(),
}));

vi.mock('@aris-academy/shared', async (importOriginal) => {
  const original = await importOriginal<typeof import('@aris-academy/shared')>();
  return {
    ...original,
    query: (...args: any[]) => mockQuery(...args),
    queryOne: (...args: any[]) => mockQueryOne(...args),
    paginate: vi.fn().mockResolvedValue({ data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } }),
    transaction: vi.fn().mockImplementation(async (fn) => fn({ query: vi.fn() })),
    cacheDel: vi.fn().mockResolvedValue(undefined),
    publishEvent: vi.fn().mockResolvedValue(undefined),
    auditLog: vi.fn().mockResolvedValue(undefined),
    createConsumer: vi.fn().mockResolvedValue({ disconnect: vi.fn() }),
    isRedisAvailable: vi.fn().mockReturnValue(false),
    getRedis: vi.fn().mockReturnValue({ hgetall: vi.fn(), zrevrange: vi.fn(), zcard: vi.fn() }),
    validateBody: (schema: any, data: any) => schema.parse(data),
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

vi.mock('../../packages/academy-learning/src/services/progression-engine', () => ({
  getNextCourse: vi.fn().mockResolvedValue(null),
  calculateTimeEstimate: vi.fn().mockResolvedValue({ remainingMinutes: 120 }),
}));

vi.mock('../../packages/academy-learning/src/services/minio', () => ({
  uploadFile: vi.fn().mockResolvedValue('https://minio/avatar.jpg'),
  getSignedUrl: vi.fn(),
  deleteFile: vi.fn(),
  initBuckets: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Import routes after mocks
// ---------------------------------------------------------------------------

import { authPlugin } from '@aris-academy/shared';
import dashboardRoutes from '../../packages/academy-learning/src/routes/dashboard';
import notificationRoutes from '../../packages/academy-learning/src/routes/notifications';
import profileRoutes from '../../packages/academy-learning/src/routes/profile';
import enrollmentRoutes from '../../packages/academy-learning/src/routes/enrollments';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function signToken(payload: Record<string, any> = {}): string {
  const defaults = {
    sub: 'usr-001',
    email: 'learner@kenya.go.ke',
    role: 'learner',
    tenantId: 'kenya',
    tenantLevel: 'country',
    firstName: 'Test',
    lastName: 'Learner',
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

  await app.register(dashboardRoutes);
  await app.register(notificationRoutes);
  await app.register(profileRoutes);
  await app.register(enrollmentRoutes);

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

describe('Learning Routes — API (Fastify inject)', () => {
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
  // Dashboard
  // =========================================================================

  describe('GET /dashboard', () => {
    it('should return 200 with dashboard data', async () => {
      mockQuery.mockResolvedValue([]);
      mockQueryOne.mockResolvedValue({ total_seconds: 3600, count: 6 });

      const res = await app.inject({
        method: 'GET',
        url: '/dashboard',
        headers: { authorization: `Bearer ${signToken()}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
    });

    it('should return 401 without auth', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/dashboard',
      });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('GET /dashboard/stats', () => {
    it('should return 200 for admin', async () => {
      mockQueryOne.mockResolvedValue({
        total_users: 10, total_enrollments: 20,
        completed_enrollments: 5, total_certifications: 3,
      });
      mockQuery.mockResolvedValue([]);

      const res = await app.inject({
        method: 'GET',
        url: '/dashboard/stats?tenantId=00000000-0000-0000-0000-000000000001',
        headers: { authorization: `Bearer ${signToken({ role: 'admin_continental' })}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
    });

    it('should return 403 for learner', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/dashboard/stats?tenantId=00000000-0000-0000-0000-000000000001',
        headers: { authorization: `Bearer ${signToken({ role: 'learner' })}` },
      });
      expect(res.statusCode).toBe(403);
    });
  });

  // =========================================================================
  // Notifications
  // =========================================================================

  describe('GET /notifications', () => {
    it('should return 200 with notifications list', async () => {
      mockQuery.mockResolvedValue([{ id: 'n1', message: 'Test' }]);
      mockQueryOne.mockResolvedValue({ total: 1 });

      const res = await app.inject({
        method: 'GET',
        url: '/notifications',
        headers: { authorization: `Bearer ${signToken()}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
      expect(body.meta).toBeDefined();
    });

    it('should return 401 without auth', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/notifications',
      });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('GET /notifications/unread-count', () => {
    it('should return 200 with unread count', async () => {
      mockQueryOne.mockResolvedValue({ count: 5 });

      const res = await app.inject({
        method: 'GET',
        url: '/notifications/unread-count',
        headers: { authorization: `Bearer ${signToken()}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data.count).toBe(5);
    });
  });

  describe('PUT /notifications/:id/read', () => {
    it('should return 200 and mark notification as read', async () => {
      mockQueryOne.mockResolvedValue({ id: 'n1', is_read: true });

      const res = await app.inject({
        method: 'PUT',
        url: '/notifications/n1/read',
        headers: { authorization: `Bearer ${signToken()}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
    });

    it('should return 404 if notification not found', async () => {
      mockQueryOne.mockResolvedValue(null);

      const res = await app.inject({
        method: 'PUT',
        url: '/notifications/nonexistent/read',
        headers: { authorization: `Bearer ${signToken()}` },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe('PUT /notifications/read-all', () => {
    it('should return 200 and mark all as read', async () => {
      mockQuery.mockResolvedValue([]);

      const res = await app.inject({
        method: 'PUT',
        url: '/notifications/read-all',
        headers: { authorization: `Bearer ${signToken()}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data.marked).toBe(true);
    });
  });

  // =========================================================================
  // Profile
  // =========================================================================

  describe('GET /users/me', () => {
    it('should return 200 with profile data', async () => {
      mockQueryOne
        .mockResolvedValueOnce({ id: 'usr-001', email: 'learner@kenya.go.ke', tenant_id: 'kenya' })
        .mockResolvedValueOnce({ id: 'kenya', name: 'Kenya', code: 'KE', level: 'country' });

      const res = await app.inject({
        method: 'GET',
        url: '/users/me',
        headers: { authorization: `Bearer ${signToken()}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data.email).toBe('learner@kenya.go.ke');
    });

    it('should return 404 if user not found in DB', async () => {
      mockQueryOne.mockResolvedValue(null);

      const res = await app.inject({
        method: 'GET',
        url: '/users/me',
        headers: { authorization: `Bearer ${signToken()}` },
      });

      expect(res.statusCode).toBe(404);
    });

    it('should return 401 without auth', async () => {
      const res = await app.inject({ method: 'GET', url: '/users/me' });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('PUT /users/me', () => {
    it('should return 200 on successful update', async () => {
      mockQueryOne.mockResolvedValue({ id: 'usr-001', first_name: 'Updated' });

      const res = await app.inject({
        method: 'PUT',
        url: '/users/me',
        headers: { authorization: `Bearer ${signToken()}` },
        payload: { firstName: 'Updated' },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
    });

    it('should return 400 when no fields provided', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/users/me',
        headers: { authorization: `Bearer ${signToken()}` },
        payload: {},
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // =========================================================================
  // Enrollments
  // =========================================================================

  describe('GET /enrollments', () => {
    it('should return 200 with enrollments list', async () => {
      mockQuery.mockResolvedValue([{ id: 'e1', status: 'active' }]);

      const res = await app.inject({
        method: 'GET',
        url: '/enrollments',
        headers: { authorization: `Bearer ${signToken()}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data).toHaveLength(1);
    });

    it('should return 401 without auth', async () => {
      const res = await app.inject({ method: 'GET', url: '/enrollments' });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('POST /enrollments', () => {
    it('should return 201 when enrolling in a course', async () => {
      mockQueryOne
        .mockResolvedValueOnce({ id: '00000000-0000-0000-0000-000000000301', prerequisites: [] })
        .mockResolvedValueOnce({ id: 'new-enrollment', course_id: '00000000-0000-0000-0000-000000000301', status: 'active' });

      const res = await app.inject({
        method: 'POST',
        url: '/enrollments',
        headers: { authorization: `Bearer ${signToken()}` },
        payload: { courseId: '00000000-0000-0000-0000-000000000301' },
      });

      expect(res.statusCode).toBe(201);
      expect(res.json().success).toBe(true);
    });

    it('should return 404 when course not found', async () => {
      mockQueryOne.mockResolvedValue(null);

      const res = await app.inject({
        method: 'POST',
        url: '/enrollments',
        headers: { authorization: `Bearer ${signToken()}` },
        payload: { courseId: '00000000-0000-0000-0000-ffffffffffff' },
      });

      expect(res.statusCode).toBe(404);
    });

    it('should return 400 for invalid courseId', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/enrollments',
        headers: { authorization: `Bearer ${signToken()}` },
        payload: { courseId: 'not-a-uuid' },
      });

      expect(res.statusCode).toBe(400);
    });
  });
});
