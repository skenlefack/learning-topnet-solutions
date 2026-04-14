// ============================================================================
// ARIS Academy — Global Search Routes
// GET /search?q=&lang= — ILIKE on courses/modules/lessons JSONB, respects RLS
// ============================================================================
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { query, validateBody } from '@aris-academy/shared';

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const searchQuerySchema = z.object({
  q: z.string().min(1).max(200),
  lang: z.enum(['fr', 'en', 'ar', 'pt']).default('fr'),
  limit: z.coerce.number().int().min(1).max(20).default(5),
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export async function searchRoutes(app: FastifyInstance): Promise<void> {

  // =========================================================================
  // GET /search?q=&lang=&limit= — Global search
  // =========================================================================
  app.get('/search', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { q, lang, limit } = validateBody(searchQuerySchema, request.query);
    const pattern = `%${q}%`;

    try {
      // Search courses
      const courses = await query(
        `SELECT id, title, description, slug, level, status, thumbnail_url
         FROM academy_core.courses
         WHERE (title->>'${lang}' ILIKE $1 OR description->>'${lang}' ILIKE $1)
           AND (tenant_id = $2 OR tenant_level = 'continental')
           AND status = 'published'
         ORDER BY
           CASE WHEN title->>'${lang}' ILIKE $1 THEN 0 ELSE 1 END,
           created_at DESC
         LIMIT $3`,
        [pattern, request.tenantId, limit],
      );

      // Search modules
      const modules = await query(
        `SELECT m.id, m.title, m.course_id, c.title AS course_title, c.slug AS course_slug
         FROM academy_core.modules m
         JOIN academy_core.courses c ON c.id = m.course_id
         WHERE m.title->>'${lang}' ILIKE $1
           AND (c.tenant_id = $2 OR c.tenant_level = 'continental')
           AND c.status = 'published'
         ORDER BY m.sort_order
         LIMIT $3`,
        [pattern, request.tenantId, limit],
      );

      // Search lessons
      const lessons = await query(
        `SELECT l.id, l.title, l.type, l.module_id, m.course_id,
                c.title AS course_title, c.slug AS course_slug
         FROM academy_core.lessons l
         JOIN academy_core.modules m ON m.id = l.module_id
         JOIN academy_core.courses c ON c.id = m.course_id
         WHERE l.title->>'${lang}' ILIKE $1
           AND (c.tenant_id = $2 OR c.tenant_level = 'continental')
           AND c.status = 'published'
         ORDER BY l.sort_order
         LIMIT $3`,
        [pattern, request.tenantId, limit],
      );

      return reply.send({
        success: true,
        data: { courses, modules, lessons },
      });
    } catch (err: any) {
      console.warn(`[academy-course] Search failed: ${err.message}`);
      return reply.send({
        success: true,
        data: { courses: [], modules: [], lessons: [] },
      });
    }
  });
}
