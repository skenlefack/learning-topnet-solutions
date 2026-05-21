// ============================================================================
// ARIS Academy — Public Routes (no authentication required)
// Platform stats, published courses listing, course detail with program
// ============================================================================
import { FastifyInstance } from 'fastify';
import { query, queryOne } from '@aris-academy/shared';

export async function publicRoutes(app: FastifyInstance) {
  // ─────────────────────────────────────────────────────────────────────────
  // GET /stats — Platform statistics (public)
  // ─────────────────────────────────────────────────────────────────────────
  app.get('/stats', {
    schema: {
      summary: 'Public platform statistics',
      tags: ['Public'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                courses: { type: 'number' },
                enrollments: { type: 'number' },
                certifications: { type: 'number' },
                paths: { type: 'number' },
              },
            },
          },
        },
      },
    },
  }, async (_request, reply) => {
    try {
      const [coursesRes, enrollmentsRes, certsRes, pathsRes] = await Promise.all([
        queryOne<{ count: string }>(`SELECT COUNT(*) FROM academy_core.courses WHERE status = 'published'`),
        queryOne<{ count: string }>(`SELECT COUNT(*) FROM academy_core.enrollments`),
        queryOne<{ count: string }>(`SELECT COUNT(*) FROM academy_core.certifications WHERE status = 'issued'`),
        queryOne<{ count: string }>(`SELECT COUNT(*) FROM academy_core.learning_paths`),
      ]);

      return reply.send({
        success: true,
        data: {
          courses: parseInt(coursesRes?.count || '0', 10),
          enrollments: parseInt(enrollmentsRes?.count || '0', 10),
          certifications: parseInt(certsRes?.count || '0', 10),
          paths: parseInt(pathsRes?.count || '0', 10),
        },
      });
    } catch (err: any) {
      app.log.warn(`[public/stats] DB unavailable: ${err.message}`);
      return reply.send({
        success: true,
        data: { courses: 0, enrollments: 0, certifications: 0, paths: 0 },
      });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GET /courses — Published courses listing (public)
  // ─────────────────────────────────────────────────────────────────────────
  app.get('/courses', {
    schema: {
      summary: 'List published courses (public)',
      tags: ['Public'],
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'number', default: 12 },
          offset: { type: 'number', default: 0 },
          lang: { type: 'string', default: 'fr' },
          level: { type: 'string' },
          search: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { limit = 12, offset = 0, lang = 'fr', level, search } = request.query as any;

    try {
      const conditions = [`c.status = 'published'`];
      const params: any[] = [];
      let paramIdx = 1;

      if (level) {
        conditions.push(`c.level = $${paramIdx++}`);
        params.push(level);
      }

      if (search) {
        conditions.push(`(c.title->>'${lang}' ILIKE $${paramIdx} OR c.title->>'en' ILIKE $${paramIdx} OR c.description->>'${lang}' ILIKE $${paramIdx})`);
        params.push(`%${search}%`);
        paramIdx++;
      }

      const where = conditions.join(' AND ');

      const countRes = await queryOne<{ count: string }>(
        `SELECT COUNT(*) FROM academy_core.courses c WHERE ${where}`,
        params,
      );

      const rows = await query(
        `SELECT
          c.id, c.slug, c.title, c.description, c.level, c.estimated_hours,
          c.tags, c.thumbnail_url, c.published_at, c.metadata, c.category_id,
          (SELECT COUNT(*) FROM academy_core.modules m WHERE m.course_id = c.id) AS module_count,
          (SELECT COUNT(*) FROM academy_core.enrollments e WHERE e.course_id = c.id) AS enrollment_count
        FROM academy_core.courses c
        WHERE ${where}
        ORDER BY c.published_at DESC NULLS LAST, c.created_at DESC
        LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
        [...params, limit, offset],
      );

      return reply.send({
        success: true,
        data: rows.map((r: any) => ({
          ...r,
          module_count: parseInt(r.module_count || '0', 10),
          enrollment_count: parseInt(r.enrollment_count || '0', 10),
        })),
        meta: {
          total: parseInt(countRes?.count || '0', 10),
          limit,
          offset,
        },
      });
    } catch (err: any) {
      app.log.warn(`[public/courses] DB unavailable: ${err.message}`);
      return reply.send({ success: true, data: [], meta: { total: 0, limit, offset } });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GET /courses/:id — Course detail with module program (public)
  // Does NOT expose lesson IDs or content — only module structure
  // ─────────────────────────────────────────────────────────────────────────
  app.get('/courses/:id', {
    schema: {
      summary: 'Course detail with program (public)',
      tags: ['Public'],
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      // Try by ID or by slug
      const course = await queryOne(
        `SELECT
          c.id, c.slug, c.title, c.description, c.level, c.estimated_hours,
          c.tags, c.thumbnail_url, c.passing_score, c.published_at, c.prerequisites,
          c.metadata, c.category_id,
          (SELECT COUNT(*) FROM academy_core.enrollments e WHERE e.course_id = c.id) AS enrollment_count
        FROM academy_core.courses c
        WHERE (c.id::text = $1 OR c.slug = $1) AND c.status = 'published'`,
        [id],
      );

      if (!course) {
        return reply.code(404).send({ success: false, error: 'Course not found' });
      }

      // Get modules with lesson counts (no lesson details exposed)
      const modules = await query(
        `SELECT
          m.id, m.title, m.description, m.sort_order, m.estimated_minutes, m.is_required,
          (SELECT COUNT(*) FROM academy_core.lessons l WHERE l.module_id = m.id) AS lesson_count
        FROM academy_core.modules m
        WHERE m.course_id = $1
        ORDER BY m.sort_order ASC`,
        [course.id],
      );

      return reply.send({
        success: true,
        data: {
          ...course,
          enrollment_count: parseInt(course.enrollment_count || '0', 10),
          modules: modules.map((m: any) => ({
            ...m,
            lesson_count: parseInt(m.lesson_count || '0', 10),
          })),
        },
      });
    } catch (err: any) {
      app.log.warn(`[public/courses/:id] DB unavailable: ${err.message}`);
      return reply.code(503).send({ success: false, error: 'Service temporarily unavailable' });
    }
  });
}
