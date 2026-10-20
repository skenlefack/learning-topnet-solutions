// ============================================================================
// Topnet Solutions Academy — Progress Routes
// GET  /progress/:enrollmentId   — detailed progress for an enrollment
// POST /progress                 — update lesson progress (standard)
// POST /progress/video-heartbeat — high-frequency video position (Redis buffer)
// GET  /progress/resume/:lessonId — last video playback position
// ============================================================================
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  query, queryOne, publishEvent, TOPICS,
  getRedis, validateBody, uuidSchema,
  UuidParamNamed, BearerSecurity,
} from '@topnet-academy/shared';
import { recalculateProgress, updateStreak } from '../services/progression-engine';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const progressBodySchema = z.object({
  lessonId: uuidSchema,
  enrollmentId: uuidSchema,
  timeSpentSeconds: z.number().int().min(0).optional(),
  lastPositionSeconds: z.number().int().min(0).optional(),
  isCompleted: z.boolean().optional(),
  score: z.number().min(0).max(100).optional(),
});

const heartbeatBodySchema = z.object({
  lessonId: uuidSchema,
  enrollmentId: uuidSchema,
  seconds: z.number().int().min(0),
  position: z.number().int().min(0),
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export default async function progressRoutes(app: FastifyInstance) {

  // -------------------------------------------------------------------------
  // GET /progress/:enrollmentId — per-lesson progress for an enrollment
  // -------------------------------------------------------------------------
  app.get<{ Params: { enrollmentId: string } }>(
    '/progress/:enrollmentId',
    {
      preHandler: [app.authenticate],
      schema: {
        summary: 'Get per-lesson progress for an enrollment',
        tags: ['Progress'],
        security: BearerSecurity,
        params: UuidParamNamed('enrollmentId'),
      },
    },
    async (req, reply) => {
      const progress = await query(`
        SELECT
          pt.*,
          l.title  AS lesson_title,
          l.type   AS lesson_type,
          l.duration_minutes,
          m.title  AS module_title,
          m.sort_order AS module_order
        FROM academy_core.progress_tracking pt
        JOIN academy_core.lessons l ON l.id = pt.lesson_id
        JOIN academy_core.modules m ON m.id = l.module_id
        WHERE pt.enrollment_id = $1
        ORDER BY m.sort_order, l.sort_order
      `, [req.params.enrollmentId]);

      return reply.send({ success: true, data: progress });
    },
  );

  // -------------------------------------------------------------------------
  // POST /progress — standard lesson progress update (writes to DB)
  // -------------------------------------------------------------------------
  app.post(
    '/progress',
    {
      preHandler: [app.authenticate],
      schema: {
        summary: 'Update lesson progress',
        tags: ['Progress'],
        security: BearerSecurity,
        body: {
          type: 'object' as const,
          required: ['lessonId', 'enrollmentId'],
          properties: {
            lessonId: { type: 'string', format: 'uuid' },
            enrollmentId: { type: 'string', format: 'uuid' },
            timeSpentSeconds: { type: 'integer', minimum: 0 },
            lastPositionSeconds: { type: 'integer', minimum: 0 },
            isCompleted: { type: 'boolean' },
            score: { type: 'number', minimum: 0, maximum: 100 },
          },
        },
      },
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const body = validateBody(progressBodySchema, req.body);

      const progress = await queryOne(`
        INSERT INTO academy_core.progress_tracking
          (user_id, lesson_id, enrollment_id, time_spent_seconds,
           last_position_seconds, is_completed, score, attempts)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 1)
        ON CONFLICT (user_id, lesson_id) DO UPDATE SET
          time_spent_seconds  = progress_tracking.time_spent_seconds + COALESCE($4, 0),
          last_position_seconds = COALESCE($5, progress_tracking.last_position_seconds),
          is_completed = COALESCE($6, progress_tracking.is_completed),
          score        = COALESCE($7, progress_tracking.score),
          attempts     = progress_tracking.attempts + 1,
          completed_at = CASE
            WHEN $6 = true AND progress_tracking.completed_at IS NULL
            THEN NOW() ELSE progress_tracking.completed_at END,
          updated_at   = NOW()
        RETURNING *
      `, [
        req.user.sub,
        body.lessonId,
        body.enrollmentId,
        body.timeSpentSeconds ?? 0,
        body.lastPositionSeconds,
        body.isCompleted,
        body.score,
      ]);

      await publishEvent(
        TOPICS.PROGRESS_UPDATED, progress, req.user.tenantId, req.user.sub,
      );

      if (body.isCompleted) {
        await publishEvent(
          TOPICS.LESSON_COMPLETED,
          { lessonId: body.lessonId, enrollmentId: body.enrollmentId, userId: req.user.sub },
          req.user.tenantId,
          req.user.sub,
        );
        await recalculateProgress(body.enrollmentId);
      }

      // Update streak on any activity
      await updateStreak(req.user.sub);

      return reply.send({ success: true, data: progress });
    },
  );

  // -------------------------------------------------------------------------
  // POST /progress/video-heartbeat
  // High-frequency endpoint (~30 s interval) — writes to Redis only.
  // A background job flushes accumulated data to PostgreSQL every 5 min.
  // -------------------------------------------------------------------------
  app.post(
    '/progress/video-heartbeat',
    {
      preHandler: [app.authenticate],
      schema: {
        summary: 'High-frequency video playback heartbeat (Redis buffer)',
        tags: ['Progress'],
        security: BearerSecurity,
        body: {
          type: 'object' as const,
          required: ['lessonId', 'enrollmentId', 'seconds', 'position'],
          properties: {
            lessonId: { type: 'string', format: 'uuid' },
            enrollmentId: { type: 'string', format: 'uuid' },
            seconds: { type: 'integer', minimum: 0 },
            position: { type: 'integer', minimum: 0 },
          },
        },
      },
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const body = validateBody(heartbeatBodySchema, req.body);
      const redis = getRedis();
      const key = `progress:video:${req.user.sub}:${body.lessonId}`;

      // Accumulate seconds, keep latest position — all in Redis
      const existing = await redis.hget(key, 'seconds');
      const prevSeconds = parseInt(existing || '0', 10);

      await redis.hmset(key, {
        userId: req.user.sub,
        lessonId: body.lessonId,
        enrollmentId: body.enrollmentId,
        seconds: String(prevSeconds + body.seconds),
        position: String(body.position),
        updatedAt: new Date().toISOString(),
      });
      // TTL = 10 min — auto-cleanup if flush job misses a key
      await redis.expire(key, 600);

      // Update streak (lightweight Redis op)
      await updateStreak(req.user.sub);

      return reply.send({ success: true });
    },
  );

  // -------------------------------------------------------------------------
  // GET /progress/resume/:lessonId
  // Returns the last video playback position (Redis first, DB fallback)
  // -------------------------------------------------------------------------
  app.get<{ Params: { lessonId: string } }>(
    '/progress/resume/:lessonId',
    {
      preHandler: [app.authenticate],
      schema: {
        summary: 'Resume video playback position for a lesson',
        tags: ['Progress'],
        security: BearerSecurity,
        params: UuidParamNamed('lessonId'),
      },
    },
    async (req, reply) => {
      const redis = getRedis();
      const key = `progress:video:${req.user.sub}:${req.params.lessonId}`;

      // Try Redis first (most recent position)
      const cached = await redis.hgetall(key);
      if (cached.position) {
        return reply.send({
          success: true,
          data: {
            lastPositionSeconds: parseInt(cached.position, 10),
            source: 'live',
          },
        });
      }

      // Fallback to DB
      const row = await queryOne<any>(
        `SELECT last_position_seconds
         FROM academy_core.progress_tracking
         WHERE user_id = $1 AND lesson_id = $2`,
        [req.user.sub, req.params.lessonId],
      );

      return reply.send({
        success: true,
        data: {
          lastPositionSeconds: row?.last_position_seconds ?? 0,
          source: 'db',
        },
      });
    },
  );

  // -------------------------------------------------------------------------
  // GET /lessons/:lessonId/context
  // Returns lesson + module + course + enrollment + progress + prev/next nav
  // -------------------------------------------------------------------------
  app.get<{ Params: { lessonId: string } }>(
    '/lessons/:lessonId/context',
    {
      preHandler: [app.authenticate],
      schema: {
        summary: 'Lesson context for the player (lesson, module, course, enrollment, progress, nav)',
        tags: ['Progress'],
        security: BearerSecurity,
        params: UuidParamNamed('lessonId'),
      },
    },
    async (req, reply) => {
      const userId = req.user.sub;
      const { lessonId } = req.params;

      // Fetch lesson + module + course in one query
      const lesson = await queryOne<any>(`
        SELECT l.*, m.course_id, m.title AS module_title, m.sort_order AS module_sort
        FROM academy_core.lessons l
        JOIN academy_core.modules m ON m.id = l.module_id
        WHERE l.id = $1
      `, [lessonId]);

      if (!lesson) {
        return reply.code(404).send({ success: false, error: 'Lesson not found' });
      }

      const course = await queryOne<any>(
        `SELECT * FROM academy_core.courses WHERE id = $1`,
        [lesson.course_id],
      );

      const mod = {
        id: lesson.module_id,
        title: lesson.module_title,
        sort_order: lesson.module_sort,
      };

      // Enrollment
      const enrollment = await queryOne<any>(
        `SELECT * FROM academy_core.enrollments WHERE user_id = $1 AND course_id = $2`,
        [userId, lesson.course_id],
      );

      // Progress
      const progress = enrollment
        ? await queryOne<any>(
            `SELECT * FROM academy_core.progress_tracking WHERE user_id = $1 AND lesson_id = $2`,
            [userId, lessonId],
          )
        : null;

      // Prev/next lesson navigation (all lessons in same course, ordered by module sort then lesson sort)
      const allLessons = await query<any>(
        `SELECT l.id, l.sort_order, m.sort_order AS module_sort
         FROM academy_core.lessons l
         JOIN academy_core.modules m ON m.id = l.module_id
         WHERE m.course_id = $1
         ORDER BY m.sort_order, l.sort_order`,
        [lesson.course_id],
      );

      const idx = allLessons.findIndex((l: any) => l.id === lessonId);
      const prev = idx > 0 ? allLessons[idx - 1].id : null;
      const next = idx < allLessons.length - 1 ? allLessons[idx + 1].id : null;

      return reply.send({
        success: true,
        data: { lesson, module: mod, course, enrollment, progress, prev, next },
      });
    },
  );
}
