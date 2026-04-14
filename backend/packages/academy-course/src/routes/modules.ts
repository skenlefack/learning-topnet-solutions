// ============================================================================
// ARIS Academy — Module Routes
// CRUD + reordering for course modules
// ============================================================================
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  query,
  queryOne,
  transaction,
  cacheDel,
  validateBody,
  multiLangTextSchema,
  uuidSchema,
  auditLog,
} from '@aris-academy/shared';
import { invalidateResolvedCache } from '../services/course-resolver';

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const createModuleSchema = z.object({
  courseId: z.string().uuid(),
  title: multiLangTextSchema,
  description: multiLangTextSchema.optional(),
  sortOrder: z.number().int().min(0).default(0),
  estimatedMinutes: z.number().int().positive().optional(),
  isRequired: z.boolean().default(true),
});

const updateModuleSchema = z.object({
  title: multiLangTextSchema.optional(),
  description: multiLangTextSchema.optional(),
  sortOrder: z.number().int().min(0).optional(),
  estimatedMinutes: z.number().int().positive().optional(),
  isRequired: z.boolean().optional(),
});

const reorderSchema = z.object({
  moduleIds: z.array(z.string().uuid()).min(1),
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export async function moduleRoutes(app: FastifyInstance): Promise<void> {

  // =========================================================================
  // GET /course/:courseId — List modules with nested lessons
  // =========================================================================
  app.get<{ Params: { courseId: string } }>('/course/:courseId', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    validateBody(uuidSchema, request.params.courseId);

    const modules = await query(
      `SELECT m.*,
         json_agg(
           json_build_object(
             'id', l.id, 'title', l.title, 'type', l.type,
             'sortOrder', l.sort_order, 'durationMinutes', l.duration_minutes
           ) ORDER BY l.sort_order
         ) FILTER (WHERE l.id IS NOT NULL) AS lessons
       FROM academy_core.modules m
       LEFT JOIN academy_core.lessons l ON l.module_id = m.id
       WHERE m.course_id = $1
       GROUP BY m.id
       ORDER BY m.sort_order`,
      [request.params.courseId],
    );

    return reply.send({ success: true, data: modules });
  });

  // =========================================================================
  // POST / — Create module
  // =========================================================================
  app.post('/', {
    preHandler: [app.authenticate, app.requireRole('trainer', 'admin_country', 'admin_rec', 'admin_continental')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = validateBody(createModuleSchema, request.body);
    const user = request.user;

    const mod = await queryOne(
      `INSERT INTO academy_core.modules
         (course_id, title, description, sort_order, estimated_minutes, is_required)
       VALUES ($1, $2::jsonb, $3::jsonb, $4, $5, $6)
       RETURNING *`,
      [
        body.courseId, JSON.stringify(body.title),
        body.description ? JSON.stringify(body.description) : null,
        body.sortOrder, body.estimatedMinutes ?? null, body.isRequired,
      ],
    );

    await cacheDel('courses:*');
    await invalidateResolvedCache(body.courseId);
    await auditLog(user.sub, user.tenantId, 'module.created', 'module', mod.id, { courseId: body.courseId }, request.ip);

    return reply.code(201).send({ success: true, data: mod });
  });

  // =========================================================================
  // PUT /:id — Update module
  // =========================================================================
  app.put<{ Params: { id: string } }>('/:id', {
    preHandler: [app.authenticate, app.requireRole('trainer', 'admin_country', 'admin_rec', 'admin_continental')],
  }, async (request, reply) => {
    validateBody(uuidSchema, request.params.id);
    const body = validateBody(updateModuleSchema, request.body);
    const user = request.user;

    const mod = await queryOne(
      `UPDATE academy_core.modules SET
         title = COALESCE($2::jsonb, title),
         description = COALESCE($3::jsonb, description),
         sort_order = COALESCE($4, sort_order),
         estimated_minutes = COALESCE($5, estimated_minutes),
         is_required = COALESCE($6, is_required)
       WHERE id = $1
       RETURNING *`,
      [
        request.params.id,
        body.title ? JSON.stringify(body.title) : null,
        body.description ? JSON.stringify(body.description) : null,
        body.sortOrder ?? null,
        body.estimatedMinutes ?? null,
        body.isRequired ?? null,
      ],
    );

    if (!mod) {
      return reply.code(404).send({ success: false, error: 'Module not found' });
    }

    await cacheDel('courses:*');
    await invalidateResolvedCache(mod.course_id);
    await auditLog(user.sub, user.tenantId, 'module.updated', 'module', mod.id, {}, request.ip);

    return reply.send({ success: true, data: mod });
  });

  // =========================================================================
  // DELETE /:id — Delete module (cascades to lessons via FK)
  // =========================================================================
  app.delete<{ Params: { id: string } }>('/:id', {
    preHandler: [app.authenticate, app.requireRole('admin_country', 'admin_rec', 'admin_continental')],
  }, async (request, reply) => {
    validateBody(uuidSchema, request.params.id);
    const user = request.user;

    const deleted = await queryOne(
      'DELETE FROM academy_core.modules WHERE id = $1 RETURNING id, course_id',
      [request.params.id],
    );

    if (!deleted) {
      return reply.code(404).send({ success: false, error: 'Module not found' });
    }

    await cacheDel('courses:*');
    await invalidateResolvedCache(deleted.course_id);
    await auditLog(user.sub, user.tenantId, 'module.deleted', 'module', request.params.id, {}, request.ip);

    return reply.code(204).send();
  });

  // =========================================================================
  // POST /reorder — Batch update sort_order for modules
  // =========================================================================
  app.post('/reorder', {
    preHandler: [app.authenticate, app.requireRole('trainer', 'admin_country', 'admin_rec', 'admin_continental')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { moduleIds } = validateBody(reorderSchema, request.body);
    const user = request.user;

    let courseId: string | null = null;

    await transaction(async (client) => {
      for (let i = 0; i < moduleIds.length; i++) {
        const { rows } = await client.query(
          'UPDATE academy_core.modules SET sort_order = $2 WHERE id = $1 RETURNING course_id',
          [moduleIds[i], i],
        );
        if (rows[0] && !courseId) courseId = rows[0].course_id;
      }
    });

    if (courseId) {
      await cacheDel('courses:*');
      await invalidateResolvedCache(courseId);
    }
    await auditLog(user.sub, user.tenantId, 'modules.reordered', 'module', undefined, { moduleIds }, request.ip);

    return reply.send({ success: true, data: { reordered: moduleIds.length } });
  });
}
