// ============================================================================
// ARIS Academy — Assessment Routes
// GET  /course/:courseId       — list assessments for a course
// GET  /:id                   — get single assessment
// POST /                      — create assessment
// PUT  /:id                   — update assessment
// DELETE /:id                 — delete assessment (admin only)
// ============================================================================
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { query, queryOne, validateBody, uuidSchema, multiLangTextSchema } from '@aris-academy/shared';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const createAssessmentSchema = z.object({
  courseId: uuidSchema,
  title: multiLangTextSchema,
  type: z.enum(['qcm', 'practical', 'mixed', 'oral']).default('qcm'),
  level: z.enum(['beginner', 'intermediate', 'advanced', 'expert']),
  passingScore: z.number().min(0).max(100).default(70),
  timeLimitMinutes: z.number().int().min(1).max(480).optional(),
  maxAttempts: z.number().int().min(1).max(10).default(3),
  shuffleQuestions: z.boolean().default(true),
  questionCount: z.number().int().min(1).optional(),
  isFinal: z.boolean().default(false),
});

const updateAssessmentSchema = z.object({
  title: multiLangTextSchema.optional(),
  type: z.enum(['qcm', 'practical', 'mixed', 'oral']).optional(),
  level: z.enum(['beginner', 'intermediate', 'advanced', 'expert']).optional(),
  passingScore: z.number().min(0).max(100).optional(),
  timeLimitMinutes: z.number().int().min(1).max(480).nullable().optional(),
  maxAttempts: z.number().int().min(1).max(10).optional(),
  shuffleQuestions: z.boolean().optional(),
  questionCount: z.number().int().min(1).nullable().optional(),
  isFinal: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export async function assessmentRoutes(app: FastifyInstance) {

  // -------------------------------------------------------------------------
  // GET /course/:courseId — list assessments for a course
  // -------------------------------------------------------------------------
  app.get('/course/:courseId', {
    preHandler: [app.authenticate],
  }, async (req: any, reply) => {
    const assessments = await query(`
      SELECT a.*,
        (SELECT COUNT(*)::int FROM academy_core.questions q WHERE q.assessment_id = a.id) AS question_count_actual
      FROM academy_core.assessments a
      WHERE a.course_id = $1
      ORDER BY a.level, a.is_final DESC
    `, [req.params.courseId]);

    return reply.send({ success: true, data: assessments });
  });

  // -------------------------------------------------------------------------
  // GET /:id — get single assessment with stats
  // -------------------------------------------------------------------------
  app.get('/:id', {
    preHandler: [app.authenticate],
  }, async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const assessment = await queryOne<any>(`
      SELECT a.*,
        (SELECT COUNT(*)::int FROM academy_core.questions q WHERE q.assessment_id = a.id) AS question_count_actual,
        (SELECT COUNT(*)::int FROM academy_core.assessment_attempts att WHERE att.assessment_id = a.id) AS total_attempts,
        (SELECT ROUND(AVG(att.score)::numeric, 1) FROM academy_core.assessment_attempts att
         WHERE att.assessment_id = a.id AND att.status = 'graded') AS avg_score
      FROM academy_core.assessments a
      WHERE a.id = $1
    `, [req.params.id]);

    if (!assessment) {
      return reply.code(404).send({ success: false, error: 'Assessment not found' });
    }

    return reply.send({ success: true, data: assessment });
  });

  // -------------------------------------------------------------------------
  // POST / — create assessment (trainer or admin)
  // -------------------------------------------------------------------------
  app.post('/', {
    preHandler: [
      app.authenticate,
      app.requireRole('trainer', 'admin_country', 'admin_rec', 'admin_continental'),
    ],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const data = validateBody(createAssessmentSchema, req.body);

    // Verify course exists
    const course = await queryOne<any>(
      `SELECT id FROM academy_core.courses WHERE id = $1`,
      [data.courseId],
    );
    if (!course) {
      return reply.code(404).send({ success: false, error: 'Course not found' });
    }

    const assessment = await queryOne<any>(`
      INSERT INTO academy_core.assessments
        (course_id, title, type, level, passing_score, time_limit_minutes,
         max_attempts, shuffle_questions, question_count, is_final)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      data.courseId,
      JSON.stringify(data.title),
      data.type,
      data.level,
      data.passingScore,
      data.timeLimitMinutes ?? null,
      data.maxAttempts,
      data.shuffleQuestions,
      data.questionCount ?? null,
      data.isFinal,
    ]);

    return reply.code(201).send({ success: true, data: assessment });
  });

  // -------------------------------------------------------------------------
  // PUT /:id — update assessment
  // -------------------------------------------------------------------------
  app.put('/:id', {
    preHandler: [
      app.authenticate,
      app.requireRole('trainer', 'admin_country', 'admin_rec', 'admin_continental'),
    ],
  }, async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const data = validateBody(updateAssessmentSchema, req.body);
    const assessmentId = req.params.id;

    const sets: string[] = [];
    const params: any[] = [];

    if (data.title !== undefined) { params.push(JSON.stringify(data.title)); sets.push(`title = $${params.length}`); }
    if (data.type !== undefined) { params.push(data.type); sets.push(`type = $${params.length}`); }
    if (data.level !== undefined) { params.push(data.level); sets.push(`level = $${params.length}`); }
    if (data.passingScore !== undefined) { params.push(data.passingScore); sets.push(`passing_score = $${params.length}`); }
    if (data.timeLimitMinutes !== undefined) { params.push(data.timeLimitMinutes); sets.push(`time_limit_minutes = $${params.length}`); }
    if (data.maxAttempts !== undefined) { params.push(data.maxAttempts); sets.push(`max_attempts = $${params.length}`); }
    if (data.shuffleQuestions !== undefined) { params.push(data.shuffleQuestions); sets.push(`shuffle_questions = $${params.length}`); }
    if (data.questionCount !== undefined) { params.push(data.questionCount); sets.push(`question_count = $${params.length}`); }
    if (data.isFinal !== undefined) { params.push(data.isFinal); sets.push(`is_final = $${params.length}`); }

    if (sets.length === 0) {
      return reply.code(400).send({ success: false, error: 'No fields to update' });
    }

    sets.push('updated_at = NOW()');
    params.push(assessmentId);

    const assessment = await queryOne<any>(`
      UPDATE academy_core.assessments
      SET ${sets.join(', ')}
      WHERE id = $${params.length}
      RETURNING *
    `, params);

    if (!assessment) {
      return reply.code(404).send({ success: false, error: 'Assessment not found' });
    }

    return reply.send({ success: true, data: assessment });
  });

  // -------------------------------------------------------------------------
  // DELETE /:id — delete assessment (admin only)
  // -------------------------------------------------------------------------
  app.delete('/:id', {
    preHandler: [
      app.authenticate,
      app.requireRole('admin_country', 'admin_rec', 'admin_continental'),
    ],
  }, async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const assessmentId = req.params.id;

    // Check for existing graded attempts
    const attempts = await queryOne<any>(
      `SELECT COUNT(*)::int AS count FROM academy_core.assessment_attempts
       WHERE assessment_id = $1 AND status = 'graded'`,
      [assessmentId],
    );

    if (attempts && attempts.count > 0) {
      return reply.code(409).send({
        success: false,
        error: `Cannot delete: ${attempts.count} graded attempts exist. Archive the course instead.`,
      });
    }

    const deleted = await queryOne<any>(
      `DELETE FROM academy_core.assessments WHERE id = $1 RETURNING id`,
      [assessmentId],
    );

    if (!deleted) {
      return reply.code(404).send({ success: false, error: 'Assessment not found' });
    }

    return reply.status(204).send();
  });
}
