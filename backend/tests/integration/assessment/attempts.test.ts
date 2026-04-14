// ============================================================================
// ARIS Academy — Integration Tests: Attempt Routes
// Tests real PostgreSQL + Redis via Testcontainers, mocks Kafka + certs
// ============================================================================
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import { authPlugin, tenantScopePlugin } from '@aris-academy/shared';
import { TOKENS } from '../../helpers/jwt';
import { IDS, seedTestData, cleanTestData } from '../../helpers/fixtures';
import { getTestPool, testQuery, testQueryOne, closeTestPool } from '../../helpers/db';

// ---------------------------------------------------------------------------
// Mocks — Kafka (no container), certification issuer
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

vi.mock('../../../packages/academy-assessment/src/routes/certifications', () => ({
  issueCertification: vi.fn().mockResolvedValue({ id: 'mock-cert-id' }),
}));

// ---------------------------------------------------------------------------
// Import route handler (after mocks)
// ---------------------------------------------------------------------------

import { attemptRoutes } from '../../../packages/academy-assessment/src/routes/attempts';
import { issueCertification } from '../../../packages/academy-assessment/src/routes/certifications';

// ---------------------------------------------------------------------------
// App builder
// ---------------------------------------------------------------------------

async function buildAttemptApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(fastifyJwt, { secret: 'test-secret-key-for-vitest' });
  await app.register(authPlugin);
  await app.register(tenantScopePlugin);
  await app.register(attemptRoutes);
  await app.ready();
  return app;
}

// ---------------------------------------------------------------------------
// Test IDs for assessment fixtures
// ---------------------------------------------------------------------------

const ASSESS_IDS = {
  assessment: '00000000-0000-0000-0000-aaaa00000001',
  enrollment: '00000000-0000-0000-0000-aaaa00000002',
  q1: '00000000-0000-0000-0000-aaaa00000011',
  q2: '00000000-0000-0000-0000-aaaa00000012',
  q3: '00000000-0000-0000-0000-aaaa00000013',
  q4: '00000000-0000-0000-0000-aaaa00000014',
  q5: '00000000-0000-0000-0000-aaaa00000015',
};

// ---------------------------------------------------------------------------
// Seed assessment-specific data
// ---------------------------------------------------------------------------

