// ============================================================================
// ARIS Academy — Course Categories Routes
// CRUD for course categories (hierarchical, multilingual)
// ============================================================================
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { query, queryOne, validateBody, BearerSecurity } from '@aris-academy/shared';

const categorySchema = z.object({
  name: z.record(z.string()).refine((v) => v.fr || v.en, 'Name required in FR or EN'),
  description: z.record(z.string()).optional(),
  slug: z.string().min(2).max(100),
  icon: z.string().max(50).optional(),
  color: z.string().max(7).optional(),
  sortOrder: z.number().int().optional(),
  parentId: z.string().uuid().nullable().optional(),
});

export async function categoryRoutes(app: FastifyInstance) {
  // GET / — List all categories (public, no auth)
  app.get('/', {
    schema: { summary: 'List all course categories', tags: ['Categories'] },
  }, async (_req, reply) => {
    try {
      const rows = await query(
        `SELECT c.*, (SELECT COUNT(*) FROM academy_core.courses co WHERE co.category_id = c.id AND co.status = 'published') AS course_count
         FROM academy_core.course_categories c
         ORDER BY c.sort_order ASC, c.created_at ASC`,
      );
      return reply.send({ success: true, data: rows.map((r: any) => ({ ...r, course_count: parseInt(r.course_count || '0', 10) })) });
    } catch (err: any) {
      return reply.send({ success: true, data: [] });
    }
  });

  // GET /:id — Get single category
  app.get('/:id', {
    schema: { summary: 'Get category by ID', tags: ['Categories'] },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const cat = await queryOne('SELECT * FROM academy_core.course_categories WHERE id = $1 OR slug = $1', [id]);
    if (!cat) return reply.code(404).send({ success: false, error: 'Category not found' });
    return reply.send({ success: true, data: cat });
  });

  // POST / — Create category (admin only)
  app.post('/', {
    schema: { summary: 'Create course category', tags: ['Categories'], security: BearerSecurity },
    preHandler: [app.authenticate, app.requireRole('admin_country', 'admin_rec', 'admin_continental')],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const data = validateBody(categorySchema, req.body);
    const cat = await queryOne(
      `INSERT INTO academy_core.course_categories (name, description, slug, icon, color, sort_order, parent_id)
       VALUES ($1::jsonb, $2::jsonb, $3, $4, $5, $6, $7)
       RETURNING *`,
      [JSON.stringify(data.name), data.description ? JSON.stringify(data.description) : null,
       data.slug, data.icon || 'BookOpen', data.color || '#1A5632', data.sortOrder || 0, data.parentId || null],
    );
    return reply.code(201).send({ success: true, data: cat });
  });

  // PUT /:id — Update category (admin only)
  app.put('/:id', {
    schema: { summary: 'Update course category', tags: ['Categories'], security: BearerSecurity },
    preHandler: [app.authenticate, app.requireRole('admin_country', 'admin_rec', 'admin_continental')],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    const data = validateBody(categorySchema.partial(), req.body);
    const sets: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (data.name) { sets.push(`name = $${idx++}::jsonb`); params.push(JSON.stringify(data.name)); }
    if (data.description !== undefined) { sets.push(`description = $${idx++}::jsonb`); params.push(data.description ? JSON.stringify(data.description) : null); }
    if (data.slug) { sets.push(`slug = $${idx++}`); params.push(data.slug); }
    if (data.icon) { sets.push(`icon = $${idx++}`); params.push(data.icon); }
    if (data.color) { sets.push(`color = $${idx++}`); params.push(data.color); }
    if (data.sortOrder !== undefined) { sets.push(`sort_order = $${idx++}`); params.push(data.sortOrder); }
    if (data.parentId !== undefined) { sets.push(`parent_id = $${idx++}`); params.push(data.parentId); }

    if (sets.length === 0) return reply.code(400).send({ success: false, error: 'No fields to update' });

    params.push(id);
    const cat = await queryOne(
      `UPDATE academy_core.course_categories SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      params,
    );
    if (!cat) return reply.code(404).send({ success: false, error: 'Category not found' });
    return reply.send({ success: true, data: cat });
  });

  // DELETE /:id — Delete category (admin only)
  app.delete('/:id', {
    schema: { summary: 'Delete course category', tags: ['Categories'], security: BearerSecurity },
    preHandler: [app.authenticate, app.requireRole('admin_rec', 'admin_continental')],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { id } = req.params as { id: string };
    // Set courses to null category before deleting
    await query('UPDATE academy_core.courses SET category_id = NULL WHERE category_id = $1', [id]);
    await query('DELETE FROM academy_core.course_categories WHERE id = $1', [id]);
    return reply.code(204).send();
  });
}
