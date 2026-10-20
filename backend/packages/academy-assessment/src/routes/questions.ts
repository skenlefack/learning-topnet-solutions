// ============================================================================
// Topnet Solutions Academy — Question Bank Routes
// CRUD for assessment questions (trainer+ only)
// + bulk-import (POST /bulk-import) + export (GET /export)
// ============================================================================
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  query, queryOne, transaction, validateBody,
  BearerSecurity,
} from '@topnet-academy/shared';

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const ALLOWED_ROLES = ['trainer', 'admin_country', 'admin_rec', 'admin_continental'] as const;

const questionSchema = z.object({
  questionText: z.record(z.string()),
  questionType: z.string().default('single_choice'),
  options: z.array(z.any()).optional(),
  correctAnswer: z.any(),
  difficulty: z.number().int().min(1).max(5).default(1),
  points: z.number().int().min(1).default(1),
  tags: z.array(z.string()).default([]),
  explanation: z.record(z.string()).optional(),
});

const bulkImportSchema = z.object({
  assessmentId: z.string().uuid(),
  questions: z.array(questionSchema).min(1).max(500),
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export async function questionRoutes(app: FastifyInstance) {
  // =========================================================================
  // POST / — Create a single question
  // =========================================================================
  app.post('/', {
    schema: {
      summary: 'Create a single question',
      tags: ['Questions'],
      security: BearerSecurity,
      body: {
        type: 'object',
        required: ['assessmentId', 'questionText', 'correctAnswer'],
        properties: {
          assessmentId: { type: 'string', format: 'uuid' },
          questionText: { type: 'object', description: 'MultiLang { fr, en, ar, pt }' },
          questionType: { type: 'string', default: 'single_choice' },
          options: { type: 'array', items: { type: 'object' } },
          correctAnswer: {},
          difficulty: { type: 'integer', minimum: 1, maximum: 5, default: 1 },
          points: { type: 'integer', minimum: 1, default: 1 },
          tags: { type: 'array', items: { type: 'string' } },
          explanation: { type: 'object', description: 'MultiLang { fr, en, ar, pt }' },
        },
      },
    },
    preHandler: [app.authenticate],
  }, async (req: any, reply) => {
    if (!ALLOWED_ROLES.includes(req.user.role)) {
      return reply.code(403).send({ success: false, error: 'Insufficient permissions' });
    }

    const body = req.body as any;

    const question = await queryOne(`
      INSERT INTO academy_core.questions
        (assessment_id, question_text, question_type, options, correct_answer, difficulty, points, tags, explanation)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      body.assessmentId,
      JSON.stringify(body.questionText),
      body.questionType || 'single_choice',
      JSON.stringify(body.options),
      JSON.stringify(body.correctAnswer),
      body.difficulty || 1,
      body.points || 1,
      body.tags || [],
      JSON.stringify(body.explanation),
    ]);

    return reply.code(201).send({ success: true, data: question });
  });

  // =========================================================================
  // POST /bulk-import — Import array of questions in a transaction
  // =========================================================================
  app.post('/bulk-import', {
    schema: {
      summary: 'Bulk import questions for an assessment',
      tags: ['Questions'],
      security: BearerSecurity,
      body: {
        type: 'object',
        required: ['assessmentId', 'questions'],
        properties: {
          assessmentId: { type: 'string', format: 'uuid' },
          questions: { type: 'array', items: { type: 'object' }, minItems: 1, maxItems: 500 },
        },
      },
    },
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!ALLOWED_ROLES.includes(user.role as any)) {
      return reply.code(403).send({ success: false, error: 'Insufficient permissions' });
    }

    const { assessmentId, questions } = validateBody(bulkImportSchema, request.body);

    // Verify assessment exists
    const assessment = await queryOne(
      'SELECT id FROM academy_core.assessments WHERE id = $1',
      [assessmentId],
    );
    if (!assessment) {
      return reply.code(404).send({ success: false, error: 'Assessment not found' });
    }

    const imported = await transaction(async (client) => {
      const results = [];
      for (const q of questions) {
        const { rows } = await client.query(`
          INSERT INTO academy_core.questions
            (assessment_id, question_text, question_type, options, correct_answer, difficulty, points, tags, explanation)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING id, question_type, difficulty, points
        `, [
          assessmentId,
          JSON.stringify(q.questionText),
          q.questionType,
          JSON.stringify(q.options || []),
          JSON.stringify(q.correctAnswer),
          q.difficulty,
          q.points,
          q.tags,
          q.explanation ? JSON.stringify(q.explanation) : null,
        ]);
        results.push(rows[0]);
      }
      return results;
    });

    return reply.code(201).send({
      success: true,
      data: { imported: imported.length, questions: imported },
    });
  });

  // =========================================================================
  // GET /assessment/:assessmentId — List questions for an assessment
  // =========================================================================
  app.get('/assessment/:assessmentId', {
    schema: {
      summary: 'List questions for an assessment',
      tags: ['Questions'],
      security: BearerSecurity,
    },
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { assessmentId } = request.params as { assessmentId: string };
    const questions = await query(
      `SELECT * FROM academy_core.questions WHERE assessment_id = $1 ORDER BY created_at`,
      [assessmentId],
    );
    return reply.send({ success: true, data: questions });
  });

  // =========================================================================
  // PUT /:id — Update a single question
  // =========================================================================
  app.put('/:id', {
    schema: {
      summary: 'Update a question',
      tags: ['Questions'],
      security: BearerSecurity,
    },
    preHandler: [app.authenticate],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const user = (req as any).user;
    if (!ALLOWED_ROLES.includes(user.role as any)) {
      return reply.code(403).send({ success: false, error: 'Insufficient permissions' });
    }
    const { id } = req.params as { id: string };
    const body = req.body as any;

    const sets: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (body.questionText) { sets.push(`question_text = $${idx++}::jsonb`); params.push(JSON.stringify(body.questionText)); }
    if (body.questionType) { sets.push(`question_type = $${idx++}`); params.push(body.questionType); }
    if (body.options !== undefined) { sets.push(`options = $${idx++}::jsonb`); params.push(JSON.stringify(body.options)); }
    if (body.correctAnswer !== undefined) { sets.push(`correct_answer = $${idx++}::jsonb`); params.push(JSON.stringify(body.correctAnswer)); }
    if (body.difficulty !== undefined) { sets.push(`difficulty = $${idx++}`); params.push(body.difficulty); }
    if (body.points !== undefined) { sets.push(`points = $${idx++}`); params.push(body.points); }
    if (body.tags) { sets.push(`tags = $${idx++}`); params.push(body.tags); }
    if (body.explanation !== undefined) { sets.push(`explanation = $${idx++}::jsonb`); params.push(body.explanation ? JSON.stringify(body.explanation) : null); }

    if (sets.length === 0) return reply.code(400).send({ success: false, error: 'No fields to update' });

    params.push(id);
    const question = await queryOne(
      `UPDATE academy_core.questions SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      params,
    );
    if (!question) return reply.code(404).send({ success: false, error: 'Question not found' });
    return reply.send({ success: true, data: question });
  });

  // =========================================================================
  // DELETE /:id — Delete a question
  // =========================================================================
  app.delete('/:id', {
    schema: {
      summary: 'Delete a question',
      tags: ['Questions'],
      security: BearerSecurity,
    },
    preHandler: [app.authenticate],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const user = (req as any).user;
    if (!ALLOWED_ROLES.includes(user.role as any)) {
      return reply.code(403).send({ success: false, error: 'Insufficient permissions' });
    }
    const { id } = req.params as { id: string };
    await query('DELETE FROM academy_core.questions WHERE id = $1', [id]);
    return reply.code(204).send();
  });

  // =========================================================================
  // GET /export?assessmentId= — Export all questions for an assessment
  // =========================================================================
  app.get('/export', {
    schema: {
      summary: 'Export questions for an assessment',
      tags: ['Questions'],
      security: BearerSecurity,
      querystring: {
        type: 'object',
        required: ['assessmentId'],
        properties: {
          assessmentId: { type: 'string', format: 'uuid' },
        },
      },
    },
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!ALLOWED_ROLES.includes(user.role as any)) {
      return reply.code(403).send({ success: false, error: 'Insufficient permissions' });
    }

    const { assessmentId } = request.query as { assessmentId?: string };
    if (!assessmentId) {
      return reply.code(400).send({ success: false, error: 'assessmentId query param required' });
    }

    const questions = await query(
      `SELECT id, question_text, question_type, options, correct_answer,
              difficulty, points, tags, explanation, created_at
       FROM academy_core.questions
       WHERE assessment_id = $1
       ORDER BY created_at`,
      [assessmentId],
    );

    return reply.send({ success: true, data: questions });
  });
}
