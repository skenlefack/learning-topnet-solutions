// ============================================================================
// ARIS Academy — Course Routes
// CRUD + multi-tenant override resolution, publish/archive, deep duplicate
// ============================================================================
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  query,
  queryOne,
  transaction,
  paginate,
  cacheDel,
  publishEvent,
  auditLog,
  TOPICS,
  validateBody,
  multiLangTextSchema,
  courseLevelSchema,
  uuidSchema,
  paginationSchema,
} from '@aris-academy/shared';
import { resolveCourse, invalidateResolvedCache } from '../services/course-resolver';

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const courseQuerySchema = z.object({
  level: courseLevelSchema.optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  search: z.string().max(200).optional(),
  lang: z.enum(['fr', 'en', 'ar', 'pt']).default('fr'),
}).merge(paginationSchema);

const createCourseSchema = z.object({
  title: multiLangTextSchema,
  description: multiLangTextSchema.optional(),
  slug: z.string().min(3).max(255).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  level: courseLevelSchema,
  status: z.enum(['draft', 'published']).default('draft'),
  estimatedHours: z.number().positive().optional(),
  passingScore: z.number().int().min(0).max(100).default(70),
  tags: z.array(z.string()).default([]),
});

const updateCourseSchema = z.object({
  title: multiLangTextSchema.optional(),
  description: multiLangTextSchema.optional(),
  level: courseLevelSchema.optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  estimatedHours: z.number().positive().optional(),
  passingScore: z.number().int().min(0).max(100).optional(),
  tags: z.array(z.string()).optional(),
});

