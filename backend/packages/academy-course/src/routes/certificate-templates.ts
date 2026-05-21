// ============================================================================
// AU-IBAR Learning — Certificate Template Routes
// CRUD for certificate design templates by level
// ============================================================================
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { query, queryOne, BearerSecurity, UuidParam } from '@aris-academy/shared';

const ADMIN_ROLES = ['admin_country', 'admin_rec', 'admin_continental'];

export async function certificateTemplateRoutes(app: FastifyInstance) {

  // GET / — list all templates
  app.get('/', {
    schema: { summary: 'List certificate templates', tags: ['Certificates'], security: BearerSecurity },
    preHandler: [app.authenticate],
  }, async (_req, reply) => {
    const rows = await query(
      `SELECT * FROM academy_core.certificate_templates ORDER BY level, is_default DESC, created_at DESC`,
    );
    return reply.send({ success: true, data: rows });
  });

  // GET /:id
  app.get('/:id', {
    schema: { summary: 'Get certificate template', tags: ['Certificates'], security: BearerSecurity, params: UuidParam },
    preHandler: [app.authenticate],
  }, async (req: any, reply) => {
    const row = await queryOne(`SELECT * FROM academy_core.certificate_templates WHERE id = $1`, [req.params.id]);
    if (!row) return reply.code(404).send({ success: false, error: 'Not found' });
    return reply.send({ success: true, data: row });
  });

  // POST / — create
  app.post('/', {
    schema: { summary: 'Create certificate template', tags: ['Certificates'], security: BearerSecurity },
    preHandler: [app.authenticate, app.requireRole(...ADMIN_ROLES)],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const b = req.body as any;
    const user = (req as any).user;

    // If is_default, unset other defaults for same level
    if (b.is_default) {
      await query(`UPDATE academy_core.certificate_templates SET is_default = false WHERE level = $1`, [b.level]);
    }

    const row = await queryOne(`
      INSERT INTO academy_core.certificate_templates (name, level, design, signatories, is_default, is_active, created_by)
      VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, $6, $7)
      RETURNING *
    `, [b.name, b.level, JSON.stringify(b.design), JSON.stringify(b.signatories || []), b.is_default ?? false, b.is_active ?? true, user.sub]);

    return reply.code(201).send({ success: true, data: row });
  });

  // PUT /:id — update
  app.put('/:id', {
    schema: { summary: 'Update certificate template', tags: ['Certificates'], security: BearerSecurity, params: UuidParam },
    preHandler: [app.authenticate, app.requireRole(...ADMIN_ROLES)],
  }, async (req: any, reply) => {
    const b = req.body as any;

    if (b.is_default) {
      await query(`UPDATE academy_core.certificate_templates SET is_default = false WHERE level = $1 AND id != $2`, [b.level, req.params.id]);
    }

    const row = await queryOne(`
      UPDATE academy_core.certificate_templates SET
        name = COALESCE($2, name),
        level = COALESCE($3, level),
        design = COALESCE($4::jsonb, design),
        signatories = COALESCE($5::jsonb, signatories),
        is_default = COALESCE($6, is_default),
        is_active = COALESCE($7, is_active),
        updated_at = NOW()
      WHERE id = $1 RETURNING *
    `, [
      req.params.id, b.name, b.level,
      b.design ? JSON.stringify(b.design) : null,
      b.signatories ? JSON.stringify(b.signatories) : null,
      b.is_default ?? null, b.is_active ?? null,
    ]);

    if (!row) return reply.code(404).send({ success: false, error: 'Not found' });
    return reply.send({ success: true, data: row });
  });

  // DELETE /:id
  app.delete('/:id', {
    schema: { summary: 'Delete certificate template', tags: ['Certificates'], security: BearerSecurity, params: UuidParam },
    preHandler: [app.authenticate, app.requireRole(...ADMIN_ROLES)],
  }, async (req: any, reply) => {
    await query(`DELETE FROM academy_core.certificate_templates WHERE id = $1`, [req.params.id]);
    return reply.code(204).send();
  });
}
