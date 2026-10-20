// ============================================================================
// Topnet Solutions Academy — Integration Tests: Enrollment Flow
// Tests enrollment creation, progress tracking, listing with filters
// Uses real PostgreSQL via Testcontainers, mocks Kafka + progression engine
// ============================================================================
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import { authPlugin, tenantScopePlugin } from '@topnet-academy/shared';
import { TOKENS } from '../../helpers/jwt';
import { IDS, seedTestData, cleanTestData } from '../../helpers/fixtures';
import { getTestPool, testQuery, testQueryOne, closeTestPool } from '../../helpers/db';

// ---------------------------------------------------------------------------
// Mocks — Kafka (no container), progression engine, MinIO
// ---------------------------------------------------------------------------

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

vi.mock('@topnet-academy/shared', async (importOriginal) => {
  const original = await importOriginal<typeof import('@topnet-academy/shared')>();
  return {
    ...original,
    publishEvent: vi.fn().mockResolvedValue(undefined),
    createConsumer: vi.fn().mockResolvedValue({ disconnect: vi.fn() }),
  };
});

vi.mock('../../../packages/academy-learning/src/services/progression-engine', () => ({
  getNextCourse: vi.fn().mockResolvedValue(null),
  calculateTimeEstimate: vi.fn().mockResolvedValue({
    remainingMinutes: 120,
    estimatedCompletionDate: '2026-06-01T00:00:00Z',
    velocityLessonsPerHour: 1.5,
  }),
  recalculateProgress: vi.fn().mockResolvedValue(undefined),
  updateStreak: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../packages/academy-learning/src/services/minio', () => ({
  initBuckets: vi.fn().mockResolvedValue(undefined),
}));

// ---------------------------------------------------------------------------
// Import route handlers (after mocks)
// ---------------------------------------------------------------------------

import enrollmentRoutes from '../../../packages/academy-learning/src/routes/enrollments';
import progressRoutes from '../../../packages/academy-learning/src/routes/progress';

// ---------------------------------------------------------------------------
// App builder
// ---------------------------------------------------------------------------