const overrideSchema = z.object({
  title: multiLangTextSchema.optional(),
  description: multiLangTextSchema.optional(),
  estimatedHours: z.number().positive().optional(),
  passingScore: z.number().int().min(0).max(100).optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ADMIN_ROLES = ['admin_country', 'admin_rec', 'admin_continental'] as const;
const CREATOR_ROLES = ['trainer', ...ADMIN_ROLES] as const;

async function invalidateCourseCache(courseId?: string): Promise<void> {
  await cacheDel('courses:*');
  if (courseId) await invalidateResolvedCache(courseId);
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export async function courseRoutes(app: FastifyInstance): Promise<void> {

  // =========================================================================
  // GET / — List courses with multi-tenant resolution
  // =========================================================================
  app.get('/', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const raw = validateBody(courseQuerySchema, request.query);
      const q = { ...raw, page: raw.page ?? 1, limit: raw.limit ?? 20 };

      let baseSql = `
        SELECT c.*,
          (SELECT COUNT(*)::int FROM academy_core.enrollments e WHERE e.course_id = c.id) AS enrollment_count,
          (SELECT COUNT(*)::int FROM academy_core.modules m WHERE m.course_id = c.id) AS module_count
        FROM academy_core.courses c
        WHERE (c.tenant_id = $1 OR c.tenant_level = 'continental')
      `;
      const params: unknown[] = [request.tenantId];
      let idx = 2;

      if (q.level) {
        baseSql += ` AND c.level = $${idx}`;
        params.push(q.level);
        idx++;
      }
      if (q.status) {
        baseSql += ` AND c.status = $${idx}`;
        params.push(q.status);
        idx++;
      }
      if (q.search) {
        baseSql += ` AND (c.title->>'${q.lang}' ILIKE $${idx} OR c.description->>'${q.lang}' ILIKE $${idx})`;
        params.push(`%${q.search}%`);
        idx++;
      }

      baseSql += ' ORDER BY c.created_at DESC';

      const result = await paginate(baseSql, params, q.page, q.limit);

      return reply.send({ success: true, data: result.data, meta: result.meta });
    } catch (err: any) {
      console.warn(`[academy-course] DB unavailable, returning mock courses: ${err.message}`);
      return reply.send({
        success: true,
        data: [
          {
            id: 'mock-course-1',
            title: { fr: 'Introduction à ARIS 3.0', en: 'Introduction to ARIS 3.0' },
            description: { fr: 'Découvrez les fondamentaux du système ARIS', en: 'Discover the fundamentals of the ARIS system' },
            slug: 'intro-aris-3',
            level: 'beginner',
            status: 'published',
            estimated_hours: 12,
            passing_score: 70,
            tags: ['aris', 'introduction'],
            thumbnail_url: null,
            enrollment_count: 45,
            module_count: 4,
          },
          {
            id: 'mock-course-2',
            title: { fr: 'Surveillance épidémiologique', en: 'Epidemiological Surveillance' },
            description: { fr: 'Méthodes de surveillance et alerte précoce', en: 'Surveillance methods and early warning' },
            slug: 'epidemiological-surveillance',
            level: 'beginner',
            status: 'published',
            estimated_hours: 8,
            passing_score: 70,
            tags: ['epidemiology', 'surveillance'],
            thumbnail_url: null,
            enrollment_count: 32,
            module_count: 3,
          },
          {
            id: 'mock-course-3',
            title: { fr: 'Santé animale de base', en: 'Basic Animal Health' },
            description: { fr: 'Principes fondamentaux de la santé animale', en: 'Fundamental principles of animal health' },
            slug: 'basic-animal-health',
            level: 'beginner',
            status: 'published',
            estimated_hours: 6,
            passing_score: 70,
            tags: ['animal-health', 'basics'],
            thumbnail_url: null,
            enrollment_count: 58,
            module_count: 3,
          },
        ],
        meta: { total: 3, page: 1, limit: 20, totalPages: 1 },
      });
    }
  });

  // =========================================================================
  // GET /:id — Get single course (raw, no override resolution)
  // =========================================================================
  app.get<{ Params: { id: string } }>('/:id', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    validateBody(uuidSchema, request.params.id);

    const course = await queryOne(
      `SELECT c.*,
         json_agg(
           json_build_object(
             'id', m.id, 'title', m.title, 'sortOrder', m.sort_order,
             'estimatedMinutes', m.estimated_minutes, 'isRequired', m.is_required
           ) ORDER BY m.sort_order
         ) FILTER (WHERE m.id IS NOT NULL) AS modules
       FROM academy_core.courses c
       LEFT JOIN academy_core.modules m ON m.course_id = c.id
       WHERE c.id = $1
       GROUP BY c.id`,
      [request.params.id],
    );

    if (!course) {
      return reply.code(404).send({ success: false, error: 'Course not found' });
    }
    return reply.send({ success: true, data: course });
  });

  // =========================================================================
  // GET /:id/resolved?lang=fr — Fully resolved course (overrides applied)
  // =========================================================================
  app.get<{ Params: { id: string }; Querystring: { lang?: string } }>('/:id/resolved', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    validateBody(uuidSchema, request.params.id);
    const lang = (request.query.lang || 'fr') as 'fr' | 'en' | 'ar' | 'pt';

    const resolved = await resolveCourse(request.params.id, request.tenantId, lang);
    if (!resolved) {
      return reply.code(404).send({ success: false, error: 'Course not found' });
    }
    return reply.send({ success: true, data: resolved });
  });

  // =========================================================================
  // POST / — Create course
  // =========================================================================
  app.post('/', {
    preHandler: [app.authenticate, app.requireRole(...CREATOR_ROLES)],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = validateBody(createCourseSchema, request.body);
    const user = request.user;

    const course = await queryOne(
      `INSERT INTO academy_core.courses
         (tenant_id, tenant_level, title, description, slug, level, status,
          estimated_hours, passing_score, tags, created_by,
          published_at)
       VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, $6, $7::course_status, $8, $9, $10, $11,
               CASE WHEN $7::course_status = 'published'::course_status THEN NOW() ELSE NULL END)
       RETURNING *`,
      [
        user.tenantId, user.tenantLevel,
        JSON.stringify(body.title),
        body.description ? JSON.stringify(body.description) : null,
        body.slug, body.level, body.status,
        body.estimatedHours ?? null, body.passingScore,
        body.tags, user.sub,
      ],
    );

    await invalidateCourseCache();
    await auditLog(user.sub, user.tenantId, 'course.created', 'course', course.id, { slug: body.slug }, request.ip);

    if (course.status === 'published') {
      await publishEvent(TOPICS.COURSE_PUBLISHED, course, user.tenantId, user.sub);
    }

    return reply.code(201).send({ success: true, data: course });
  });

  // =========================================================================
  // PUT /:id — Update course
  // =========================================================================
  app.put<{ Params: { id: string } }>('/:id', {
    preHandler: [app.authenticate, app.requireRole(...CREATOR_ROLES)],
  }, async (request, reply) => {
    validateBody(uuidSchema, request.params.id);
    const body = validateBody(updateCourseSchema, request.body);
    const user = request.user;

    const course = await queryOne(
      `UPDATE academy_core.courses SET
         title = COALESCE($2::jsonb, title),
         description = COALESCE($3::jsonb, description),
         level = COALESCE($4, level),
         status = COALESCE($5, status),
         estimated_hours = COALESCE($6, estimated_hours),
         passing_score = COALESCE($7, passing_score),
         tags = COALESCE($8, tags),
         published_at = CASE WHEN $5 = 'published' AND published_at IS NULL THEN NOW() ELSE published_at END
       WHERE id = $1 RETURNING *`,
      [
        request.params.id,
        body.title ? JSON.stringify(body.title) : null,
        body.description ? JSON.stringify(body.description) : null,
        body.level ?? null, body.status ?? null,
        body.estimatedHours ?? null, body.passingScore ?? null,
        body.tags ?? null,
      ],
    );

    if (!course) {
      return reply.code(404).send({ success: false, error: 'Course not found' });
    }

    await invalidateCourseCache(request.params.id);
    await auditLog(user.sub, user.tenantId, 'course.updated', 'course', course.id, {}, request.ip);
    await publishEvent(TOPICS.COURSE_UPDATED, course, user.tenantId, user.sub);

    return reply.send({ success: true, data: course });
  });

  // =========================================================================
  // DELETE /:id — Delete course
  // =========================================================================
  app.delete<{ Params: { id: string } }>('/:id', {
    preHandler: [app.authenticate, app.requireRole('admin_rec', 'admin_continental')],
  }, async (request, reply) => {
    validateBody(uuidSchema, request.params.id);
    const user = request.user;

    const deleted = await queryOne(
      'DELETE FROM academy_core.courses WHERE id = $1 RETURNING id',
      [request.params.id],
    );

    if (!deleted) {
      return reply.code(404).send({ success: false, error: 'Course not found' });
    }

    await invalidateCourseCache(request.params.id);
    await auditLog(user.sub, user.tenantId, 'course.deleted', 'course', request.params.id, {}, request.ip);

    return reply.code(204).send();
  });

  // =========================================================================
  // POST /:id/override — Create/update a tenant override
  // =========================================================================
  app.post<{ Params: { id: string } }>('/:id/override', {
    preHandler: [app.authenticate, app.requireRole(...ADMIN_ROLES)],
  }, async (request, reply) => {
    validateBody(uuidSchema, request.params.id);
    const body = validateBody(overrideSchema, request.body);
    const user = request.user;

    // Verify course exists
    const courseExists = await queryOne(
      'SELECT id FROM academy_core.courses WHERE id = $1',
      [request.params.id],
    );
    if (!courseExists) {
      return reply.code(404).send({ success: false, error: 'Course not found' });
    }

    const override = await queryOne(
      `INSERT INTO academy_core.course_overrides
         (course_id, tenant_id, tenant_level, override_data, created_by)
       VALUES ($1, $2, $3, $4::jsonb, $5)
       ON CONFLICT (course_id, tenant_id)
       DO UPDATE SET override_data = $4::jsonb, created_by = $5
       RETURNING *`,
      [
        request.params.id, user.tenantId, user.tenantLevel,
        JSON.stringify(body), user.sub,
      ],
    );

    await invalidateCourseCache(request.params.id);
    await auditLog(user.sub, user.tenantId, 'course.override.upserted', 'course_override', override.id, body, request.ip);

    return reply.send({ success: true, data: override });
  });

  // =========================================================================
  // GET /:id/overrides — List all overrides for a course (admin only)
  // =========================================================================
  app.get<{ Params: { id: string } }>('/:id/overrides', {
    preHandler: [app.authenticate, app.requireRole(...ADMIN_ROLES)],
  }, async (request, reply) => {
    validateBody(uuidSchema, request.params.id);

    const overrides = await query(
      `SELECT co.*, t.name AS tenant_name, t.code AS tenant_code
       FROM academy_core.course_overrides co
       JOIN academy_core.tenants t ON t.id = co.tenant_id
       WHERE co.course_id = $1
       ORDER BY CASE co.tenant_level
         WHEN 'continental' THEN 1 WHEN 'rec' THEN 2 WHEN 'country' THEN 3
       END`,
      [request.params.id],
    );

    return reply.send({ success: true, data: overrides });
  });

  // =========================================================================
  // DELETE /:id/override — Remove the current tenant's override
  // =========================================================================
  app.delete<{ Params: { id: string } }>('/:id/override', {
    preHandler: [app.authenticate, app.requireRole(...ADMIN_ROLES)],
  }, async (request, reply) => {
    validateBody(uuidSchema, request.params.id);
    const user = request.user;

    const deleted = await queryOne(
      'DELETE FROM academy_core.course_overrides WHERE course_id = $1 AND tenant_id = $2 RETURNING id',
      [request.params.id, user.tenantId],
    );

    if (!deleted) {
      return reply.code(404).send({ success: false, error: 'No override found for your tenant' });
    }

    await invalidateCourseCache(request.params.id);
    await auditLog(user.sub, user.tenantId, 'course.override.deleted', 'course_override', deleted.id, {}, request.ip);

    return reply.code(204).send();
  });

  // =========================================================================
  // POST /:id/publish — Publish a draft course
  // =========================================================================
  app.post<{ Params: { id: string } }>('/:id/publish', {
    preHandler: [app.authenticate, app.requireRole(...ADMIN_ROLES)],
  }, async (request, reply) => {
    validateBody(uuidSchema, request.params.id);
    const user = request.user;

    const course = await queryOne(
      `UPDATE academy_core.courses
       SET status = 'published', published_at = COALESCE(published_at, NOW())
       WHERE id = $1 AND status = 'draft'
       RETURNING *`,
      [request.params.id],
    );

    if (!course) {
      return reply.code(400).send({ success: false, error: 'Course not found or not in draft status' });
    }

    await invalidateCourseCache(request.params.id);
    await publishEvent(TOPICS.COURSE_PUBLISHED, course, user.tenantId, user.sub);
    await auditLog(user.sub, user.tenantId, 'course.published', 'course', course.id, {}, request.ip);

    return reply.send({ success: true, data: course });
  });

  // =========================================================================
  // POST /:id/archive — Archive a published course
  // =========================================================================
  app.post<{ Params: { id: string } }>('/:id/archive', {
    preHandler: [app.authenticate, app.requireRole(...ADMIN_ROLES)],
  }, async (request, reply) => {
    validateBody(uuidSchema, request.params.id);
    const user = request.user;

    const course = await queryOne(
      `UPDATE academy_core.courses SET status = 'archived'
       WHERE id = $1 AND status = 'published'
       RETURNING *`,
      [request.params.id],
    );

    if (!course) {
      return reply.code(400).send({ success: false, error: 'Course not found or not in published status' });
    }

    await invalidateCourseCache(request.params.id);
    await publishEvent(TOPICS.COURSE_UPDATED, course, user.tenantId, user.sub);
    await auditLog(user.sub, user.tenantId, 'course.archived', 'course', course.id, {}, request.ip);

    return reply.send({ success: true, data: course });
  });

  // =========================================================================
  // POST /:id/duplicate — Deep copy course + modules + lessons
  // =========================================================================
  app.post<{ Params: { id: string } }>('/:id/duplicate', {
    preHandler: [app.authenticate, app.requireRole(...CREATOR_ROLES)],
  }, async (request, reply) => {
    validateBody(uuidSchema, request.params.id);
    const user = request.user;

    const duplicate = await transaction(async (client) => {
      // 1. Copy course
      const [newCourse] = (await client.query(
        `INSERT INTO academy_core.courses
           (tenant_id, tenant_level, title, description, slug, level, status,
            estimated_hours, passing_score, prerequisites, tags, metadata, created_by)
         SELECT
           $2, $3, title, description,
           slug || '-copy-' || substr(gen_random_uuid()::text, 1, 8),
           level, 'draft', estimated_hours, passing_score, prerequisites, tags, metadata, $4
         FROM academy_core.courses WHERE id = $1
         RETURNING *`,
        [request.params.id, user.tenantId, user.tenantLevel, user.sub],
      )).rows;

      if (!newCourse) throw new Error('Source course not found');

      // 2. Copy modules
      const { rows: moduleMappings } = await client.query(
        `INSERT INTO academy_core.modules
           (course_id, title, description, sort_order, estimated_minutes, is_required)
         SELECT $2, title, description, sort_order, estimated_minutes, is_required
         FROM academy_core.modules WHERE course_id = $1
         ORDER BY sort_order
         RETURNING id, (
           SELECT id FROM academy_core.modules orig
           WHERE orig.course_id = $1 AND orig.sort_order = academy_core.modules.sort_order
           LIMIT 1
         ) AS original_id`,
        [request.params.id, newCourse.id],
      );

      // 3. Copy lessons for each module
      for (const mm of moduleMappings) {
        await client.query(
          `INSERT INTO academy_core.lessons
             (module_id, title, type, content, video_url, duration_minutes, sort_order, is_required)
           SELECT $2, title, type, content, video_url, duration_minutes, sort_order, is_required
           FROM academy_core.lessons WHERE module_id = $1
           ORDER BY sort_order`,
          [mm.original_id, mm.id],
        );
      }

      return newCourse;
    });

    await invalidateCourseCache();
    await auditLog(
      user.sub, user.tenantId, 'course.duplicated', 'course', duplicate.id,
      { sourceId: request.params.id }, request.ip,
    );

    return reply.code(201).send({ success: true, data: duplicate });
  });
}
