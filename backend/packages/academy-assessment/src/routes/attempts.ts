// ============================================================================
// ARIS Academy — Attempt Routes
// Start and submit assessment attempts (uses adaptive scoring engine)
// ============================================================================
import { FastifyInstance } from 'fastify';
import {
  query, queryOne, publishEvent, TOPICS,
  UuidParamNamed, BearerSecurity,
} from '@aris-academy/shared';
import { selectQuestions, scoreAttempt } from '../services/scoring-engine';
import { issueCertification } from './certifications';

export async function attemptRoutes(app: FastifyInstance) {
  // Start an assessment attempt — adaptive question selection
  app.post('/start', {
    schema: {
      summary: 'Start an assessment attempt',
      tags: ['Attempts'],
      security: BearerSecurity,
      body: {
        type: 'object',
        required: ['assessmentId'],
        properties: {
          assessmentId: { type: 'string', format: 'uuid' },
          enrollmentId: { type: 'string', format: 'uuid' },
        },
      },
    },
    preHandler: [app.authenticate],
  }, async (req: any, reply) => {
    const { assessmentId, enrollmentId } = req.body as any;

    const assessment = await queryOne(
      'SELECT * FROM academy_core.assessments WHERE id = $1',
      [assessmentId],
    );
    if (!assessment) {
      return reply.code(404).send({ success: false, error: 'Assessment not found' });
    }

    // Check max attempts
    const [{ count }] = await query(
      'SELECT COUNT(*) FROM academy_core.assessment_attempts WHERE user_id = $1 AND assessment_id = $2',
      [req.user.sub, assessmentId],
    );
    if (parseInt(count) >= assessment.max_attempts) {
      return reply.code(403).send({ success: false, error: 'Max attempts reached' });
    }

    // Adaptive question selection
    const { questions, questionIds } = await selectQuestions(assessmentId, req.user.sub);

    // Create the attempt record (store selected question IDs for scoring integrity)
    const attempt = await queryOne(`
      INSERT INTO academy_core.assessment_attempts (user_id, assessment_id, enrollment_id)
      VALUES ($1, $2, $3) RETURNING *
    `, [req.user.sub, assessmentId, enrollmentId]);

    return reply.send({
      success: true,
      data: {
        attempt,
        questions,
        questionIds,
        timeLimit: assessment.time_limit_minutes,
      },
    });
  });

  // Submit an assessment attempt — detailed scoring
  app.post('/:attemptId/submit', {
    schema: {
      summary: 'Submit an assessment attempt',
      tags: ['Attempts'],
      security: BearerSecurity,
      params: UuidParamNamed('attemptId'),
      body: {
        type: 'object',
        required: ['answers'],
        properties: {
          answers: {
            type: 'array',
            items: { type: 'object' },
            description: 'Array of answer objects { questionId, selectedIndex }',
          },
        },
      },
    },
    preHandler: [app.authenticate],
  }, async (req: any, reply) => {
    const { attemptId } = req.params;
    const { answers } = req.body as any; // { questionId: selectedIndex }

    const attempt = await queryOne(
      'SELECT * FROM academy_core.assessment_attempts WHERE id = $1 AND user_id = $2',
      [attemptId, req.user.sub],
    );
    if (!attempt) {
      return reply.code(404).send({ success: false, error: 'Attempt not found' });
    }
    if (attempt.submitted_at) {
      return reply.code(400).send({ success: false, error: 'Already submitted' });
    }

    // Score using the engine
    const scoreResult = await scoreAttempt(attemptId, answers);

    // Persist result
    const result = await queryOne(`
      UPDATE academy_core.assessment_attempts SET
        score = $2, answers = $3, passed = $4, submitted_at = NOW(), time_taken_seconds = $5
      WHERE id = $1 RETURNING *
    `, [
      attemptId,
      scoreResult.percentage,
      JSON.stringify(answers),
      scoreResult.passed,
      scoreResult.timeTakenSeconds,
    ]);

    const assessment = await queryOne(
      'SELECT * FROM academy_core.assessments WHERE id = $1',
      [attempt.assessment_id],
    );

    await publishEvent(TOPICS.ASSESSMENT_SUBMITTED, {
      attemptId,
      assessmentId: assessment.id,
      userId: req.user.sub,
      score: scoreResult.percentage,
      passed: scoreResult.passed,
      isFinal: assessment.is_final,
      timeBonus: scoreResult.timeBonus,
    }, req.user.tenantId, req.user.sub);

    // If passed final exam → issue certification
    if (scoreResult.passed && assessment.is_final) {
      await issueCertification(
        req.user.sub,
        assessment.course_id,
        assessment.level,
        req.user.tenantId,
      );
    }

    return reply.send({
      success: true,
      data: {
        ...result,
        totalScore: scoreResult.totalScore,
        maxScore: scoreResult.maxScore,
        percentage: scoreResult.percentage,
        timeBonus: scoreResult.timeBonus,
        breakdown: scoreResult.breakdown,
      },
    });
  });
}