async function buildEnrollmentApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(fastifyJwt, { secret: 'test-secret-key-for-vitest' });
  await app.register(authPlugin);
  await app.register(tenantScopePlugin);
  await app.register(enrollmentRoutes);
  await app.register(progressRoutes);
  await app.ready();
  return app;
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('Enrollment Flow — Integration (Testcontainers)', () => {
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

  beforeEach(async () => {
    // Clean enrollment-related data between tests
    await testQuery('DELETE FROM academy_core.progress_tracking');
    await testQuery('DELETE FROM academy_core.certifications');
    await testQuery('DELETE FROM academy_core.enrollments');
  });

  // =========================================================================
  // 1. Enrollment creation
  // =========================================================================

  describe('POST /enrollments — create enrollment', () => {
    it('should enroll a learner in a course and return active status', async () => {
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
      expect(body.data.current_level).toBe('beginner');
    });

    it('should set current_level based on course level', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/enrollments',
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
        payload: { courseId: IDS.courses.collecte }, // intermediate course
      });

      expect(res.statusCode).toBe(201);
      expect(res.json().data.current_level).toBe('intermediate');
    });

    it('should handle duplicate enrollment via upsert (ON CONFLICT)', async () => {
      // First enrollment
      const res1 = await app.inject({
        method: 'POST',
        url: '/enrollments',
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
        payload: { courseId: IDS.courses.surveillance },
      });
      expect(res1.statusCode).toBe(201);

      // Second enrollment — should upsert
      const res2 = await app.inject({
        method: 'POST',
        url: '/enrollments',
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
        payload: { courseId: IDS.courses.surveillance },
      });
      expect(res2.statusCode).toBe(201);

      // Only one row should exist
      const rows = await testQuery(
        'SELECT * FROM enrollments WHERE user_id = $1 AND course_id = $2',
        [IDS.users.kenyaLearner, IDS.courses.surveillance],
      );
      expect(rows.length).toBe(1);
    });

    it('should return 404 for non-existent course', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/enrollments',
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
        payload: { courseId: '00000000-0000-0000-0000-ffffffffffff' },
      });

      expect(res.statusCode).toBe(404);
      expect(res.json().error).toContain('Course not found');
    });

    it('should return 400 for invalid courseId format', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/enrollments',
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
        payload: { courseId: 'not-a-uuid' },
      });

      expect(res.statusCode).toBe(400);
    });

    it('should return 401 for unauthenticated request', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/enrollments',
        payload: { courseId: IDS.courses.surveillance },
      });

      expect(res.statusCode).toBe(401);
    });
  });

  // =========================================================================
  // 2. Enrollment listing
  // =========================================================================

  describe('GET /enrollments — list user enrollments', () => {
    it('should return all enrollments for the current user with course info', async () => {
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

      // Should include joined course data
      const enrollment = body.data[0];
      expect(enrollment).toHaveProperty('title');
      expect(enrollment).toHaveProperty('level');
      expect(enrollment).toHaveProperty('slug');
      expect(enrollment).toHaveProperty('total_modules');
      expect(enrollment).toHaveProperty('total_lessons');
    });

    it('should return empty array for user with no enrollments', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/enrollments',
        headers: { authorization: `Bearer ${TOKENS.nigeriaLearner()}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data).toEqual([]);
    });

    it('should NOT show other users enrollments (user isolation)', async () => {
      // Kenya learner enrolls
      await app.inject({
        method: 'POST',
        url: '/enrollments',
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
        payload: { courseId: IDS.courses.surveillance },
      });

      // Nigeria learner should NOT see it
      const res = await app.inject({
        method: 'GET',
        url: '/enrollments',
        headers: { authorization: `Bearer ${TOKENS.nigeriaLearner()}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data.length).toBe(0);
    });

    it('should order by updated_at DESC (most recent first)', async () => {
      // Enroll in surveillance first, then collecte
      await app.inject({
        method: 'POST',
        url: '/enrollments',
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
        payload: { courseId: IDS.courses.surveillance },
      });
      // Small delay to ensure different timestamps
      await new Promise((r) => setTimeout(r, 50));
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

      const data = res.json().data;
      expect(data.length).toBe(2);
      // Most recently updated first
      const d0 = new Date(data[0].updated_at).getTime();
      const d1 = new Date(data[1].updated_at).getTime();
      expect(d0).toBeGreaterThanOrEqual(d1);
    });
  });

  // =========================================================================
  // 3. Progress tracking (0% -> 50% -> 100%)
  // =========================================================================

  describe('Progress tracking flow', () => {
    it('should track lesson progress and mark as completed', async () => {
      // Enroll
      const enrollRes = await app.inject({
        method: 'POST',
        url: '/enrollments',
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
        payload: { courseId: IDS.courses.surveillance },
      });
      const enrollmentId = enrollRes.json().data.id;

      // Seed a lesson for the test
      const lessonRow = await testQueryOne(
        `SELECT l.id FROM academy_core.lessons l
         JOIN academy_core.modules m ON m.id = l.module_id
         WHERE m.course_id = $1
         LIMIT 1`,
        [IDS.courses.surveillance],
      );

      // If no lessons seeded, insert one
      let lessonId: string;
      if (!lessonRow) {
        const inserted = await testQueryOne(
          `INSERT INTO academy_core.lessons (module_id, title, type, sort_order, is_required)
           VALUES ($1, '{"en":"Test Lesson"}', 'video', 1, true)
           RETURNING id`,
          [IDS.modules.introSurveillance],
        );
        lessonId = inserted.id;
      } else {
        lessonId = lessonRow.id;
      }

      // Post progress — not completed
      const progressRes1 = await app.inject({
        method: 'POST',
        url: '/progress',
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
        payload: {
          lessonId,
          enrollmentId,
          timeSpentSeconds: 300,
          lastPositionSeconds: 120,
          isCompleted: false,
        },
      });

      expect(progressRes1.statusCode).toBe(200);
      const progress1 = progressRes1.json().data;
      expect(progress1.is_completed).toBe(false);
      expect(progress1.time_spent_seconds).toBe(300);

      // Post progress — mark completed
      const progressRes2 = await app.inject({
        method: 'POST',
        url: '/progress',
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
        payload: {
          lessonId,
          enrollmentId,
          timeSpentSeconds: 200,
          isCompleted: true,
          score: 85,
        },
      });

      expect(progressRes2.statusCode).toBe(200);
      const progress2 = progressRes2.json().data;
      expect(progress2.is_completed).toBe(true);
      expect(progress2.score).toBe(85);
      // Time should be accumulated (300 + 200 = 500)
      expect(progress2.time_spent_seconds).toBe(500);
      expect(progress2.completed_at).not.toBeNull();
    });

    it('should GET detailed progress for an enrollment', async () => {
      // Enroll
      const enrollRes = await app.inject({
        method: 'POST',
        url: '/enrollments',
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
        payload: { courseId: IDS.courses.surveillance },
      });
      const enrollmentId = enrollRes.json().data.id;

      const res = await app.inject({
        method: 'GET',
        url: `/progress/${enrollmentId}`,
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
    });
  });

  // =========================================================================
  // 4. Prerequisite enforcement
  // =========================================================================

  describe('Prerequisite enforcement', () => {
    it('should block enrollment when prerequisites not met', async () => {
      // Create course with prerequisite
      await testQuery(
        `INSERT INTO courses (id, tenant_id, tenant_level, title, slug, level, status, prerequisites, published_at)
         VALUES ($1, $2, 'continental', '{"fr":"Cours avance"}', 'prereq-block-test', 'advanced', 'published', $3, NOW())
         ON CONFLICT (id) DO NOTHING`,
        [
          '00000000-0000-0000-0000-aaaaaaaaa001',
          IDS.tenants.continental,
          `{${IDS.courses.surveillance}}`,
        ],
      );

      const res = await app.inject({
        method: 'POST',
        url: '/enrollments',
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
        payload: { courseId: '00000000-0000-0000-0000-aaaaaaaaa001' },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().error).toContain('Prerequisites not met');
    });

    it('should allow enrollment when prerequisites are met via certification', async () => {
      // Create course with prerequisite
      await testQuery(
        `INSERT INTO courses (id, tenant_id, tenant_level, title, slug, level, status, prerequisites, published_at)
         VALUES ($1, $2, 'continental', '{"fr":"Cours avance OK"}', 'prereq-pass-test', 'advanced', 'published', $3, NOW())
         ON CONFLICT (id) DO NOTHING`,
        [
          '00000000-0000-0000-0000-aaaaaaaaa002',
          IDS.tenants.continental,
          `{${IDS.courses.surveillance}}`,
        ],
      );

      // Issue certification for the prerequisite
      await testQuery(
        `INSERT INTO certifications (id, user_id, course_id, level, status, certificate_number, issued_at)
         VALUES ($1, $2, $3, 'beginner', 'issued', 'CERT-FLOW-001', NOW())`,
        [
          '00000000-0000-0000-0000-ccccccccc001',
          IDS.users.kenyaLearner,
          IDS.courses.surveillance,
        ],
      );

      const res = await app.inject({
        method: 'POST',
        url: '/enrollments',
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
        payload: { courseId: '00000000-0000-0000-0000-aaaaaaaaa002' },
      });

      expect(res.statusCode).toBe(201);
      expect(res.json().success).toBe(true);
    });
  });

  // =========================================================================
  // 5. Next course and time estimate
  // =========================================================================

  describe('Enrollment helper endpoints', () => {
    it('GET /enrollments/:id/next-course returns suggestion (mocked)', async () => {
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
    });

    it('GET /enrollments/:id/time-estimate returns estimate (mocked)', async () => {
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
      expect(body.data).toHaveProperty('remainingMinutes');
      expect(body.data).toHaveProperty('estimatedCompletionDate');
      expect(body.data).toHaveProperty('velocityLessonsPerHour');
    });

    it('GET /enrollments/:id/next-course returns 404 for non-existent enrollment', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/enrollments/00000000-0000-0000-0000-ffffffffffff/next-course',
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
      });

      expect(res.statusCode).toBe(404);
    });
  });
});
