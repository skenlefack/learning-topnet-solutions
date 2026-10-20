// ============================================================================
// Topnet Solutions Academy — Learning Paths Routes
// CRUD for multi-course learning paths (parcours de formation)
// ============================================================================
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { query, queryOne, validateBody, BearerSecurity } from '@topnet-academy/shared';

const pathSchema = z.object({
  title: z.record(z.string()).refine((v) => v.fr || v.en, 'Title required'),
  description: z.record(z.string()).optional(),
  slug: z.string().min(2).max(255),
  estimatedHours: z.number().positive().optional(),
  passingScore: z.number().int().min(0).max(100).optional(),
  thumbnailUrl: z.string().url().nullable().optional(),
  isPublished: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
});

const addCourseSchema = z.object({
  courseId: z.string().uuid(),
  sortOrder: z.number().int().optional(),
  isRequired: z.boolean().optional(),
});

export async function pathRoutes(app: FastifyInstance) {
  // GET / — List learning paths
  app.get('/', {
    schema: { summary: 'List learning paths', tags: ['Learning Paths'] },
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    const rows = await query(
      `SELECT lp.*,
        (SELECT COUNT(*) FROM academy_core.learning_path_courses lpc WHERE lpc.path_id = lp.id) AS course_count,
        (SELECT COUNT(*) FROM academy_core.learning_path_enrollments lpe WHERE lpe.path_id = lp.id) AS enrollment_count
       FROM academy_core.learning_paths lp
       ORDER BY lp.created_at DESC`,
    );
    return reply.send({
      success: true,
      data: rows.map((r: any) => ({
        ...r,
        course_count: parseInt(r.course_count || '0', 10),
        enrollment_count: parseInt(r.enrollment_count || '0', 10),
      })),
    });
  });

  // GET /public — List published paths (no auth)
  app.get('/public', {
    schema: { summary: 'List published learning paths (public)', tags: ['Learning Paths'] },
  }, async (_req, reply) => {
    const rows = await query(
      `SELECT lp.id, lp.title, lp.description, lp.slug, lp.estimated_hours, lp.thumbnail_url, lp.tags,
        (SELECT COUNT(*) FROM academy_core.learning_path_courses lpc WHERE lpc.path_id = lp.id) AS course_count
       FROM academy_core.learning_paths lp
       WHERE lp.is_published = true
       ORDER BY lp.created_at DESC`,
    );
    return reply.send({ success: true, data: rows.map((r: any) => ({ ...r, course_count: parseInt(r.course_count || '0', 10) })) });
  });

  // GET /:id — Get path detail with courses
  app.get('/:id', {
    schema: { summary: 'Get learning path detail', tags: ['Learning Paths'] },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const path = await queryOne(
      `SELECT * FROM academy_core.learning_paths WHERE id::text = $1 OR slug = $1`,
      [id],
    );
    if (!path) return reply.code(404).send({ success: false, error: 'Path not found' });

    const courses = await query(
      `SELECT lpc.sort_order, lpc.is_required, c.id, c.title, c.slug, c.level, c.estimated_hours, c.thumbnail_url,
        (SELECT COUNT(*) FROM academy_core.modules m WHERE m.course_id = c.id) AS module_count
       FROM academy_core.learning_path_courses lpc
       JOIN academy_core.courses c ON c.id = lpc.course_id
       WHERE lpc.path_id = $1
       ORDER BY lpc.sort_order ASC`,
      [path.id],
    );

    return reply.send({ success: true, data: { ...path, courses: courses.map((c: any) => ({ ...c, module_count: parseInt(c.module_count || '0', 10) })) } });
  });

  // POST / — Create learning path (admin)
  app.post('/', {
    schema: { summary: 'Create learning path', tags: ['Learning Paths'], security: BearerSecurity },
    preHandler: [app.authenticate, app.requireRole('admin_country', 'admin_rec', 'admin_continental')],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const data = validateBody(pathSchema, req.body);
    const user = (req as any).user;

    const path = await queryOne(
      `INSERT INTO academy_core.learning_paths (tenant_id, title, description, slug, estimated_hours, passing_score, thumbnail_url, is_published, tags, created_by)
       VALUES ($1, $2::jsonb, $3::jsonb, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [user.tenantId, JSON.stringify(data.title), data.description ? JSON.stringify(data.description) : null,
       data.slug, data.estimatedHours || null, data.passingScore || 70, data.thumbnailUrl || null,
       data.isPublished || false, data.tags || [], user.sub],
    );
    return reply.code(201).send({ success: true, data: path });
  });

  // PUT /:id — Update path (admin)
  app.put('/:id', {
    schema: { summary: 'Update learning path', tags: ['Learning Paths'], security: BearerSecurity },
    preHandler: [app.authenticate, app.requireRole('admin_country', 'admin_rec', 'admin_continental')],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const data = validateBody(pathSchema.partial(), req.body);
    const sets: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (data.title) { sets.push(`title = $${idx++}::jsonb`); params.push(JSON.stringify(data.title)); }
    if (data.description !== undefined) { sets.push(`description = $${idx++}::jsonb`); params.push(data.description ? JSON.stringify(data.description) : null); }
    if (data.slug) { sets.push(`slug = $${idx++}`); params.push(data.slug); }
    if (data.estimatedHours !== undefined) { sets.push(`estimated_hours = $${idx++}`); params.push(data.estimatedHours); }
    if (data.passingScore !== undefined) { sets.push(`passing_score = $${idx++}`); params.push(data.passingScore); }
    if (data.thumbnailUrl !== undefined) { sets.push(`thumbnail_url = $${idx++}`); params.push(data.thumbnailUrl); }
    if (data.isPublished !== undefined) { sets.push(`is_published = $${idx++}`); params.push(data.isPublished); }
    if (data.tags) { sets.push(`tags = $${idx++}`); params.push(data.tags); }

    if (sets.length === 0) return reply.code(400).send({ success: false, error: 'No fields to update' });

    params.push(id);
    const path = await queryOne(`UPDATE academy_core.learning_paths SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`, params);
    if (!path) return reply.code(404).send({ success: false, error: 'Path not found' });
    return reply.send({ success: true, data: path });
  });

  // DELETE /:id — Delete path (admin)
  app.delete('/:id', {
    schema: { summary: 'Delete learning path', tags: ['Learning Paths'], security: BearerSecurity },
    preHandler: [app.authenticate, app.requireRole('admin_rec', 'admin_continental')],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    await query('DELETE FROM academy_core.learning_paths WHERE id = $1', [id]);
    return reply.code(204).send();
  });

  // POST /:id/courses — Add course to path
  app.post('/:id/courses', {
    schema: { summary: 'Add course to learning path', tags: ['Learning Paths'], security: BearerSecurity },
    preHandler: [app.authenticate, app.requireRole('admin_country', 'admin_rec', 'admin_continental')],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const data = validateBody(addCourseSchema, req.body);

    const row = await queryOne(
      `INSERT INTO academy_core.learning_path_courses (path_id, course_id, sort_order, is_required)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (path_id, course_id) DO UPDATE SET sort_order = $3, is_required = $4
       RETURNING *`,
      [id, data.courseId, data.sortOrder || 0, data.isRequired !== false],
    );
    return reply.code(201).send({ success: true, data: row });
  });

  // DELETE /:id/courses/:courseId — Remove course from path
  app.delete('/:id/courses/:courseId', {
    schema: { summary: 'Remove course from learning path', tags: ['Learning Paths'], security: BearerSecurity },
    preHandler: [app.authenticate, app.requireRole('admin_country', 'admin_rec', 'admin_continental')],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id, courseId } = req.params as { id: string; courseId: string };
    await query('DELETE FROM academy_core.learning_path_courses WHERE path_id = $1 AND course_id = $2', [id, courseId]);
    return reply.code(204).send();
  });

  // POST /:id/enroll — Enroll current user in path
  app.post('/:id/enroll', {
    schema: { summary: 'Enroll in learning path', tags: ['Learning Paths'], security: BearerSecurity },
    preHandler: [app.authenticate],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const user = (req as any).user;

    const enrollment = await queryOne(
      `INSERT INTO academy_core.learning_path_enrollments (user_id, path_id, status)
       VALUES ($1, $2, 'active')
       ON CONFLICT (user_id, path_id) DO NOTHING
       RETURNING *`,
      [user.sub, id],
    );
    return reply.code(201).send({ success: true, data: enrollment });
  });
}
