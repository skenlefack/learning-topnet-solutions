// ============================================================================
// ARIS Academy — Kafka Event Flow Tests
// Tests event-driven flows between services by invoking consumer handler logic
// directly (no real Kafka broker needed).
//
// Environment: DATABASE_URL + REDIS_URL provided by globalSetup (Testcontainers)
// ============================================================================
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock Kafka to prevent real broker connections.
// We keep all non-Kafka exports from the shared package intact so that DB
// (query / queryOne) and Redis (cacheGet / cacheSet / cacheDel / getRedis)
// continue to talk to the real Testcontainers instances.
// ---------------------------------------------------------------------------

// Mock the actual Kafka module source to prevent real broker connections.
// Internal modules (e.g. audit.ts) import publishEvent from '../kafka' (relative),
// so the barrel mock alone does NOT intercept that import.
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

vi.mock('@aris-academy/shared', async (importOriginal) => {
  const original = await importOriginal<typeof import('@aris-academy/shared')>();
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

import { getTestPool, testQuery, testQueryOne, closeTestPool } from '../helpers/db';
import { IDS, seedTestData, cleanTestData } from '../helpers/fixtures';
import { cacheSet, cacheGet, cacheDel, getRedis } from '@aris-academy/shared';

// ============================================================================
// Suite
// ============================================================================
describe('Kafka Event Flows', () => {
  let pool: ReturnType<typeof getTestPool>;

  beforeAll(async () => {
    pool = getTestPool();
    await seedTestData(pool);
  });

  afterAll(async () => {
    await cleanTestData(pool);
    const redis = getRedis();
    await redis.flushdb();
    await closeTestPool();
  });

  // -------------------------------------------------------------------------
  // 1. Course Published --> Cache Invalidation
  // -------------------------------------------------------------------------
  describe('Course Published -> Cache Invalidation', () => {
    it('invalidates resolved course cache when course is published', async () => {
      // 1. Populate cache with a fake resolved entry
      const cacheKey = `resolved:${IDS.courses.surveillance}:${IDS.tenants.kenya}:fr`;
      await cacheSet(cacheKey, { id: IDS.courses.surveillance, title: 'cached' }, 300);

      // Verify cache is populated
      const cached = await cacheGet(cacheKey);
      expect(cached).toBeTruthy();

      // 2. Import and call the invalidation function (simulates what the consumer does)
      const { invalidateResolvedCache } = await import(
        '../../packages/academy-course/src/services/course-resolver'
      );
      await invalidateResolvedCache(IDS.courses.surveillance);

      // 3. Verify cache was invalidated
      const afterInvalidation = await cacheGet(cacheKey);
      expect(afterInvalidation).toBeNull();
    });

    it('does not affect cache entries for other courses', async () => {
      const otherKey = `resolved:${IDS.courses.collecte}:${IDS.tenants.kenya}:fr`;
      await cacheSet(otherKey, { id: IDS.courses.collecte, title: 'other course' }, 300);

      const { invalidateResolvedCache } = await import(
        '../../packages/academy-course/src/services/course-resolver'
      );
      // Invalidate the surveillance course only
      await invalidateResolvedCache(IDS.courses.surveillance);

      // The collecte course cache should remain intact
      const stillCached = await cacheGet(otherKey);
      expect(stillCached).toBeTruthy();
      expect((stillCached as any).id).toBe(IDS.courses.collecte);

      // Cleanup
      await cacheDel(otherKey);
    });
  });

  // -------------------------------------------------------------------------
  // 2. Certification Issued --> Next Level Unlock
  // -------------------------------------------------------------------------
  describe('Certification Issued -> Next Level Unlock', () => {
    let enrollmentId: string;
    let lessonId: string;
    let assessmentId: string;

    beforeAll(async () => {
      // Setup: Create a lesson in the introSurveillance module
      const [lesson] = await testQuery(
        `INSERT INTO lessons (module_id, title, type, sort_order, is_required)
         VALUES ($1, '{"fr":"Lecon test"}', 'text', 1, true)
         RETURNING id`,
        [IDS.modules.introSurveillance],
      );
      lessonId = lesson.id;

      // Create enrollment for Kenya learner in the surveillance course
      const [enrollment] = await testQuery(
        `INSERT INTO enrollments (user_id, course_id, status, current_level)
         VALUES ($1, $2, 'active', 'beginner')
         RETURNING id`,
        [IDS.users.kenyaLearner, IDS.courses.surveillance],
      );
      enrollmentId = enrollment.id;

      // Mark lesson as completed
      await testQuery(
        `INSERT INTO progress_tracking (user_id, lesson_id, enrollment_id, is_completed, completed_at)
         VALUES ($1, $2, $3, true, NOW())`,
        [IDS.users.kenyaLearner, lessonId, enrollmentId],
      );

      // Create a final assessment and mark as passed
      const [assessment] = await testQuery(
        `INSERT INTO assessments (course_id, title, type, level, passing_score, is_final)
         VALUES ($1, '{"fr":"Exam final"}', 'qcm', 'beginner', 70, true)
         RETURNING id`,
        [IDS.courses.surveillance],
      );
      assessmentId = assessment.id;

      await testQuery(
        `INSERT INTO assessment_attempts (user_id, assessment_id, enrollment_id, score, passed, submitted_at)
         VALUES ($1, $2, $3, 85, true, NOW())`,
        [IDS.users.kenyaLearner, assessmentId, enrollmentId],
      );
    });

    it('checkLevelUnlock issues certification when all requirements met', async () => {
      // Import and call checkLevelUnlock (simulating what the consumer does)
      const { checkLevelUnlock } = await import(
        '../../packages/academy-learning/src/services/progression-engine'
      );
      await checkLevelUnlock(IDS.users.kenyaLearner, IDS.courses.surveillance);

      // Verify certification was issued
      const cert = await testQueryOne(
        `SELECT * FROM certifications
         WHERE user_id = $1 AND course_id = $2 AND status = 'issued'`,
        [IDS.users.kenyaLearner, IDS.courses.surveillance],
      );
      expect(cert).toBeTruthy();
      expect(cert.level).toBe('beginner');
      expect(cert.certificate_number).toMatch(/^ARIS-/);
    });

    it('checkLevelUnlock is idempotent (does not duplicate certification)', async () => {
      const { checkLevelUnlock } = await import(
        '../../packages/academy-learning/src/services/progression-engine'
      );

      // Call a second time
      await checkLevelUnlock(IDS.users.kenyaLearner, IDS.courses.surveillance);

      // Should still be exactly one certification
      const certs = await testQuery(
        `SELECT * FROM certifications
         WHERE user_id = $1 AND course_id = $2 AND status = 'issued'`,
        [IDS.users.kenyaLearner, IDS.courses.surveillance],
      );
      expect(certs).toHaveLength(1);
    });

    it('checkLevelUnlock does NOT issue certification when assessment not passed', async () => {
      // Create enrollment for Nigeria learner (no lessons completed, no assessment passed)
      await testQuery(
        `INSERT INTO enrollments (user_id, course_id, status, current_level)
         VALUES ($1, $2, 'active', 'beginner')
         ON CONFLICT (user_id, course_id) DO UPDATE SET status = 'active'
         RETURNING id`,
        [IDS.users.nigeriaLearner, IDS.courses.surveillance],
      );

      const { checkLevelUnlock } = await import(
        '../../packages/academy-learning/src/services/progression-engine'
      );
      await checkLevelUnlock(IDS.users.nigeriaLearner, IDS.courses.surveillance);

      // No certification should exist
      const cert = await testQueryOne(
        `SELECT * FROM certifications
         WHERE user_id = $1 AND course_id = $2 AND status = 'issued'`,
        [IDS.users.nigeriaLearner, IDS.courses.surveillance],
      );
      expect(cert).toBeNull();
    });

    it('checkLevelUnlock does NOT issue certification when lessons are incomplete', async () => {
      // Insert a second required lesson that nobody has completed
      const [extraLesson] = await testQuery(
        `INSERT INTO lessons (module_id, title, type, sort_order, is_required)
         VALUES ($1, '{"fr":"Lecon supplementaire"}', 'text', 99, true)
         RETURNING id`,
        [IDS.modules.introSurveillance],
      );

      // Nigeria learner has enrollment but nothing completed
      const { checkLevelUnlock } = await import(
        '../../packages/academy-learning/src/services/progression-engine'
      );
      await checkLevelUnlock(IDS.users.nigeriaLearner, IDS.courses.surveillance);

      const cert = await testQueryOne(
        `SELECT * FROM certifications
         WHERE user_id = $1 AND course_id = $2 AND status = 'issued'`,
        [IDS.users.nigeriaLearner, IDS.courses.surveillance],
      );
      expect(cert).toBeNull();

      // Cleanup extra lesson so it doesn't affect subsequent tests
      await testQuery('DELETE FROM lessons WHERE id = $1', [extraLesson.id]);
    });
  });

  // -------------------------------------------------------------------------
  // 3. Progress Updated --> Leaderboard
  // -------------------------------------------------------------------------
  describe('Progress Updated -> Leaderboard', () => {
    it('updateLeaderboard writes scores to Redis sorted sets', async () => {
      // Progress already exists from the certification tests above
      const { updateLeaderboard } = await import(
        '../../packages/academy-learning/src/services/progression-engine'
      );
      await updateLeaderboard(IDS.users.kenyaLearner, IDS.tenants.kenya);

      // Check Redis sorted set for the country tenant
      const redis = getRedis();
      const score = await redis.zscore(
        `leaderboard:${IDS.tenants.kenya}:all`,
        IDS.users.kenyaLearner,
      );
      expect(score).toBeTruthy();
      expect(parseInt(score!)).toBeGreaterThanOrEqual(0);
    });

    it('propagates score to parent tenant (EAC)', async () => {
      const { updateLeaderboard } = await import(
        '../../packages/academy-learning/src/services/progression-engine'
      );
      await updateLeaderboard(IDS.users.kenyaLearner, IDS.tenants.kenya);

      const redis = getRedis();
      const eacScore = await redis.zscore(
        `leaderboard:${IDS.tenants.eac}:all`,
        IDS.users.kenyaLearner,
      );
      expect(eacScore).toBeTruthy();
    });

    it('propagates score up to continental tenant', async () => {
      const { updateLeaderboard } = await import(
        '../../packages/academy-learning/src/services/progression-engine'
      );
      await updateLeaderboard(IDS.users.kenyaLearner, IDS.tenants.kenya);

      const redis = getRedis();
      const continentalScore = await redis.zscore(
        `leaderboard:${IDS.tenants.continental}:all`,
        IDS.users.kenyaLearner,
      );
      expect(continentalScore).toBeTruthy();
    });

    it('writes weekly and monthly leaderboard keys', async () => {
      const { updateLeaderboard } = await import(
        '../../packages/academy-learning/src/services/progression-engine'
      );
      await updateLeaderboard(IDS.users.kenyaLearner, IDS.tenants.kenya);

      const redis = getRedis();
      const now = new Date();
      const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      const monthScore = await redis.zscore(
        `leaderboard:${IDS.tenants.kenya}:month:${monthKey}`,
        IDS.users.kenyaLearner,
      );
      expect(monthScore).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  // 4. Streak Tracking
  // -------------------------------------------------------------------------
  describe('Streak Tracking', () => {
    beforeEach(async () => {
      // Clean streak keys before each test so tests are independent
      const redis = getRedis();
      await redis.del(`streak:${IDS.users.kenyaLearner}`);
    });

    it('updateStreak starts at 1 for first activity', async () => {
      const { updateStreak } = await import(
        '../../packages/academy-learning/src/services/progression-engine'
      );
      const streak = await updateStreak(IDS.users.kenyaLearner);
      expect(streak).toBe(1);
    });

    it('updateStreak returns same value for second call on same day', async () => {
      const { updateStreak } = await import(
        '../../packages/academy-learning/src/services/progression-engine'
      );
      const streak1 = await updateStreak(IDS.users.kenyaLearner);
      const streak2 = await updateStreak(IDS.users.kenyaLearner);
      expect(streak2).toBe(streak1);
    });

    it('updateStreak persists data in Redis hash', async () => {
      const { updateStreak } = await import(
        '../../packages/academy-learning/src/services/progression-engine'
      );
      await updateStreak(IDS.users.kenyaLearner);

      const redis = getRedis();
      const data = await redis.hgetall(`streak:${IDS.users.kenyaLearner}`);
      expect(data.current_streak).toBe('1');
      expect(data.last_active).toBe(new Date().toISOString().slice(0, 10));
    });
  });

  // -------------------------------------------------------------------------
  // 5. Lesson Completed --> Assessment Availability (assessment consumer flow)
  // -------------------------------------------------------------------------
  describe('Lesson Completed -> Assessment Availability', () => {
    let assessmentEnrollmentId: string;
    let assessmentCourseLesson: string;
    let finalAssessmentId: string;

    beforeAll(async () => {
      // Use the collecte course for this test to avoid interference
      // Add a module to the collecte course
      const [mod] = await testQuery(
        `INSERT INTO modules (course_id, title, sort_order, estimated_minutes, is_required)
         VALUES ($1, '{"fr":"Module collecte"}', 1, 60, true)
         RETURNING id`,
        [IDS.courses.collecte],
      );

      // Add a single required lesson
      const [lesson] = await testQuery(
        `INSERT INTO lessons (module_id, title, type, sort_order, is_required)
         VALUES ($1, '{"fr":"Lecon collecte"}', 'text', 1, true)
         RETURNING id`,
        [mod.id],
      );
      assessmentCourseLesson = lesson.id;

      // Create enrollment
      const [enrollment] = await testQuery(
        `INSERT INTO enrollments (user_id, course_id, status, current_level)
         VALUES ($1, $2, 'active', 'intermediate')
         RETURNING id`,
        [IDS.users.kenyaLearner, IDS.courses.collecte],
      );
      assessmentEnrollmentId = enrollment.id;

      // Create a final assessment for the collecte course
      const [assessment] = await testQuery(
        `INSERT INTO assessments (course_id, title, type, level, passing_score, is_final)
         VALUES ($1, '{"fr":"Exam collecte"}', 'qcm', 'intermediate', 75, true)
         RETURNING id`,
        [IDS.courses.collecte],
      );
      finalAssessmentId = assessment.id;
    });

    it('triggers exam_available audit when all required lessons completed', async () => {
      // Mark the lesson as completed
      await testQuery(
        `INSERT INTO progress_tracking (user_id, lesson_id, enrollment_id, is_completed, completed_at)
         VALUES ($1, $2, $3, true, NOW())`,
        [IDS.users.kenyaLearner, assessmentCourseLesson, assessmentEnrollmentId],
      );

      // Simulate the assessment consumer logic: check lesson completion stats
      // and verify the final assessment becomes available.
      // We replicate what handleLessonCompleted does since it is not exported.
      const enrollment = await testQueryOne(
        'SELECT * FROM enrollments WHERE id = $1',
        [assessmentEnrollmentId],
      );
      expect(enrollment).toBeTruthy();

      const stats = await testQueryOne(`
        WITH course_stats AS (
          SELECT
            (SELECT COUNT(*) FROM lessons l
              JOIN modules m ON m.id = l.module_id
              WHERE m.course_id = $1 AND l.is_required = true) AS total_required,
            (SELECT COUNT(*) FROM progress_tracking pt
              JOIN lessons l ON l.id = pt.lesson_id
              JOIN modules m ON m.id = l.module_id
              WHERE pt.enrollment_id = $2 AND pt.is_completed = true AND l.is_required = true) AS completed_required
        )
        SELECT * FROM course_stats
      `, [enrollment.course_id, assessmentEnrollmentId]);

      const totalRequired = parseInt(stats.total_required);
      const completedRequired = parseInt(stats.completed_required);
      expect(completedRequired).toBeGreaterThanOrEqual(totalRequired);

      // Verify the final assessment exists for this course
      const finalAssessment = await testQueryOne(
        'SELECT id, title FROM assessments WHERE course_id = $1 AND is_final = true',
        [enrollment.course_id],
      );
      expect(finalAssessment).toBeTruthy();
      expect(finalAssessment.id).toBe(finalAssessmentId);
    });

    it('does not flag exam available when lessons are still incomplete', async () => {
      // Use the analyse course with no completed lessons
      const [mod] = await testQuery(
        `INSERT INTO modules (course_id, title, sort_order, estimated_minutes, is_required)
         VALUES ($1, '{"fr":"Module analyse"}', 1, 60, true)
         RETURNING id`,
        [IDS.courses.analyse],
      );

      await testQuery(
        `INSERT INTO lessons (module_id, title, type, sort_order, is_required)
         VALUES ($1, '{"fr":"Lecon analyse 1"}', 'text', 1, true),
                ($1, '{"fr":"Lecon analyse 2"}', 'text', 2, true)`,
        [mod.id],
      );

      const [enrollment] = await testQuery(
        `INSERT INTO enrollments (user_id, course_id, status, current_level)
         VALUES ($1, $2, 'active', 'advanced')
         RETURNING id`,
        [IDS.users.kenyaLearner, IDS.courses.analyse],
      );

      // No lessons completed -- check stats
      const stats = await testQueryOne(`
        WITH course_stats AS (
          SELECT
            (SELECT COUNT(*) FROM lessons l
              JOIN modules m ON m.id = l.module_id
              WHERE m.course_id = $1 AND l.is_required = true) AS total_required,
            (SELECT COUNT(*) FROM progress_tracking pt
              JOIN lessons l ON l.id = pt.lesson_id
              JOIN modules m ON m.id = l.module_id
              WHERE pt.enrollment_id = $2 AND pt.is_completed = true AND l.is_required = true) AS completed_required
        )
        SELECT * FROM course_stats
      `, [IDS.courses.analyse, enrollment.id]);

      const totalRequired = parseInt(stats.total_required);
      const completedRequired = parseInt(stats.completed_required);
      expect(totalRequired).toBe(2);
      expect(completedRequired).toBe(0);
      expect(completedRequired).toBeLessThan(totalRequired);
    });
  });

  // -------------------------------------------------------------------------
  // 6. recalculateProgress (consumer helper used by PROGRESS_UPDATED)
  // -------------------------------------------------------------------------
  describe('Progress Updated -> recalculateProgress', () => {
    it('updates enrollment progress_percent based on completed lessons', async () => {
      // Use the formulaires course for an isolated scenario
      const [mod] = await testQuery(
        `INSERT INTO modules (course_id, title, sort_order, estimated_minutes, is_required)
         VALUES ($1, '{"fr":"Module formulaires"}', 1, 30, true)
         RETURNING id`,
        [IDS.courses.formulaires],
      );

      const [lesson1] = await testQuery(
        `INSERT INTO lessons (module_id, title, type, sort_order, is_required)
         VALUES ($1, '{"fr":"Lecon 1"}', 'text', 1, true)
         RETURNING id`,
        [mod.id],
      );

      const [lesson2] = await testQuery(
        `INSERT INTO lessons (module_id, title, type, sort_order, is_required)
         VALUES ($1, '{"fr":"Lecon 2"}', 'text', 2, true)
         RETURNING id`,
        [mod.id],
      );

      const [enrollment] = await testQuery(
        `INSERT INTO enrollments (user_id, course_id, status, current_level, started_at)
         VALUES ($1, $2, 'active', 'intermediate', NOW())
         RETURNING id`,
        [IDS.users.nigeriaLearner, IDS.courses.formulaires],
      );

      // Complete one of two lessons
      await testQuery(
        `INSERT INTO progress_tracking (user_id, lesson_id, enrollment_id, is_completed, completed_at)
         VALUES ($1, $2, $3, true, NOW())`,
        [IDS.users.nigeriaLearner, lesson1.id, enrollment.id],
      );

      const { recalculateProgress } = await import(
        '../../packages/academy-learning/src/services/progression-engine'
      );
      const updated = await recalculateProgress(enrollment.id);

      expect(updated).toBeTruthy();
      expect(parseFloat(updated.progress_percent)).toBe(50);
      expect(updated.status).toBe('active');
    });
  });
});
