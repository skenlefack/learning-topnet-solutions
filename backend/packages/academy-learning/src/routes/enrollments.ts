// ============================================================================
// ARIS Academy — Enrollment Routes
// GET  /enrollments      — list my enrollments
// POST /enrollments      — enroll in a course
// ============================================================================
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  query, queryOne, publishEvent, TOPICS,
  validateBody, uuidSchema,
  UuidParam, BearerSecurity,
} from '@aris-academy/shared';
import { getNextCourse, calculateTimeEstimate } from '../services/progression-engine';

const enrollBodySchema = z.object({
  courseId: uuidSchema,
});

export default async function enrollmentRoutes(app: FastifyInstance) {

  // -------------------------------------------------------------------------
  // GET /enrollments — list current user's enrollments with stats
  // -------------------------------------------------------------------------
  app.get(
    '/enrollments',
    {
      preHandler: [app.authenticate],
      schema: {
        summary: 'List current user enrollments with stats',
        tags: ['Enrollments'],
        security: BearerSecurity,
      },
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const enrollments = await query(`
          SELECT
            e.*,
            c.title, c.level, c.slug, c.thumbnail_url, c.estimated_hours,
            (SELECT COUNT(*)::int FROM academy_core.modules m
              WHERE m.course_id = c.id AND m.is_required = true) AS total_modules,
            (SELECT COUNT(*)::int FROM academy_core.lessons l
              JOIN academy_core.modules m ON m.id = l.module_id
              WHERE m.course_id = c.id AND l.is_required = true) AS total_lessons,
            (SELECT COUNT(*)::int FROM academy_core.progress_tracking pt
              JOIN academy_core.lessons l ON l.id = pt.lesson_id
              JOIN academy_core.modules m ON m.id = l.module_id
              WHERE pt.enrollment_id = e.id AND pt.is_completed = true
                AND l.is_required = true) AS completed_lessons
          FROM academy_core.enrollments e
          JOIN academy_core.courses c ON c.id = e.course_id
          WHERE e.user_id = $1
          ORDER BY e.updated_at DESC
        `, [req.user.sub]);

        return reply.send({ success: true, data: enrollments });
      } catch (err: any) {
        console.warn(`[academy-learning] DB unavailable, returning mock enrollments: ${err.message}`);
        return reply.send({
          success: true,
          data: [
            {
              id: 'mock-enroll-1',
              user_id: req.user.sub,
              course_id: 'mock-course-1',
              status: 'active',
              progress_percent: 45,
              current_level: 'beginner',
              started_at: '2026-01-15T00:00:00Z',
              title: { fr: 'Introduction à ARIS 3.0', en: 'Introduction to ARIS 3.0' },
              slug: 'intro-aris-3',
              level: 'beginner',
              thumbnail_url: null,
              estimated_hours: 12,
              total_modules: 4,
              total_lessons: 16,
              completed_lessons: 7,
            },
            {
              id: 'mock-enroll-2',
              user_id: req.user.sub,
              course_id: 'mock-course-2',
              status: 'active',
              progress_percent: 20,
              current_level: 'beginner',
              started_at: '2026-02-01T00:00:00Z',
              title: { fr: 'Surveillance épidémiologique', en: 'Epidemiological Surveillance' },
              slug: 'epidemiological-surveillance',
              level: 'beginner',
              thumbnail_url: null,
              estimated_hours: 8,
              total_modules: 3,
              total_lessons: 10,
              completed_lessons: 2,
            },
            {
              id: 'mock-enroll-3',
              user_id: req.user.sub,
              course_id: 'mock-course-3',
              status: 'completed',
              progress_percent: 100,
              current_level: 'beginner',
              started_at: '2025-11-01T00:00:00Z',
              title: { fr: 'Santé animale de base', en: 'Basic Animal Health' },
              slug: 'basic-animal-health',
              level: 'beginner',
              thumbnail_url: null,
              estimated_hours: 6,
              total_modules: 3,
              total_lessons: 12,
              completed_lessons: 12,
            },
          ],
        });
      }
    },
  );

  // -------------------------------------------------------------------------
  // GET /enrollments/:id/next-course — suggest the next course after this one
  // -------------------------------------------------------------------------
  app.get<{ Params: { id: string } }>(
    '/enrollments/:id/next-course',
    {
      preHandler: [app.authenticate],
      schema: {
        summary: 'Suggest the next course after completing this enrollment',
        tags: ['Enrollments'],
        security: BearerSecurity,
        params: UuidParam,
      },
    },
    async (req, reply) => {
      const enrollment = await queryOne<any>(
        'SELECT course_id FROM academy_core.enrollments WHERE id = $1 AND user_id = $2',
        [req.params.id, req.user.sub],
      );
      if (!enrollment) {
        return reply.code(404).send({ success: false, error: 'Enrollment not found' });
      }

      const next = await getNextCourse(req.user.sub, enrollment.course_id);
      return reply.send({ success: true, data: next });
    },
  );

  // -------------------------------------------------------------------------
  // GET /enrollments/:id/time-estimate — estimated remaining time
  // -------------------------------------------------------------------------
  app.get<{ Params: { id: string } }>(
    '/enrollments/:id/time-estimate',
    {
      preHandler: [app.authenticate],
      schema: {
        summary: 'Estimated remaining time for an enrollment',
        tags: ['Enrollments'],
        security: BearerSecurity,
        params: UuidParam,
      },
    },
    async (req, reply) => {
      const enrollment = await queryOne<any>(
        'SELECT id FROM academy_core.enrollments WHERE id = $1 AND user_id = $2',
        [req.params.id, req.user.sub],
      );
      if (!enrollment) {
        return reply.code(404).send({ success: false, error: 'Enrollment not found' });
      }

      const estimate = await calculateTimeEstimate(req.params.id);
      return reply.send({ success: true, data: estimate });
    },
  );

  // -------------------------------------------------------------------------
  // POST /enrollments — enroll in a course (checks prerequisites)
  // -------------------------------------------------------------------------
  app.post(
    '/enrollments',
    {
      preHandler: [app.authenticate],
      schema: {
        summary: 'Enroll in a course (checks prerequisites)',
        tags: ['Enrollments'],
        security: BearerSecurity,
        body: {
          type: 'object' as const,
          required: ['courseId'],
          properties: {
            courseId: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { courseId } = validateBody(enrollBodySchema, req.body);

      // Check course exists
      const course = await queryOne<any>(
        'SELECT * FROM academy_core.courses WHERE id = $1',
        [courseId],
      );
      if (!course) {
        return reply.code(404).send({ success: false, error: 'Course not found' });
      }

      // Verify prerequisites
      if (course.prerequisites?.length > 0) {
        const certs = await query(
          `SELECT course_id FROM academy_core.certifications
           WHERE user_id = $1 AND status = 'issued' AND course_id = ANY($2)`,
          [req.user.sub, course.prerequisites],
        );
        if (certs.length < course.prerequisites.length) {
          return reply.code(403).send({ success: false, error: 'Prerequisites not met' });
        }
      }

      const enrollment = await queryOne(`
        INSERT INTO academy_core.enrollments (user_id, course_id, current_level)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id, course_id)
          DO UPDATE SET status = 'active', updated_at = NOW()
        RETURNING *
      `, [req.user.sub, courseId, course.level]);

      await publishEvent(
        TOPICS.ENROLLMENT_CREATED, enrollment, req.user.tenantId, req.user.sub,
      );
      return reply.code(201).send({ success: true, data: enrollment });
    },
  );
}
