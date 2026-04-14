// ============================================================================
// ARIS Academy — Integration Tests: Progress Tracking Routes
// Tests real PostgreSQL via Testcontainers, mocks Kafka + Redis + progression
// ============================================================================
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import { authPlugin, tenantScopePlugin } from '@aris-academy/shared';
import { TOKENS } from '../../helpers/jwt';
import { IDS, seedTestData, cleanTestData } from '../../helpers/fixtures';
import { getTestPool, testQuery, testQueryOne, closeTestPool } from '../../helpers/db';

// ---------------------------------------------------------------------------
// Mocks — Kafka, Redis, progression engine
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

vi.mock('@aris-academy/shared', async (importOriginal) => {
  const original = await importOriginal<typeof import('@aris-academy/shared')>();
  return {
    ...original,
    publishEvent: vi.fn().mockResolvedValue(undefined),
    createConsumer: vi.fn().mockResolvedValue({ disconnect: vi.fn() }),
    getRedis: vi.fn().mockReturnValue({
      hget: vi.fn().mockResolvedValue(null),
      hmset: vi.fn().mockResolvedValue('OK'),
      expire: vi.fn().mockResolvedValue(1),
      hgetall: vi.fn().mockResolvedValue({}),
    }),
  };
});

vi.mock('../../../packages/academy-learning/src/services/progression-engine', () => ({
  recalculateProgress: vi.fn().mockResolvedValue(undefined),
  updateStreak: vi.fn().mockResolvedValue(undefined),
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

import progressRoutes from '../../../packages/academy-learning/src/routes/progress';

// ---------------------------------------------------------------------------
// App builder
// ---------------------------------------------------------------------------

async function buildProgressApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(fastifyJwt, { secret: 'test-secret-key-for-vitest' });
  await app.register(authPlugin);
  await app.register(tenantScopePlugin);
  await app.register(progressRoutes);
  await app.ready();
  return app;
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('Progress Routes — Integration', () => {
  let app: FastifyInstance;
  const pool = getTestPool();

  // Lesson IDs (created in beforeAll)
  const LESSON_IDS = {
    lesson1: '00000000-0000-0000-0000-000000000501',
    lesson2: '00000000-0000-0000-0000-000000000502',
    lesson3: '00000000-0000-0000-0000-000000000503',
  };

  let enrollmentId: string;

  beforeAll(async () => {
    await seedTestData(pool);
    app = await buildProgressApp();

    // Create test lessons in the first module of the surveillance course
    await testQuery(
      `INSERT INTO academy_core.lessons (id, module_id, title, type, sort_order) VALUES
        ($1, $4, '{"en":"Lesson 1","fr":"Leçon 1"}', 'text', 1),
        ($2, $4, '{"en":"Lesson 2","fr":"Leçon 2"}', 'video', 2),
        ($3, $4, '{"en":"Lesson 3","fr":"Leçon 3"}', 'quiz', 3)
      ON CONFLICT DO NOTHING`,
      [LESSON_IDS.lesson1, LESSON_IDS.lesson2, LESSON_IDS.lesson3, IDS.modules.introSurveillance],
    );

    // Create an enrollment for the Kenya learner
    const enr = await testQueryOne(
      `INSERT INTO academy_core.enrollments (user_id, course_id, status, progress_percent, current_level)
       VALUES ($1, $2, 'active', 0, 'beginner')
       ON CONFLICT (user_id, course_id) DO UPDATE SET status = 'active'
       RETURNING *`,
      [IDS.users.kenyaLearner, IDS.courses.surveillance],
    );
    enrollmentId = enr.id;
  });

  afterAll(async () => {
    await app.close();
    await cleanTestData(pool);
    await closeTestPool();
  });

  // Clean progress tracking between tests
  beforeEach(async () => {
    await testQuery('DELETE FROM academy_core.progress_tracking');
  });

  // =========================================================================
  // 1. POST /progress — standard lesson progress update
  // =========================================================================

  describe('POST /progress — update lesson progress', () => {
    it('should create a new progress entry for a lesson', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/progress',
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
        payload: {
          lessonId: LESSON_IDS.lesson1,
          enrollmentId,
          timeSpentSeconds: 120,
          isCompleted: false,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.lesson_id).toBe(LESSON_IDS.lesson1);
      expect(body.data.time_spent_seconds).toBe(120);
      expect(body.data.is_completed).toBe(false);
      expect(body.data.attempts).toBe(1);
    });

    it('should upsert (accumulate time, increment attempts) on second call', async () => {
      // First call
      await app.inject({
        method: 'POST',
        url: '/progress',
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
        payload: {
          lessonId: LESSON_IDS.lesson1,
          enrollmentId,
          timeSpentSeconds: 60,
        },
      });

      // Second call
      const res = await app.inject({
        method: 'POST',
        url: '/progress',
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
        payload: {
          lessonId: LESSON_IDS.lesson1,
          enrollmentId,
          timeSpentSeconds: 90,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      // Time should be accumulated: 60 + 90
      expect(body.data.time_spent_seconds).toBe(150);
      expect(body.data.attempts).toBe(2);
    });

    it('should mark lesson as completed and set completed_at', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/progress',
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
        payload: {
          lessonId: LESSON_IDS.lesson1,
          enrollmentId,
          isCompleted: true,
          score: 85,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.is_completed).toBe(true);
      expect(body.data.score).toBe(85);
      expect(body.data.completed_at).not.toBeNull();
    });

    it('should preserve completed_at once set (does not overwrite)', async () => {
      // Complete the lesson
      await app.inject({
        method: 'POST',
        url: '/progress',
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
        payload: {
          lessonId: LESSON_IDS.lesson1,
          enrollmentId,
          isCompleted: true,
        },
      });

      // Record the completed_at timestamp
      const row1 = await testQueryOne(
        'SELECT completed_at FROM academy_core.progress_tracking WHERE lesson_id = $1',
        [LESSON_IDS.lesson1],
      );
      const firstCompletedAt = row1.completed_at;

      // Update with more time (but still completed)
      await app.inject({
        method: 'POST',
        url: '/progress',
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
        payload: {
          lessonId: LESSON_IDS.lesson1,
          enrollmentId,
          isCompleted: true,
          timeSpentSeconds: 30,
        },
      });

      const row2 = await testQueryOne(
        'SELECT completed_at FROM academy_core.progress_tracking WHERE lesson_id = $1',
        [LESSON_IDS.lesson1],
      );
      // completed_at should NOT have been overwritten
      expect(row2.completed_at.toISOString()).toBe(firstCompletedAt.toISOString());
    });

    it('should save video position (lastPositionSeconds)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/progress',
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
        payload: {
          lessonId: LESSON_IDS.lesson2,
          enrollmentId,
          lastPositionSeconds: 245,
          timeSpentSeconds: 30,
        },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data.last_position_seconds).toBe(245);
    });
  });

  // =========================================================================
  // 2. GET /progress/:enrollmentId — detailed progress listing
  // =========================================================================

  describe('GET /progress/:enrollmentId — list progress', () => {
    it('should return all progress entries for an enrollment', async () => {
      // Complete 2 lessons
      await app.inject({
        method: 'POST',
        url: '/progress',
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
        payload: { lessonId: LESSON_IDS.lesson1, enrollmentId, isCompleted: true },
      });
      await app.inject({
        method: 'POST',
        url: '/progress',
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
        payload: { lessonId: LESSON_IDS.lesson2, enrollmentId, timeSpentSeconds: 60 },
      });

      const res = await app.inject({
        method: 'GET',
        url: `/progress/${enrollmentId}`,
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.length).toBe(2);

      // Should include joined lesson and module titles
      const first = body.data[0];
      expect(first).toHaveProperty('lesson_title');
      expect(first).toHaveProperty('lesson_type');
      expect(first).toHaveProperty('module_title');
    });

    it('should return empty array for enrollment with no progress', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/progress/${enrollmentId}`,
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data).toEqual([]);
    });
  });

  // =========================================================================
  // 3. POST /progress/video-heartbeat — Redis-buffered video progress
  // =========================================================================

  describe('POST /progress/video-heartbeat', () => {
    it('should accept heartbeat data (mocked Redis)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/progress/video-heartbeat',
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
        payload: {
          lessonId: LESSON_IDS.lesson2,
          enrollmentId,
          seconds: 30,
          position: 180,
        },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
    });
  });

  // =========================================================================
  // 4. GET /progress/resume/:lessonId — video resume position
  // =========================================================================

  describe('GET /progress/resume/:lessonId', () => {
    it('should return position from DB when Redis is empty', async () => {
      // Create progress with a known position
      await app.inject({
        method: 'POST',
        url: '/progress',
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
        payload: {
          lessonId: LESSON_IDS.lesson2,
          enrollmentId,
          lastPositionSeconds: 300,
        },
      });

      const res = await app.inject({
        method: 'GET',
        url: `/progress/resume/${LESSON_IDS.lesson2}`,
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.lastPositionSeconds).toBe(300);
      expect(body.data.source).toBe('db');
    });

    it('should return 0 for a lesson with no progress', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/progress/resume/${LESSON_IDS.lesson3}`,
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data.lastPositionSeconds).toBe(0);
    });
  });

  // =========================================================================
  // Auth checks
  // =========================================================================

  describe('Authentication', () => {
    it('should return 401 for unauthenticated progress update', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/progress',
        payload: { lessonId: LESSON_IDS.lesson1, enrollmentId },
      });

      expect(res.statusCode).toBe(401);
    });

    it('should return 401 for unauthenticated progress listing', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/progress/${enrollmentId}`,
      });

      expect(res.statusCode).toBe(401);
    });
  });
});
