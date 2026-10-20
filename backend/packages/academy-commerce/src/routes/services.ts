// ============================================================================
// Purchased Services Routes — coaching, mentoring, training sessions
// ============================================================================
import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { query, queryOne, validateBody, BearerSecurity } from '@topnet-academy/shared';

const updateServiceSchema = z.object({
  status: z.enum(['to_schedule', 'scheduled', 'in_progress', 'completed', 'canceled']),
  scheduledAt: z.string().optional(),
  notes: z.string().max(2000).optional(),
});

export async function serviceRoutes(app: FastifyInstance) {

  // GET /services — list user's purchased services
  app.get('/', {
    schema: { summary: 'List my services', tags: ['Services'], security: BearerSecurity },
    preHandler: [app.authenticate],
  }, async (req: any, reply) => {
    const rows = await query(
      `SELECT ps.*, o.ref AS order_ref
       FROM academy_core.purchased_services ps
       JOIN academy_core.orders o ON o.id = ps.order_id
       WHERE ps.user_id = $1
       ORDER BY ps.created_at DESC`,
      [req.user.sub],
    );
    return reply.send({ success: true, data: rows });
  });

  // POST /services/:id/request — user submits availability/request
  app.post('/:id/request', {
    schema: { summary: 'Submit service request', tags: ['Services'], security: BearerSecurity },
    preHandler: [app.authenticate],
  }, async (req: any, reply) => {
    const { request } = req.body as { request: string };
    await query(
      `UPDATE academy_core.purchased_services
       SET request = $1 WHERE id = $2 AND user_id = $3`,
      [(request || '').slice(0, 1000), req.params.id, req.user.sub],
    );
    return reply.send({ success: true });
  });

  // =========== Admin routes ===========

  // GET /services/admin — list all services
  app.get('/admin', {
    schema: { summary: 'Admin: list services', tags: ['Services'], security: BearerSecurity },
    preHandler: [app.authenticate, app.requireRole('admin_country', 'admin_rec', 'admin_continental')],
  }, async (req: any, reply) => {
    const { clause, params } = req.tenantFilter();
    const rows = await query(
      `SELECT ps.*, u.first_name, u.last_name, u.email, u.phone, o.ref AS order_ref
       FROM academy_core.purchased_services ps
       JOIN academy_core.users u ON u.id = ps.user_id
       JOIN academy_core.orders o ON o.id = ps.order_id
       WHERE ps.${clause}
       ORDER BY
         CASE ps.status
           WHEN 'to_schedule' THEN 1
           WHEN 'scheduled' THEN 2
           WHEN 'in_progress' THEN 3
           ELSE 4
         END,
         ps.created_at DESC
       LIMIT 500`,
      params,
    );
    return reply.send({ success: true, data: rows });
  });

  // PUT /services/admin/:id — update service status/scheduling
  app.put('/admin/:id', {
    schema: { summary: 'Admin: update service', tags: ['Services'], security: BearerSecurity },
    preHandler: [app.authenticate, app.requireRole('admin_country', 'admin_rec', 'admin_continental')],
  }, async (req: any, reply: FastifyReply) => {
    const data = validateBody(updateServiceSchema, req.body);

    const service = await queryOne<any>(
      `UPDATE academy_core.purchased_services
       SET status = $1, scheduled_at = $2, notes = $3
       WHERE id = $4
       RETURNING *`,
      [
        data.status,
        data.scheduledAt || null,
        data.notes || null,
        req.params.id,
      ],
    );

    if (!service) return reply.code(404).send({ success: false, error: 'Service not found' });
    return reply.send({ success: true, data: service });
  });
}
