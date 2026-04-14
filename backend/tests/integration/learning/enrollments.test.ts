// ============================================================================
// ARIS Academy — Integration Tests: Enrollment Routes
// Tests real PostgreSQL + Redis via Testcontainers, mocks Kafka + progression
// ============================================================================
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import { authPlugin, tenantScopePlugin } from '@aris-academy/shared';
import { TOKENS } from '../../helpers/jwt';
import { IDS, seedTestData, cleanTestData } from '../../helpers/fixtures';
import { getTestPool, testQuery, testQueryOne, closeTestPool } from '../../helpers/db';

// ---------------------------------------------------------------------------
// Mocks — Kafka (no container), progression engine
// ---------------------------------------------------------------------------

// Mock the actual Kafka module to prevent real broker connections.
// audit.ts imports publishEvent from '../kafka' (relative), so the barrel mock
// alone does NOT intercept that import — we must mock the source module directly.
vi.mock('../../../packages/shared/src/kafka/index', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../packages/shared/src/kafka/index')>();
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

vi.mock('@aris-academy/shared', async (importOriginal) => {
  const original = await importOriginal<typeof import('@aris-academy/shared')>();
  return {
    ...original,
    publishEvent: vi.fn().mockResolvedValue(undefined),
    createConsumer: vi.fn().mockResolvedValue({ disconnect: vi.fn() }),
  };
});

vi.mock('../../../packages/academy-learning/src/services/progression-engine', () => ({
  getNextCourse: vi.fn().mockResolvedValue(null),
  calculateTimeEstimate: vi.fn().mockResolvedValue({
    remainingMinutes: 0,
    estimatedCompletionDate: null,
    velocityLessonsPerHour: 0,
  }),
}));

// ---------------------------------------------------------------------------
// Import route handler (after mocks)
// ---------------------------------------------------------------------------

import enrollmentRoutes from '../../../packages/academy-learning/src/routes/enrollments';

// ---------------------------------------------------------------------------
// App builder
// ---------------------------------------------------------------------------

async function buildEnrollmentApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(fastifyJwt, { secret: 'test-secret-key-for-vitest' });
  await app.register(authPlugin);
  await app.register(tenantScopePlugin);
  await app.register(enrollmentRoutes);
  await app.ready();
  return app;
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('Enrollment Routes — Integration', () => {
  let app: FastifyInstance;
  const pool = getTestPool();

  beforeAll(async () => {
    await seedTestData(pool);
    app = await buildEnrollmentApp();
  });

  afterAll(async () => {
    await app.close();
    await cleanTestData(pool);
    await closeTestPool();
  });

  // Clean up enrollments and certifications between tests
  beforeEach(async () => {
    await testQuery('DELETE FROM academy_core.certifications');
    await testQuery('DELETE FROM academy_core.enrollments');
  });

  // =========================================================================
  // 1. Enroll in a course
  // =========================================================================

  describe('POST /enrollments — enroll in a course', () => {
    it('should enroll a learner in a published course', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/enrollments',
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
        payload: { courseId: IDS.courses.surveillance },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.user_id).toBe(IDS.users.kenyaLearner);
      expect(body.data.course_id).toBe(IDS.courses.surveillance);
      expect(body.data.status).toBe('active');

      // Verify in DB
      const dbEnrollment = await testQueryOne(
        'SELECT * FROM enrollments WHERE user_id = $1 AND course_id = $2',
        [IDS.users.kenyaLearner, IDS.courses.surveillance],
      );
      expect(dbEnrollment).not.toBeNull();
      expect(dbEnrollment.status).toBe('active');
      expect(dbEnrollment.current_level).toBe('beginner');
    });

    it('should set current_level from the course level', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/enrollments',
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
        payload: { courseId: IDS.courses.collecte }, // intermediate course
      });

      expect(res.statusCode).toBe(201);
      expect(res.json().data.current_level).toBe('intermediate');
    });
  });

  // =========================================================================
  // 2. List enrollments
  // =========================================================================

  describe('GET /enrollments — list user enrollments', () => {
    it('should return all enrollments for the current user', async () => {
      // Enroll in two courses
      await app.inject({
        method: 'POST',
        url: '/enrollments',
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
        payload: { courseId: IDS.courses.surveillance },
      });
      await app.inject({
        method: 'POST',
        url: '/enrollments',
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
        payload: { courseId: IDS.courses.collecte },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/enrollments',
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.length).toBe(2);

      // Should include course info (joined data)
      const first = body.data[0];
      expect(first).toHaveProperty('title');
      expect(first).toHaveProperty('level');
      expect(first).toHaveProperty('slug');
    });

    it('should return empty array when user has no enrollments', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/enrollments',
        headers: { authorization: `Bearer ${TOKENS.nigeriaLearner()}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data).toEqual([]);
    });

    it('should not show enrollments from other users', async () => {
      // Kenya learner enrolls
      await app.inject({
        method: 'POST',
        url: '/enrollments',
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
        payload: { courseId: IDS.courses.surveillance },
      });

      // Nigeria learner checks — should not see Kenya's enrollment
      const res = await app.inject({
        method: 'GET',
        url: '/enrollments',
        headers: { authorization: `Bearer ${TOKENS.nigeriaLearner()}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data.length).toBe(0);
    });
  });

  // =========================================================================
  // 3. Prerequisite check
  // =========================================================================

  describe('Prerequisite enforcement', () => {
    it('should return 403 when prerequisites are not met', async () => {
      // Create a course that requires the surveillance course as prerequisite
      await testQuery(
        `INSERT INTO courses (id, tenant_id, tenant_level, title, slug, level, status, prerequisites, published_at)
         VALUES ($1, $2, 'continental', '{"fr":"Cours avance"}', 'cours-avance-prereq', 'advanced', 'published', $3, NOW())`,
        [
          '00000000-0000-0000-0000-aaaaaaaaaaaa',
          IDS.tenants.continental,
          `{${IDS.courses.surveillance}}`,
        ],
      );

      // Try to enroll without having the surveillance certification
      const res = await app.inject({
        method: 'POST',
        url: '/enrollments',
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
        payload: { courseId: '00000000-0000-0000-0000-aaaaaaaaaaaa' },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().error).toContain('Prerequisites not met');
    });

    it('should allow enrollment when prerequisites are met', async () => {
      // Create a course with prerequisites
      await testQuery(
        `INSERT INTO courses (id, tenant_id, tenant_level, title, slug, level, status, prerequisites, published_at)
         VALUES ($1, $2, 'continental', '{"fr":"Cours avance OK"}', 'cours-avance-prereq-ok', 'advanced', 'published', $3, NOW())
         ON CONFLICT (id) DO NOTHING`,
        [
          '00000000-0000-0000-0000-bbbbbbbbbbbb',
          IDS.tenants.continental,
          `{${IDS.courses.surveillance}}`,
        ],
      );

      // Issue a certification for the prerequisite course
      await testQuery(
        `INSERT INTO certifications (id, user_id, course_id, level, status, certificate_number, issued_at)
         VALUES ($1, $2, $3, 'beginner', 'issued', 'TEST-CERT-001', NOW())`,
        [
          '00000000-0000-0000-0000-cccccccccccc',
          IDS.users.kenyaLearner,
          IDS.courses.surveillance,
        ],
      );

      // Enroll — should succeed
      const res = await app.inject({
        method: 'POST',
        url: '/enrollments',
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
        payload: { courseId: '00000000-0000-0000-0000-bbbbbbbbbbbb' },
      });

      expect(res.statusCode).toBe(201);
      expect(res.json().success).toBe(true);
    });
  });

  // =========================================================================
  // 4. Duplicate enrollment — upsert
  // =========================================================================

  describe('Duplicate enrollment (upsert)', () => {
    it('should upsert when enrolling twice in the same course', async () => {
      // First enrollment
      const res1 = await app.inject({
        method: 'POST',
        url: '/enrollments',
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
        payload: { courseId: IDS.courses.surveillance },
      });
      expect(res1.statusCode).toBe(201);

      // Second enrollment — should upsert, not fail
      const res2 = await app.inject({
        method: 'POST',
        url: '/enrollments',
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
        payload: { courseId: IDS.courses.surveillance },
      });
      expect(res2.statusCode).toBe(201);

      // Only one enrollment row should exist
      const rows = await testQuery(
        'SELECT * FROM enrollments WHERE user_id = $1 AND course_id = $2',
        [IDS.users.kenyaLearner, IDS.courses.surveillance],
      );
      expect(rows.length).toBe(1);
      expect(rows[0].status).toBe('active');
    });
  });

  // =========================================================================
  // 5. Course not found
  // =========================================================================

  describe('Course not found', () => {
    it('should return 404 when enrolling in a non-existent course', async () => {
      const fakeId = '00000000-0000-0000-0000-ffffffffffff';
      const res = await app.inject({
        method: 'POST',
        url: '/enrollments',
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
        payload: { courseId: fakeId },
      });

      expect(res.statusCode).toBe(404);
      expect(res.json().error).toContain('Course not found');
    });
  });

  // =========================================================================
  // 6. Next course and time estimate endpoints
  // =========================================================================

  describe('GET /enrollments/:id/next-course', () => {
    it('should return next course suggestion (mocked)', async () => {
      // Enroll first
      const enrollRes = await app.inject({
        method: 'POST',
        url: '/enrollments',
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
        payload: { courseId: IDS.courses.surveillance },
      });
      const enrollmentId = enrollRes.json().data.id;

      const res = await app.inject({
        method: 'GET',
        url: `/enrollments/${enrollmentId}/next-course`,
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
      // Mocked to return null
      expect(res.json().data).toBeNull();
    });

    it('should return 404 for non-existent enrollment', async () => {
      const fakeId = '00000000-0000-0000-0000-ffffffffffff';
      const res = await app.inject({
        method: 'GET',
        url: `/enrollments/${fakeId}/next-course`,
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe('GET /enrollments/:id/time-estimate', () => {
    it('should return time estimate (mocked)', async () => {
      // Enroll first
      const enrollRes = await app.inject({
        method: 'POST',
        url: '/enrollments',
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
        payload: { courseId: IDS.courses.surveillance },
      });
      const enrollmentId = enrollRes.json().data.id;

      const res = await app.inject({
        method: 'GET',
        url: `/enrollments/${enrollmentId}/time-estimate`,
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('remainingMinutes');
      expect(body.data).toHaveProperty('estimatedCompletionDate');
      expect(body.data).toHaveProperty('velocityLessonsPerHour');
    });
  });

  // =========================================================================
  // Auth checks
  // =========================================================================

  describe('Authentication', () => {
    it('should return 401 for unauthenticated requests', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/enrollments',
      });

      expect(res.statusCode).toBe(401);
    });
  });
});