async function seedAssessmentData(): Promise<void> {
  // Create enrollment for the Kenya learner in the surveillance course
  await testQuery(
    `INSERT INTO enrollments (id, user_id, course_id, current_level)
     VALUES ($1, $2, $3, 'beginner')
     ON CONFLICT DO NOTHING`,
    [ASSESS_IDS.enrollment, IDS.users.kenyaLearner, IDS.courses.surveillance],
  );

  // Create assessment
  await testQuery(
    `INSERT INTO assessments (id, course_id, title, type, level, passing_score, time_limit_minutes, max_attempts, question_count, is_final)
     VALUES ($1, $2, '{"fr":"Test Final Surveillance"}', 'qcm', 'beginner', 70, 60, 3, 5, true)
     ON CONFLICT DO NOTHING`,
    [ASSESS_IDS.assessment, IDS.courses.surveillance],
  );

  // Create 5 questions with varying difficulty and correct answers
  await testQuery(
    `INSERT INTO questions (id, assessment_id, question_text, question_type, options, difficulty, points)
     VALUES
       ($1, $6, '{"fr":"Qu''est-ce que la surveillance epidemiologique?"}', 'single_choice',
        '[{"text":{"fr":"Reponse correcte"},"is_correct":true},{"text":{"fr":"Mauvaise reponse"},"is_correct":false}]',
        1, 2),
       ($2, $6, '{"fr":"Quels sont les types de maladies?"}', 'single_choice',
        '[{"text":{"fr":"Mauvaise"},"is_correct":false},{"text":{"fr":"Correcte"},"is_correct":true}]',
        1, 2),
       ($3, $6, '{"fr":"Comment declarer une maladie?"}', 'single_choice',
        '[{"text":{"fr":"Correcte"},"is_correct":true},{"text":{"fr":"Mauvaise"},"is_correct":false},{"text":{"fr":"Aussi mauvaise"},"is_correct":false}]',
        3, 3),
       ($4, $6, '{"fr":"Quel protocole utiliser?"}', 'single_choice',
        '[{"text":{"fr":"Mauvaise"},"is_correct":false},{"text":{"fr":"Mauvaise aussi"},"is_correct":false},{"text":{"fr":"Correcte"},"is_correct":true}]',
        4, 4),
       ($5, $6, '{"fr":"Question avancee sur ARIS"}', 'single_choice',
        '[{"text":{"fr":"Correcte"},"is_correct":true},{"text":{"fr":"Mauvaise"},"is_correct":false}]',
        5, 4)
     ON CONFLICT DO NOTHING`,
    [
      ASSESS_IDS.q1,
      ASSESS_IDS.q2,
      ASSESS_IDS.q3,
      ASSESS_IDS.q4,
      ASSESS_IDS.q5,
      ASSESS_IDS.assessment,
    ],
  );
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('Attempt Routes — Integration', () => {
  let app: FastifyInstance;
  const pool = getTestPool();

  beforeAll(async () => {
    await seedTestData(pool);
    await seedAssessmentData();
    app = await buildAttemptApp();
  });

  afterAll(async () => {
    await app.close();
    await cleanTestData(pool);
    await closeTestPool();
  });

  // Clean up attempts between tests
  beforeEach(async () => {
    await testQuery('DELETE FROM academy_core.assessment_attempts');
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. Start attempt
  // =========================================================================

  describe('POST /start — start an assessment attempt', () => {
    it('should create an attempt and return adaptive questions', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/start',
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
        payload: {
          assessmentId: ASSESS_IDS.assessment,
          enrollmentId: ASSESS_IDS.enrollment,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.attempt).toBeDefined();
      expect(body.data.attempt.user_id).toBe(IDS.users.kenyaLearner);
      expect(body.data.attempt.assessment_id).toBe(ASSESS_IDS.assessment);
      expect(body.data.questions).toBeInstanceOf(Array);
      expect(body.data.questions.length).toBeGreaterThan(0);
      expect(body.data.questions.length).toBeLessThanOrEqual(5);
      expect(body.data.timeLimit).toBe(60);

      // Questions should NOT contain is_correct (sanitized)
      for (const q of body.data.questions) {
        expect(q).toHaveProperty('id');
        expect(q).toHaveProperty('questionText');
        expect(q).toHaveProperty('options');
        for (const opt of q.options) {
          expect(opt).not.toHaveProperty('is_correct');
        }
      }

      // Verify attempt record in DB
      const dbAttempt = await testQueryOne(
        'SELECT * FROM assessment_attempts WHERE id = $1',
        [body.data.attempt.id],
      );
      expect(dbAttempt).not.toBeNull();
      expect(dbAttempt.submitted_at).toBeNull();
    });

    it('should return 404 for non-existent assessment', async () => {
      const fakeId = '00000000-0000-0000-0000-ffffffffffff';
      const res = await app.inject({
        method: 'POST',
        url: '/start',
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
        payload: {
          assessmentId: fakeId,
          enrollmentId: ASSESS_IDS.enrollment,
        },
      });

      expect(res.statusCode).toBe(404);
      expect(res.json().error).toContain('Assessment not found');
    });
  });

  // =========================================================================
  // 2. Submit attempt with correct answers — pass
  // =========================================================================

  describe('POST /:attemptId/submit — submit with correct answers', () => {
    it('should score correctly and mark as passed', async () => {
      // Start attempt
      const startRes = await app.inject({
        method: 'POST',
        url: '/start',
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
        payload: {
          assessmentId: ASSESS_IDS.assessment,
          enrollmentId: ASSESS_IDS.enrollment,
        },
      });
      const { attempt, questionIds } = startRes.json().data;

      // Build answers: all correct (index 0 for q1, q3, q5; index 1 for q2; index 2 for q4)
      const answers: Record<string, number> = {};
      for (const qId of questionIds) {
        if (qId === ASSESS_IDS.q1) answers[qId] = 0; // first option is correct
        else if (qId === ASSESS_IDS.q2) answers[qId] = 1; // second option is correct
        else if (qId === ASSESS_IDS.q3) answers[qId] = 0; // first option is correct
        else if (qId === ASSESS_IDS.q4) answers[qId] = 2; // third option is correct
        else if (qId === ASSESS_IDS.q5) answers[qId] = 0; // first option is correct
      }

      const res = await app.inject({
        method: 'POST',
        url: `/${attempt.id}/submit`,
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
        payload: { answers },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.passed).toBe(true);
      expect(body.data.percentage).toBeGreaterThanOrEqual(70);
      expect(body.data.totalScore).toBeGreaterThan(0);
      expect(body.data.maxScore).toBeGreaterThan(0);
      expect(body.data.breakdown).toBeInstanceOf(Array);

      // Verify DB update
      const dbAttempt = await testQueryOne(
        'SELECT * FROM assessment_attempts WHERE id = $1',
        [attempt.id],
      );
      expect(dbAttempt.submitted_at).not.toBeNull();
      expect(dbAttempt.passed).toBe(true);
      expect(parseFloat(dbAttempt.score)).toBeGreaterThanOrEqual(70);
    });

    it('should call issueCertification when passing a final exam', async () => {
      // Start attempt
      const startRes = await app.inject({
        method: 'POST',
        url: '/start',
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
        payload: {
          assessmentId: ASSESS_IDS.assessment,
          enrollmentId: ASSESS_IDS.enrollment,
        },
      });
      const { attempt, questionIds } = startRes.json().data;

      // Build all-correct answers
      const answers: Record<string, number> = {};
      for (const qId of questionIds) {
        if (qId === ASSESS_IDS.q1) answers[qId] = 0;
        else if (qId === ASSESS_IDS.q2) answers[qId] = 1;
        else if (qId === ASSESS_IDS.q3) answers[qId] = 0;
        else if (qId === ASSESS_IDS.q4) answers[qId] = 2;
        else if (qId === ASSESS_IDS.q5) answers[qId] = 0;
      }

      await app.inject({
        method: 'POST',
        url: `/${attempt.id}/submit`,
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
        payload: { answers },
      });

      // issueCertification should have been called since this is a final exam and passed
      expect(issueCertification).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 3. Submit with wrong answers — fail
  // =========================================================================

  describe('POST /:attemptId/submit — submit with wrong answers', () => {
    it('should score correctly and mark as failed', async () => {
      // Start attempt
      const startRes = await app.inject({
        method: 'POST',
        url: '/start',
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
        payload: {
          assessmentId: ASSESS_IDS.assessment,
          enrollmentId: ASSESS_IDS.enrollment,
        },
      });
      const { attempt, questionIds } = startRes.json().data;

      // Build answers: all wrong
      const answers: Record<string, number> = {};
      for (const qId of questionIds) {
        if (qId === ASSESS_IDS.q1) answers[qId] = 1; // wrong (correct is 0)
        else if (qId === ASSESS_IDS.q2) answers[qId] = 0; // wrong (correct is 1)
        else if (qId === ASSESS_IDS.q3) answers[qId] = 1; // wrong (correct is 0)
        else if (qId === ASSESS_IDS.q4) answers[qId] = 0; // wrong (correct is 2)
        else if (qId === ASSESS_IDS.q5) answers[qId] = 1; // wrong (correct is 0)
      }

      const res = await app.inject({
        method: 'POST',
        url: `/${attempt.id}/submit`,
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
        payload: { answers },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.passed).toBe(false);
      expect(body.data.percentage).toBeLessThan(70);
      expect(body.data.totalScore).toBe(0);

      // Verify DB
      const dbAttempt = await testQueryOne(
        'SELECT * FROM assessment_attempts WHERE id = $1',
        [attempt.id],
      );
      expect(dbAttempt.passed).toBe(false);

      // issueCertification should NOT have been called
      expect(issueCertification).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 4. Max attempts enforcement
  // =========================================================================

  describe('Max attempts enforcement', () => {
    it('should return 403 after max_attempts (3) have been used', async () => {
      // Create 3 attempts (the max for our assessment)
      for (let i = 0; i < 3; i++) {
        await testQuery(
          `INSERT INTO assessment_attempts (user_id, assessment_id, enrollment_id, started_at)
           VALUES ($1, $2, $3, NOW())`,
          [IDS.users.kenyaLearner, ASSESS_IDS.assessment, ASSESS_IDS.enrollment],
        );
      }

      // Fourth attempt should be blocked
      const res = await app.inject({
        method: 'POST',
        url: '/start',
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
        payload: {
          assessmentId: ASSESS_IDS.assessment,
          enrollmentId: ASSESS_IDS.enrollment,
        },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().error).toContain('Max attempts reached');
    });
  });

  // =========================================================================
  // 5. Already submitted
  // =========================================================================

  describe('Already submitted attempt', () => {
    it('should return 400 when submitting an already submitted attempt', async () => {
      // Start attempt
      const startRes = await app.inject({
        method: 'POST',
        url: '/start',
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
        payload: {
          assessmentId: ASSESS_IDS.assessment,
          enrollmentId: ASSESS_IDS.enrollment,
        },
      });
      const { attempt, questionIds } = startRes.json().data;

      // Submit first time with minimal answers
      const answers: Record<string, number> = {};
      for (const qId of questionIds) {
        answers[qId] = 0;
      }

      await app.inject({
        method: 'POST',
        url: `/${attempt.id}/submit`,
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
        payload: { answers },
      });

      // Submit again — should fail
      const res = await app.inject({
        method: 'POST',
        url: `/${attempt.id}/submit`,
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
        payload: { answers },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain('Already submitted');
    });
  });

  // =========================================================================
  // 6. Attempt not found
  // =========================================================================

  describe('Attempt not found', () => {
    it('should return 404 when submitting a non-existent attempt', async () => {
      const fakeId = '00000000-0000-0000-0000-ffffffffffff';
      const res = await app.inject({
        method: 'POST',
        url: `/${fakeId}/submit`,
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
        payload: { answers: {} },
      });

      expect(res.statusCode).toBe(404);
      expect(res.json().error).toContain('Attempt not found');
    });
  });

  // =========================================================================
  // Auth checks
  // =========================================================================

  describe('Authentication', () => {
    it('should return 401 for unauthenticated start request', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/start',
        payload: {
          assessmentId: ASSESS_IDS.assessment,
          enrollmentId: ASSESS_IDS.enrollment,
        },
      });

      expect(res.statusCode).toBe(401);
    });
  });
});
