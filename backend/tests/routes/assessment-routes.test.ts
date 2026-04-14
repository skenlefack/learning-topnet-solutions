// ============================================================================
// ARIS Academy — Route Tests: Assessment Routes
// Tests HTTP API behavior using Fastify inject (mocked DB)
// ============================================================================
import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import jwt from 'jsonwebtoken';

const TEST_SECRET = 'test-secret-for-assessment-routes';

// ---------------------------------------------------------------------------
// Mock all external dependencies before importing routes
// ---------------------------------------------------------------------------

const mockQuery = vi.fn();
const mockQueryOne = vi.fn();

// Mock @fastify/rate-limit (not installed — used by shared/plugins/rate-limit.ts)
vi.mock('@fastify/rate-limit', () => ({
  default: vi.fn(),
}));

vi.mock('@aris-academy/shared', async (importOriginal) => {
  const original = await importOriginal<typeof import('@aris-academy/shared')>();
  return {
    ...original,
    query: (...args: any[]) => mockQuery(...args),
    queryOne: (...args: any[]) => mockQueryOne(...args),
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

// ---------------------------------------------------------------------------
// Import routes after mocks
// ---------------------------------------------------------------------------

import { authPlugin } from '@aris-academy/shared';
import { assessmentRoutes } from '../../packages/academy-assessment/src/routes/assessments';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function signToken(payload: Record<string, any> = {}): string {
  const defaults = {
    sub: 'usr-001',
    email: 'admin@au-ibar.org',
    role: 'admin_continental',
    tenantId: 'au-ibar',
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

  // Minimal tenant scope stub
  app.decorateRequest('tenantFilter', null);
  app.addHook('preHandler', async (request) => {
    if (request.user) {
      request.tenantId = request.user.tenantId;
      request.tenantLevel = request.user.tenantLevel;
    }
    request.tenantFilter = () => ({ clause: '1=1', params: [] });
  });

  await app.register(assessmentRoutes);

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

describe('Assessment Routes — API (Fastify inject)', () => {
  let app: FastifyInstance;

  const COURSE_ID = '00000000-0000-0000-0000-000000000301';
  const ASSESSMENT_ID = '00000000-0000-0000-0000-000000000501';

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
  // GET /course/:courseId — List assessments
  // =========================================================================

  describe('GET /course/:courseId — List assessments for a course', () => {
    it('should return 200 with assessment list', async () => {
      const mockAssessments = [
        {
          id: ASSESSMENT_ID,
          course_id: COURSE_ID,
          title: { fr: 'QCM Final', en: 'Final Quiz' },
          type: 'qcm',
          level: 'beginner',
          passing_score: 70,
          is_final: true,
          question_count_actual: 10,
        },
      ];
      mockQuery.mockResolvedValueOnce(mockAssessments);

      const res = await app.inject({
        method: 'GET',
        url: `/course/${COURSE_ID}`,
        headers: { authorization: `Bearer ${signToken()}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].title.fr).toBe('QCM Final');
    });

    it('should return empty array when no assessments exist', async () => {
      mockQuery.mockResolvedValueOnce([]);

      const res = await app.inject({
        method: 'GET',
        url: `/course/${COURSE_ID}`,
        headers: { authorization: `Bearer ${signToken()}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data).toEqual([]);
    });

    it('should return 401 without authentication', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/course/${COURSE_ID}`,
      });

      expect(res.statusCode).toBe(401);
    });
  });

  // =========================================================================
  // POST / — Create assessment (admin/trainer only)
  // =========================================================================

  describe('POST / — Create assessment', () => {
    it('should return 201 when admin creates an assessment', async () => {
      // Mock course exists
      mockQueryOne.mockResolvedValueOnce({ id: COURSE_ID });
      // Mock assessment creation
      mockQueryOne.mockResolvedValueOnce({
        id: 'new-assessment-id',
        course_id: COURSE_ID,
        title: { fr: 'Evaluation module 1' },
        type: 'qcm',
        level: 'beginner',
        passing_score: 70,
        max_attempts: 3,
        shuffle_questions: true,
        is_final: false,
      });

      const res = await app.inject({
        method: 'POST',
        url: '/',
        headers: { authorization: `Bearer ${signToken({ role: 'admin_continental' })}` },
        payload: {
          courseId: COURSE_ID,
          title: { fr: 'Evaluation module 1' },
          type: 'qcm',
          level: 'beginner',
          passingScore: 70,
          maxAttempts: 3,
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.course_id).toBe(COURSE_ID);
    });

    it('trainer can create assessments', async () => {
      mockQueryOne.mockResolvedValueOnce({ id: COURSE_ID });
      mockQueryOne.mockResolvedValueOnce({
        id: 'trainer-assessment',
        course_id: COURSE_ID,
        title: { fr: 'Trainer eval' },
        type: 'qcm',
        level: 'intermediate',
      });

      const res = await app.inject({
        method: 'POST',
        url: '/',
        headers: { authorization: `Bearer ${signToken({ role: 'trainer' })}` },
        payload: {
          courseId: COURSE_ID,
          title: { fr: 'Trainer eval' },
          level: 'intermediate',
        },
      });

      expect(res.statusCode).toBe(201);
    });

    it('should return 403 when learner tries to create', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/',
        headers: {
          authorization: `Bearer ${signToken({ role: 'learner', tenantLevel: 'country', tenantId: 'kenya' })}`,
        },
        payload: {
          courseId: COURSE_ID,
          title: { fr: 'Unauthorized' },
          level: 'beginner',
        },
      });

      expect(res.statusCode).toBe(403);
    });

    it('should return 404 when course does not exist', async () => {
      mockQueryOne.mockResolvedValueOnce(null); // course not found

      const res = await app.inject({
        method: 'POST',
        url: '/',
        headers: { authorization: `Bearer ${signToken()}` },
        payload: {
          courseId: '00000000-0000-0000-0000-ffffffffffff',
          title: { fr: 'Test' },
          level: 'beginner',
        },
      });

      expect(res.statusCode).toBe(404);
      expect(res.json().error).toContain('Course not found');
    });

    it('should return 400 for missing required fields', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/',
        headers: { authorization: `Bearer ${signToken()}` },
        payload: {
          // Missing courseId, title, level
        },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // =========================================================================
  // GET /:id — Get single assessment
  // =========================================================================

  describe('GET /:id — Get single assessment', () => {
    it('should return 200 with assessment details and stats', async () => {
      const mockAssessment = {
        id: ASSESSMENT_ID,
        course_id: COURSE_ID,
        title: { fr: 'QCM Final' },
        type: 'qcm',
        level: 'beginner',
        passing_score: 70,
        max_attempts: 3,
        is_final: true,
        question_count_actual: 10,
        total_attempts: 50,
        avg_score: 72.5,
      };
      mockQueryOne.mockResolvedValueOnce(mockAssessment);

      const res = await app.inject({
        method: 'GET',
        url: `/${ASSESSMENT_ID}`,
        headers: { authorization: `Bearer ${signToken()}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(ASSESSMENT_ID);
      expect(body.data.question_count_actual).toBe(10);
      expect(body.data.total_attempts).toBe(50);
      expect(body.data.avg_score).toBe(72.5);
    });

    it('should return 404 when assessment not found', async () => {
      mockQueryOne.mockResolvedValueOnce(null);

      const res = await app.inject({
        method: 'GET',
        url: '/00000000-0000-0000-0000-ffffffffffff',
        headers: { authorization: `Bearer ${signToken()}` },
      });

      expect(res.statusCode).toBe(404);
      expect(res.json().error).toContain('Assessment not found');
    });

    it('should return 401 without authentication', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/${ASSESSMENT_ID}`,
      });

      expect(res.statusCode).toBe(401);
    });
  });

  // =========================================================================
  // DELETE /:id — Delete assessment (admin only)
  // =========================================================================

  describe('DELETE /:id — Delete assessment', () => {
    it('should return 204 when admin deletes assessment with no graded attempts', async () => {
      // No graded attempts
      mockQueryOne.mockResolvedValueOnce({ count: 0 });
      // Successful delete
      mockQueryOne.mockResolvedValueOnce({ id: ASSESSMENT_ID });

      const res = await app.inject({
        method: 'DELETE',
        url: `/${ASSESSMENT_ID}`,
        headers: { authorization: `Bearer ${signToken({ role: 'admin_continental' })}` },
      });

      expect(res.statusCode).toBe(204);
    });

    it('should return 409 when graded attempts exist', async () => {
      mockQueryOne.mockResolvedValueOnce({ count: 5 });

      const res = await app.inject({
        method: 'DELETE',
        url: `/${ASSESSMENT_ID}`,
        headers: { authorization: `Bearer ${signToken({ role: 'admin_continental' })}` },
      });

      expect(res.statusCode).toBe(409);
      expect(res.json().error).toContain('Cannot delete');
      expect(res.json().error).toContain('5 graded attempts');
    });

    it('should return 403 when learner tries to delete', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/${ASSESSMENT_ID}`,
        headers: {
          authorization: `Bearer ${signToken({ role: 'learner', tenantLevel: 'country', tenantId: 'kenya' })}`,
        },
      });

      expect(res.statusCode).toBe(403);
    });

    it('should return 403 when trainer tries to delete', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/${ASSESSMENT_ID}`,
        headers: {
          authorization: `Bearer ${signToken({ role: 'trainer' })}`,
        },
      });

      expect(res.statusCode).toBe(403);
    });

    it('should return 404 when assessment does not exist', async () => {
      // No graded attempts
      mockQueryOne.mockResolvedValueOnce({ count: 0 });
      // Delete returns null
      mockQueryOne.mockResolvedValueOnce(null);

      const res = await app.inject({
        method: 'DELETE',
        url: '/00000000-0000-0000-0000-ffffffffffff',
        headers: { authorization: `Bearer ${signToken({ role: 'admin_continental' })}` },
      });

      expect(res.statusCode).toBe(404);
    });

    it('country admin can delete assessments', async () => {
      mockQueryOne.mockResolvedValueOnce({ count: 0 });
      mockQueryOne.mockResolvedValueOnce({ id: ASSESSMENT_ID });

      const res = await app.inject({
        method: 'DELETE',
        url: `/${ASSESSMENT_ID}`,
        headers: {
          authorization: `Bearer ${signToken({ role: 'admin_country', tenantLevel: 'country', tenantId: 'kenya' })}`,
        },
      });

      expect(res.statusCode).toBe(204);
    });
  });

  // =========================================================================
  // PUT /:id — Update assessment
  // =========================================================================

  describe('PUT /:id — Update assessment', () => {
    it('should return 200 with updated assessment', async () => {
      const mockUpdated = {
        id: ASSESSMENT_ID,
        title: { fr: 'Updated Title' },
        passing_score: 80,
        level: 'intermediate',
      };
      mockQueryOne.mockResolvedValueOnce(mockUpdated);

      const res = await app.inject({
        method: 'PUT',
        url: `/${ASSESSMENT_ID}`,
        headers: { authorization: `Bearer ${signToken()}` },
        payload: {
          title: { fr: 'Updated Title' },
          passingScore: 80,
          level: 'intermediate',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.passing_score).toBe(80);
    });

    it('should return 400 when no fields provided', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: `/${ASSESSMENT_ID}`,
        headers: { authorization: `Bearer ${signToken()}` },
        payload: {},
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain('No fields to update');
    });

    it('should return 403 for learner', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: `/${ASSESSMENT_ID}`,
        headers: {
          authorization: `Bearer ${signToken({ role: 'learner', tenantLevel: 'country', tenantId: 'kenya' })}`,
        },
        payload: { passingScore: 80 },
      });

      expect(res.statusCode).toBe(403);
    });
  });
});
